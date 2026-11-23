import {
  DEFAULT_ROOM_RULES,
  ROOM_ITEM_MAX_BYTES,
  ROOM_MAX_MEMBERS,
  ROOM_TEXT_MAX,
  type RoomInfo,
  type RoomInvite,
  type RoomItemMeta,
  type RoomItemPayload,
  type RoomMember,
  type RoomMessage,
  type RoomPostDraft,
  type RoomProfile,
  type RoomRules,
  type RoomSnapshot,
} from '../types/room';
import { createPin, createSalt, deriveRoomKey, openJson, randomToken, sealJson } from './roomCrypto';
import {
  isRecord,
  parseJoinRequest,
  parseSealedCall,
  parseWireRequest,
  type HelloResponse,
  type HostRequest,
  type HostStreamOpen,
  type HostTransport,
  type JoinResult,
  type RoomErrorCode,
  type RoomEvent,
} from './roomProtocol';

/**
 * Motor del anfitrión: toda la lógica de la sala vive aquí, en TypeScript, y es la misma en
 * Android y en Windows. El servidor nativo solo le entrega peticiones y conexiones SSE.
 *
 * Responsabilidades:
 * - validar el PIN (la solicitud de entrada llega cifrada con la clave derivada del PIN);
 * - sala de espera, bloqueo de entrada, solo lectura, texto sí/no, expulsar y bloquear;
 * - guardar en memoria los elementos publicados y difundir solo su ficha (el contenido se pide
 *   aparte con fetch, así el hilo es liviano);
 * - empujar cada cambio por SSE a quien corresponda, sin sondeos.
 */

export const HOST_MEMBER_ID = 'host';

const MAX_MESSAGES = 300;
/** Memoria total para el contenido de los elementos; al pasarla se descartan los más antiguos. */
const MAX_ITEM_STORE_BYTES = 150 * 1024 * 1024;
const MAX_PIN_FAILURES = 5;
const PIN_LOCKOUT_MS = 60_000;
/** Tras cerrar la sala se espera un momento para que el aviso «end» alcance a salir. */
const CLOSE_FLUSH_MS = 400;

interface HostMember {
  id: string;
  name: string;
  color: string;
  deviceId: string;
  token: string;
  status: RoomMember['status'];
  joinedAt: number;
  streams: Set<string>;
}

interface StoredItem {
  payload: RoomItemPayload;
  bytes: number;
}

interface HttpResult {
  status: number;
  body: string;
}

export interface RoomHostOptions {
  roomName: string;
  profile: RoomProfile;
  pinLength: 4 | 6;
  rules?: Partial<RoomRules>;
}

/** Lo que ve la interfaz del anfitrión. */
export interface RoomHostView {
  snapshot: RoomSnapshot;
  invite: RoomInvite;
}

export type RoomHostEndReason = 'closed' | 'error';

function json(status: number, body: unknown): HttpResult {
  return { status, body: JSON.stringify(body) };
}

function error(status: number, code: RoomErrorCode): HttpResult {
  return json(status, { error: code });
}

function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function payloadBytes(payload: RoomItemPayload): number {
  // Base64 → bytes reales del archivo; JSON → caracteres (aprox. bytes)
  return payload.kind === 'document' ? Math.floor((payload.data.length * 3) / 4) : payload.data.length;
}

export class RoomHostEngine {
  private readonly transport: HostTransport;
  private readonly info: RoomInfo;
  private readonly profile: RoomProfile;
  private readonly pin: string;
  private readonly salt: string;
  private key: CryptoKey | null = null;
  private rules: RoomRules;
  private invite: RoomInvite | null = null;

  private readonly members = new Map<string, HostMember>();
  private readonly streamOwner = new Map<string, string>();
  private readonly blockedDevices = new Set<string>();
  private readonly pinFailures = new Map<string, { count: number; until: number }>();
  private messages: RoomMessage[] = [];
  private readonly items = new Map<string, StoredItem>();
  private itemBytes = 0;
  private readonly createdAt = Date.now();

  private ended = false;
  private view: RoomHostView | null = null;
  private readonly listeners = new Set<() => void>();
  private endListener: ((reason: RoomHostEndReason, message?: string) => void) | null = null;

  private constructor(transport: HostTransport, options: RoomHostOptions) {
    this.transport = transport;
    this.profile = options.profile;
    this.info = { name: options.roomName.trim().slice(0, 60) || 'Sala de clase', hostName: options.profile.name, pinLength: options.pinLength };
    this.pin = createPin(options.pinLength);
    this.salt = createSalt();
    this.rules = { ...DEFAULT_ROOM_RULES, ...options.rules };
  }

