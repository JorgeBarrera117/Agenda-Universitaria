import type { RoomEndReason, RoomInfo, RoomInvite, RoomItemPayload, RoomPostDraft, RoomProfile, RoomSnapshot } from '../types/room';
import { deriveRoomKey, openJson, sealJson } from './roomCrypto';
import {
  ROOM_ERROR_MESSAGES,
  errorCodeOf,
  eventsUrl,
  isRecord,
  parseHelloResponse,
  parseItemPayload,
  parseRoomEvent,
  rpcUrl,
  type GuestTransport,
  type JoinRequest,
  type RoomCall,
  type RoomEvent,
  type SealedCall,
} from './roomProtocol';
import { ROOM_ITEM_MAX_BYTES } from '../types/room';

/**
 * Cliente del invitado: entra a la sala, mantiene abierta la conexión SSE (y la reabre si se corta)
 * y hace las llamadas cifradas (publicar, descargar un elemento, salir).
 */

const HELLO_TIMEOUT_MS = 4_000;
const CALL_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;
/** Sin conexión con el anfitrión durante este tiempo, la sala se da por perdida. */
const LOST_AFTER_MS = 60_000;
/** Conexiones que el anfitrión cierra sin enviar nada: ya no somos parte de la sala. */
const MAX_SILENT_CLOSES = 3;

export class RoomJoinError extends Error {}

export interface RoomGuestState {
  phase: 'waiting' | 'active' | 'ended';
  info: RoomInfo;
  snapshot: RoomSnapshot | null;
  /** online: conexión de eventos abierta; reconnecting: se cortó y se está reintentando. */
  connection: 'online' | 'reconnecting';
  endReason?: RoomEndReason;
}

export class RoomGuestClient {
  private readonly transport: GuestTransport;
  private readonly host: string;
  private readonly port: number;
  private readonly key: CryptoKey;
  private readonly memberId: string;
  private readonly token: string;
  private state: RoomGuestState;
  private readonly listeners = new Set<() => void>();
  private endListener: ((reason: RoomEndReason, message?: string) => void) | null = null;