  /** Crea la sala: deriva la clave del PIN y abre el servidor de la red local. */
  static async open(transport: HostTransport, options: RoomHostOptions): Promise<RoomHostEngine> {
    const engine = new RoomHostEngine(transport, options);
    engine.key = await deriveRoomKey(engine.pin, engine.salt);
    const { port, hosts } = await transport.start({
      onRequest: (request) => void engine.handleRequest(request),
      onStreamOpen: (stream) => void engine.handleStreamOpen(stream),
      onStreamClosed: (streamId) => engine.handleStreamClosed(streamId),
      onStopped: (reason) => engine.finish('error', reason),
    });
    engine.invite = { hosts, port, pin: engine.pin, name: engine.info.name };
    engine.refreshView();
    return engine;
  }

  /* ------------------------------------------------------------------ Suscripción de la interfaz */

  getView(): RoomHostView | null {
    return this.view;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onEnd(listener: (reason: RoomHostEndReason, message?: string) => void): void {
    this.endListener = listener;
  }

  private refreshView(): void {
    if (!this.invite) return;
    this.view = { snapshot: this.snapshotFor(HOST_MEMBER_ID), invite: this.invite };
    for (const listener of this.listeners) listener();
  }

  /* ------------------------------------------------------------------ Estado */

  private memberList(includePending: boolean): RoomMember[] {
    const list: RoomMember[] = [
      { id: HOST_MEMBER_ID, name: this.profile.name, color: this.profile.color, isHost: true, status: 'active', online: true, joinedAt: this.createdAt },
    ];
    for (const member of this.members.values()) {
      if (!includePending && member.status !== 'active') continue;
      list.push({
        id: member.id,
        name: member.name,
        color: member.color,
        isHost: false,
        status: member.status,
        online: member.streams.size > 0,
        joinedAt: member.joinedAt,
      });
    }
    return list;
  }

  private snapshotFor(memberId: string): RoomSnapshot {
    return {
      info: this.info,
      rules: this.rules,
      members: this.memberList(memberId === HOST_MEMBER_ID),
      messages: this.messages,
      selfId: memberId,
    };
  }

  /* ------------------------------------------------------------------ Envío por SSE */

  private async pushTo(member: HostMember, event: RoomEvent): Promise<void> {
    if (!this.key || member.streams.size === 0) return;
    const sealed = await sealJson(this.key, event);
    for (const streamId of member.streams) this.transport.push(streamId, sealed);
  }

  /** Mismo evento a todos los activos: se cifra una sola vez. */
  private async broadcast(event: RoomEvent): Promise<void> {
    if (!this.key) return;
    const targets = [...this.members.values()].filter((m) => m.status === 'active' && m.streams.size > 0);
    if (targets.length === 0) return;
    const sealed = await sealJson(this.key, event);
    for (const member of targets) for (const streamId of member.streams) this.transport.push(streamId, sealed);
  }

  private membersChanged(): void {
    this.refreshView();
    void this.broadcast({ type: 'members', members: this.memberList(false) });
  }

  private addMessage(message: RoomMessage): void {
    this.messages = [...this.messages, message].slice(-MAX_MESSAGES);
    this.refreshView();
    void this.broadcast({ type: 'message', message });
  }

  private systemMessage(text: string): void {
    this.addMessage({
      id: randomToken(9),
      createdAt: Date.now(),
      authorId: HOST_MEMBER_ID,
      authorName: this.profile.name,
      authorColor: this.profile.color,
      system: true,
      text,
    });
  }

  private storeItem(payload: RoomItemPayload): RoomItemMeta {
    const id = randomToken(9);
    const bytes = payloadBytes(payload);
    this.items.set(id, { payload, bytes });
    this.itemBytes += bytes;
    // Se descartan los más antiguos (Map conserva el orden de inserción)
    for (const [oldId, stored] of this.items) {
      if (this.itemBytes <= MAX_ITEM_STORE_BYTES || oldId === id) break;
      this.items.delete(oldId);
      this.itemBytes -= stored.bytes;
    }
    return {
      id,
      kind: payload.kind,
      title: payload.title,
      subtitle: payload.subtitle,
      sizeBytes: bytes,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
    };
  }

  private publish(author: { id: string; name: string; color: string }, draft: RoomPostDraft): void {
    const text = draft.text?.trim().slice(0, ROOM_TEXT_MAX) || undefined;
    const item = draft.item ? this.storeItem(draft.item) : undefined;
    this.addMessage({ id: randomToken(9), createdAt: Date.now(), authorId: author.id, authorName: author.name, authorColor: author.color, text, item });
  }

  /* ------------------------------------------------------------------ Peticiones HTTP */

  private async handleRequest(request: HostRequest): Promise<void> {
    let result: HttpResult;
    try {
      result = await this.route(request);
    } catch {
      result = error(400, 'bad-request');
    }
    if (!this.ended) this.transport.respond(request.id, result.status, result.body);
  }

  private async route(request: HostRequest): Promise<HttpResult> {
    if (this.ended || !this.key) return error(410, 'gone');
    const wire = parseWireRequest(request.body);
    if (!wire) return error(400, 'bad-request');

    if (wire.op === 'hello') {
      const hello: HelloResponse = {
        app: 'agenda-universitaria',
        room: this.info.name,
        host: this.info.hostName,
        salt: this.salt,
        pinLength: this.info.pinLength,
        locked: this.rules.locked,
      };
      return json(200, hello);
    }
    if (wire.op === 'join') return this.join(wire.s, request.remote);
    return this.call(wire.m, wire.s);
  }

  private async join(sealed: string, remote: string): Promise<HttpResult> {
    const key = this.key;
    if (!key) return error(410, 'gone');
    const now = Date.now();
    const failures = this.pinFailures.get(remote);
    if (failures && failures.until > now) return error(429, 'too-many');

    let request: ReturnType<typeof parseJoinRequest>;
    try {
      request = parseJoinRequest(await openJson(key, sealed));
    } catch {
      // No se pudo descifrar: el PIN no es el de la sala
      const count = (failures?.count ?? 0) + 1;
      this.pinFailures.set(remote, count >= MAX_PIN_FAILURES ? { count: 0, until: now + PIN_LOCKOUT_MS } : { count, until: 0 });
      return error(401, 'pin');
    }
    if (!request) return error(400, 'bad-request');
    this.pinFailures.delete(remote);
    if (this.blockedDevices.has(request.deviceId)) return error(403, 'blocked');

    // El mismo dispositivo que vuelve (se cerró la app, cambió de red…): conserva su lugar
    const existing = [...this.members.values()].find((m) => m.deviceId === request.deviceId);
    if (existing) {
      existing.token = randomToken();
      existing.name = request.name;
      existing.color = request.color;
      this.membersChanged();
      const result: JoinResult = { memberId: existing.id, token: existing.token };
      return json(200, { s: await sealJson(key, result) });
    }

    if (this.rules.locked) return error(423, 'locked');
    if (this.members.size + 1 >= ROOM_MAX_MEMBERS) return error(409, 'full');

    const member: HostMember = {
      id: randomToken(9),
      name: request.name,
      color: request.color,
      deviceId: request.deviceId,
      token: randomToken(),
      status: this.rules.waitingRoom ? 'pending' : 'active',
      joinedAt: now,
      streams: new Set(),
    };
    this.members.set(member.id, member);
    if (member.status === 'active') this.systemMessage(`${member.name} se unió a la sala`);
    this.membersChanged();
    const result: JoinResult = { memberId: member.id, token: member.token };
    return json(200, { s: await sealJson(key, result) });
  }

  private async call(memberId: string, sealed: string): Promise<HttpResult> {
    const key = this.key;
    if (!key) return error(410, 'gone');
    const member = this.members.get(memberId);
    if (!member) return error(410, 'gone');
    let request: ReturnType<typeof parseSealedCall>;
    try {
      request = parseSealedCall(await openJson(key, sealed), ROOM_ITEM_MAX_BYTES);
    } catch {
      return error(401, 'auth');
    }
    if (!request) return error(400, 'bad-request');
    if (!sameToken(request.token, member.token)) return error(401, 'auth');

    const ok = async (body: unknown): Promise<HttpResult> => json(200, { s: await sealJson(key, body) });
    const { call } = request;

    if (call.op === 'leave') {
      this.removeMember(member, `${member.name} salió de la sala`);
      return ok({ ok: true });
    }
    if (member.status !== 'active') return error(403, 'rule');

    if (call.op === 'fetch') {
      const stored = this.items.get(call.itemId);
      return stored ? ok({ payload: stored.payload }) : error(404, 'not-found');
    }

    // post
    if (this.rules.readOnly) return error(403, 'rule');
    const draft: RoomPostDraft = { ...call.draft };
    if (!this.rules.textEnabled) {
      if (!draft.item) return error(403, 'rule');
      draft.text = undefined;
    }
    if (draft.item && payloadBytes(draft.item) > ROOM_ITEM_MAX_BYTES) return error(413, 'too-large');
    this.publish(member, draft);
    return ok({ ok: true });
  }

  /* ------------------------------------------------------------------ Conexiones SSE */

  private async handleStreamOpen(stream: HostStreamOpen): Promise<void> {
    const key = this.key;
    const params = new URLSearchParams(stream.query);
    const member = this.members.get(params.get('m') ?? '');
    const proof = params.get('t') ?? '';
    let valid = false;
    if (key && member && !this.ended) {
      try {
        const opened = await openJson(key, proof);
        valid = isRecord(opened) && typeof opened.token === 'string' && sameToken(opened.token, member.token);
      } catch {
        valid = false;
      }
    }
    if (!valid || !member || !this.members.has(member.id)) {
      this.transport.closeStream(stream.streamId);
      return;
    }
    const wasOnline = member.streams.size > 0;
    member.streams.add(stream.streamId);
    this.streamOwner.set(stream.streamId, member.id);
    if (key) {
      const first: RoomEvent = member.status === 'active' ? { type: 'snapshot', snapshot: this.snapshotFor(member.id) } : { type: 'waiting', info: this.info };
      this.transport.push(stream.streamId, await sealJson(key, first));
    }
    if (!wasOnline) this.membersChanged();
  }

  private handleStreamClosed(streamId: string): void {
    const memberId = this.streamOwner.get(streamId);
    this.streamOwner.delete(streamId);
    const member = memberId ? this.members.get(memberId) : undefined;
    if (!member) return;
    member.streams.delete(streamId);
    if (member.streams.size === 0) this.membersChanged();
  }

  private removeMember(member: HostMember, notice?: string): void {
    for (const streamId of member.streams) {
      this.streamOwner.delete(streamId);
      this.transport.closeStream(streamId);
    }
    member.streams.clear();
    const wasActive = member.status === 'active';
    this.members.delete(member.id);
    if (notice && wasActive) this.systemMessage(notice);
    this.membersChanged();
  }

  /* ------------------------------------------------------------------ Acciones del anfitrión */

  async post(draft: RoomPostDraft): Promise<void> {
    if (this.ended) return;
    if (draft.item && payloadBytes(draft.item) > ROOM_ITEM_MAX_BYTES) throw new Error('El elemento es demasiado pesado para la sala (máximo 10 MB).');
    // El anfitrión siempre puede escribir, aunque haya desactivado el texto para los demás
    this.publish({ id: HOST_MEMBER_ID, name: this.profile.name, color: this.profile.color }, draft);
  }

  fetchItem(itemId: string): RoomItemPayload {
    const stored = this.items.get(itemId);
    if (!stored) throw new Error('Ese elemento ya no está disponible en la sala.');
    return stored.payload;
  }

  async approve(memberId: string): Promise<void> {
    const member = this.members.get(memberId);
    if (!member || member.status !== 'pending') return;
    member.status = 'active';
    this.systemMessage(`${member.name} se unió a la sala`);
    this.membersChanged();
    await this.pushTo(member, { type: 'snapshot', snapshot: this.snapshotFor(member.id) });
  }

  async reject(memberId: string): Promise<void> {
    const member = this.members.get(memberId);
    if (!member || member.status !== 'pending') return;
    await this.pushTo(member, { type: 'end', reason: 'rejected' });
    this.removeMember(member);
  }

  /** Expulsa y bloquea el dispositivo mientras dure la sala. */
  async kick(memberId: string): Promise<void> {
    const member = this.members.get(memberId);
    if (!member) return;
    this.blockedDevices.add(member.deviceId);
    await this.pushTo(member, { type: 'end', reason: 'kicked' });
    this.removeMember(member, `${member.name} ya no está en la sala`);
  }

  setRules(patch: Partial<RoomRules>): void {
    if (this.ended) return;
    this.rules = { ...this.rules, ...patch };
    this.refreshView();
    void this.broadcast({ type: 'rules', rules: this.rules });
    // Sin sala de espera, los que esperaban entran
    if (patch.waitingRoom === false) {
      for (const member of [...this.members.values()]) if (member.status === 'pending') void this.approve(member.id);
    }
  }

  /** Cerrar la sala para todos: aviso por SSE y se apaga el servidor. */
  async close(): Promise<void> {
    if (this.ended) return;
    await this.broadcastToEveryone({ type: 'end', reason: 'closed' });
    await new Promise((resolve) => setTimeout(resolve, CLOSE_FLUSH_MS));
    this.finish('closed');
  }

  private async broadcastToEveryone(event: RoomEvent): Promise<void> {
    if (!this.key) return;
    const sealed = await sealJson(this.key, event);
    for (const member of this.members.values()) for (const streamId of member.streams) this.transport.push(streamId, sealed);
  }

  private finish(reason: RoomHostEndReason, message?: string): void {
    if (this.ended) return;
    this.ended = true;
    this.members.clear();
    this.streamOwner.clear();
    this.items.clear();
    void this.transport.stop().catch(() => undefined);
    this.endListener?.(reason, message);
  }
}