  private closeStream: (() => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1_000;
  private offlineSince = 0;
  private silentCloses = 0;
  private receivedOnStream = false;
  /** Los eventos se descifran de forma asíncrona: se aplican en orden con esta cola. */
  private eventQueue: Promise<void> = Promise.resolve();

  private constructor(transport: GuestTransport, host: string, port: number, key: CryptoKey, memberId: string, token: string, info: RoomInfo) {
    this.transport = transport;
    this.host = host;
    this.port = port;
    this.key = key;
    this.memberId = memberId;
    this.token = token;
    this.state = { phase: 'waiting', info, snapshot: null, connection: 'reconnecting' };
  }

  /** Busca al anfitrión en sus direcciones, valida el PIN al entrar y abre la conexión de eventos. */
  static async connect(transport: GuestTransport, invite: RoomInvite, profile: RoomProfile, deviceId: string): Promise<RoomGuestClient> {
    let found: { host: string; salt: string; info: RoomInfo; locked: boolean } | null = null;
    for (const host of invite.hosts) {
      try {
        const response = await transport.request(rpcUrl(host, invite.port), JSON.stringify({ v: 1, op: 'hello' }), HELLO_TIMEOUT_MS);
        const hello = response.status === 200 ? parseHelloResponse(response.body) : null;
        if (hello) {
          found = { host, salt: hello.salt, info: { name: hello.room, hostName: hello.host, pinLength: hello.pinLength }, locked: hello.locked };
          break;
        }
      } catch {
        // Se prueba la siguiente dirección
      }
    }
    if (!found) {
      throw new RoomJoinError('No se encontró la sala. Revisa que ambos estén en la misma red wifi (o en el punto de acceso del anfitrión) y que la sala siga abierta.');
    }
    if (found.locked) throw new RoomJoinError(ROOM_ERROR_MESSAGES.locked);

    const key = await deriveRoomKey(invite.pin, found.salt);
    const join: JoinRequest = { name: profile.name, color: profile.color, deviceId };
    const response = await transport.request(rpcUrl(found.host, invite.port), JSON.stringify({ v: 1, op: 'join', s: await sealJson(key, join) }), CALL_TIMEOUT_MS);
    if (response.status !== 200) {
      const code = errorCodeOf(response.body);
      throw new RoomJoinError(code ? ROOM_ERROR_MESSAGES[code] : 'El anfitrión no respondió como se esperaba.');
    }
    const result = await openSealedBody(key, response.body);
    if (!isRecord(result) || typeof result.memberId !== 'string' || typeof result.token !== 'string') {
      throw new RoomJoinError('El anfitrión no respondió como se esperaba.');
    }
    const client = new RoomGuestClient(transport, found.host, invite.port, key, result.memberId, result.token, found.info);
    await client.openEvents();
    return client;
  }

  /* ------------------------------------------------------------------ Suscripción */

  getState(): RoomGuestState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onEnd(listener: (reason: RoomEndReason, message?: string) => void): void {
    this.endListener = listener;
  }

  private setState(next: Partial<RoomGuestState>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  /* ------------------------------------------------------------------ Conexión de eventos (SSE) */

  private async openEvents(): Promise<void> {
    if (this.state.phase === 'ended') return;
    const proof = await sealJson(this.key, { token: this.token, at: Date.now() });
    this.receivedOnStream = false;
    try {
      this.closeStream = await this.transport.openStream(eventsUrl(this.host, this.port, this.memberId, proof), {
        onData: (data) => {
          this.receivedOnStream = true;
          this.silentCloses = 0;
          this.eventQueue = this.eventQueue.then(() => this.handleData(data));
        },
        onEnd: () => this.streamEnded(),
      });
    } catch {
      this.streamEnded();
    }
  }

  private streamEnded(): void {
    this.closeStream = null;
    if (this.state.phase === 'ended') return;
    if (!this.receivedOnStream) this.silentCloses += 1;
    if (this.silentCloses >= MAX_SILENT_CLOSES) {
      this.finish('lost', 'Ya no formas parte de esta sala.');
      return;
    }
    if (!this.offlineSince) this.offlineSince = Date.now();
    if (Date.now() - this.offlineSince > LOST_AFTER_MS) {
      this.finish('lost', 'Se perdió la conexión con el anfitrión.');
      return;
    }
    if (this.state.connection !== 'reconnecting') this.setState({ connection: 'reconnecting' });
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.openEvents();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 5_000);
  }

  private async handleData(data: string): Promise<void> {
    let event: RoomEvent | null;
    try {
      event = parseRoomEvent(await openJson(this.key, data));
    } catch {
      return;
    }
    if (!event || this.state.phase === 'ended') return;
    this.offlineSince = 0;
    this.retryDelay = 1_000;
    const online = { connection: 'online' as const };

    switch (event.type) {
      case 'waiting':
        this.setState({ ...online, phase: 'waiting', info: event.info });
        break;
      case 'snapshot':
        this.setState({ ...online, phase: 'active', info: event.snapshot.info, snapshot: event.snapshot });
        break;
      case 'message': {
        const snapshot = this.state.snapshot;
        if (!snapshot) break;
        const message = event.message;
        if (snapshot.messages.some((m) => m.id === message.id)) break;
        this.setState({ ...online, snapshot: { ...snapshot, messages: [...snapshot.messages, message].slice(-300) } });
        break;
      }
      case 'members': {
        const snapshot = this.state.snapshot;
        if (snapshot) this.setState({ ...online, snapshot: { ...snapshot, members: event.members } });
        break;
      }
      case 'rules': {
        const snapshot = this.state.snapshot;
        if (snapshot) this.setState({ ...online, snapshot: { ...snapshot, rules: event.rules } });
        break;
      }
      case 'end': {
        const messages: Record<typeof event.reason, string> = {
          closed: 'El anfitrión cerró la sala.',
          kicked: 'El anfitrión te retiró de la sala.',
          rejected: 'El anfitrión no aceptó tu solicitud.',
        };
        this.finish(event.reason, messages[event.reason]);
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ Llamadas */

  private async call(call: RoomCall, timeoutMs = CALL_TIMEOUT_MS): Promise<unknown> {
    if (this.state.phase === 'ended') throw new Error('La sala ya terminó.');
    const sealed: SealedCall = { token: this.token, call };
    const body = JSON.stringify({ v: 1, op: 'call', m: this.memberId, s: await sealJson(this.key, sealed) });
    let response: { status: number; body: string };
    try {
      response = await this.transport.request(rpcUrl(this.host, this.port), body, timeoutMs);
    } catch {
      throw new Error('No se pudo llegar al anfitrión. Revisa la conexión wifi.');
    }
    if (response.status !== 200) {
      const code = errorCodeOf(response.body);
      if (code === 'gone' || code === 'auth') this.finish('lost', ROOM_ERROR_MESSAGES[code]);
      throw new Error(code ? ROOM_ERROR_MESSAGES[code] : 'El anfitrión no respondió como se esperaba.');
    }
    return openSealedBody(this.key, response.body);
  }

  async post(draft: RoomPostDraft): Promise<void> {
    await this.call({ op: 'post', draft }, draft.item ? UPLOAD_TIMEOUT_MS : CALL_TIMEOUT_MS);
  }

  async fetchItem(itemId: string): Promise<RoomItemPayload> {
    const result = await this.call({ op: 'fetch', itemId }, UPLOAD_TIMEOUT_MS);
    const payload = isRecord(result) ? parseItemPayload(result.payload, ROOM_ITEM_MAX_BYTES) : null;
    if (!payload) throw new Error('El elemento llegó incompleto.');
    return payload;
  }

  async leave(): Promise<void> {
    try {
      await this.call({ op: 'leave' }, 5_000);
    } catch {
      // Si el anfitrión ya no está, igual salimos
    }
    this.finish('left');
  }

  /** Corta sin avisar (al cerrar la app o el proceso). */
  dispose(): void {
    this.finish('left');
  }

  private finish(reason: RoomEndReason, message?: string): void {
    if (this.state.phase === 'ended') return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.closeStream?.();
    this.closeStream = null;
    this.setState({ phase: 'ended', endReason: reason });
    this.endListener?.(reason, message);
  }
}

async function openSealedBody(key: CryptoKey, body: string): Promise<unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error('El anfitrión no respondió como se esperaba.');
  }
  if (!isRecord(parsed) || typeof parsed.s !== 'string') throw new Error('El anfitrión no respondió como se esperaba.');
  return openJson(key, parsed.s);
}
