import {
  DEFAULT_ROOM_RULES,
  ROOM_CHUNK_BYTES,
  ROOM_ITEM_MAX_BYTES,
  ROOM_MAX_MEMBERS,
  ROOM_TEXT_MAX,
  type RoomInfo,
  type RoomInvite,
  type RoomItemDraft,
  type RoomItemInfo,
  type RoomItemMeta,
  type RoomMember,
  type RoomMessage,
  type RoomPostDraft,
  type RoomProfile,
  type RoomReceivedItem,
  type RoomRules,
  type RoomSnapshot,
} from '../types/room';
import { base64StringToBytes, bytesToBase64String, createPin, createSalt, deriveRoomKey, openJson, randomToken, sealJson, verifyIdentity } from './roomCrypto';
import {
  chunkCount,
  isOtherProtocolVersion,
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
  ROOM_PROTOCOL_VERSION,
} from './roomProtocol';

/**
 * Motor del anfitrión: toda la lógica de la sala vive aquí, en TypeScript, y es la misma en
 * Android y en Windows. El servidor nativo solo le entrega peticiones y conexiones SSE.
 *
 * Responsabilidades:
 * - validar el PIN (la solicitud de entrada llega cifrada con la clave derivada del PIN);
 * - sala de espera, bloqueo de entrada, solo lectura, texto sí/no, chats privados, expulsar;
 * - recibir elementos por bloques cifrados (sin tope de 10 MB) y guardarlos como Blob mientras
 *   dure la sala; al hilo va solo su ficha y cada uno descarga los bloques cuando quiere guardarlo;
 * - mensajes privados: solo se entregan al autor y al destinatario (y sus elementos solo ellos
 *   dos los pueden descargar);
 * - empujar cada cambio por SSE a quien corresponda, sin sondeos.
 */

export const HOST_MEMBER_ID = 'host';

const MAX_MESSAGES = 400;
/** Memoria total para el contenido de los elementos; al pasarla se descartan los más antiguos. */
const MAX_ITEM_STORE_BYTES = 1024 * 1024 * 1024;
const MAX_PIN_FAILURES = 5;
const PIN_LOCKOUT_MS = 60_000;
/** Una subida sin bloques nuevos durante este tiempo se descarta. */
const UPLOAD_IDLE_MS = 120_000;
const MAX_UPLOADS_PER_MEMBER = 3;
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
  /** Miniatura de su foto de perfil. */
  avatar?: string;
  /** Huella verificada de su dispositivo (solo si firmó la entrada). */
  peerId?: string;
}

interface StoredItem {
  meta: RoomItemMeta;
  blob: Blob;
  authorId: string;
  to?: string;
}

interface PendingUpload {
  memberId: string;
  info: RoomItemInfo;
  size: number;
  to?: string;
  chunks: (Uint8Array<ArrayBuffer> | undefined)[];
  received: number;
  lastAt: number;
}

interface HttpResult {
  status: number;
  body: string;
}

interface Author {
  id: string;
  name: string;
  color: string;
}

export interface RoomHostOptions {
  roomName: string;
  profile: RoomProfile;
  pinLength: 4 | 6;
  rules?: Partial<RoomRules>;
  /** Huella del dispositivo del anfitrión (para que los demás puedan guardarlo como compañero). */
  peerId?: string;
  /** ¿Es un compañero guardado por el anfitrión? (entra sin sala de espera si la regla lo permite). */
  isTrusted?: (peerId: string) => boolean;
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

function expectedChunkBytes(size: number, index: number): number {
  const total = chunkCount(size);
  return index < total - 1 ? ROOM_CHUNK_BYTES : size - (total - 1) * ROOM_CHUNK_BYTES;
}

/** Visible para un participante: lo público, lo que escribió y lo que le escribieron. */
function visibleTo(message: RoomMessage, memberId: string): boolean {
  return !message.to || message.to === memberId || message.authorId === memberId;
}

export class RoomHostEngine {
  private readonly transport: HostTransport;
  private readonly info: RoomInfo;
  private readonly profile: RoomProfile;
  private readonly hostPeerId?: string;
  private readonly isTrusted: (peerId: string) => boolean;
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
  private readonly uploads = new Map<string, PendingUpload>();
  private uploadSweep: ReturnType<typeof setInterval> | null = null;
  private readonly createdAt = Date.now();

  private ended = false;
  private view: RoomHostView | null = null;
  private readonly listeners = new Set<() => void>();
  private endListener: ((reason: RoomHostEndReason, message?: string) => void) | null = null;

  private constructor(transport: HostTransport, options: RoomHostOptions) {
    this.transport = transport;
    this.profile = options.profile;
    this.hostPeerId = options.peerId;
    this.isTrusted = options.isTrusted ?? (() => false);
    this.info = { name: options.roomName.trim().slice(0, 60) || 'Sala de clase', hostName: options.profile.name, pinLength: options.pinLength };
    this.pin = createPin(options.pinLength);
    this.salt = createSalt();
    this.rules = { ...DEFAULT_ROOM_RULES, ...options.rules };
  }

  /** Crea la sala: deriva la clave del PIN y abre el servidor de la red local. */
  static async open(transport: HostTransport, options: RoomHostOptions): Promise<RoomHostEngine> {
    const engine = new RoomHostEngine(transport, options);
    engine.key = await deriveRoomKey(engine.pin, engine.salt);
    const { port, hosts, nearby } = await transport.start({
      onRequest: (request) => void engine.handleRequest(request),
      onStreamOpen: (stream) => void engine.handleStreamOpen(stream),
      onStreamClosed: (streamId) => engine.handleStreamClosed(streamId),
      onStopped: (reason) => engine.finish('error', reason),
    });
    engine.invite = { hosts, port, pin: engine.pin, name: engine.info.name, nearby };
    engine.uploadSweep = setInterval(() => engine.sweepUploads(), 30_000);
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
      { id: HOST_MEMBER_ID, name: this.profile.name, color: this.profile.color, isHost: true, status: 'active', online: true, joinedAt: this.createdAt, peerId: this.hostPeerId },
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
        peerId: member.peerId,
      });
    }
    return list;
  }

  /** Fotos visibles para un participante (el anfitrión ve también las de quienes esperan). */
  private avatarsFor(memberId: string): Record<string, string> {
    const avatars: Record<string, string> = {};
    if (this.profile.avatar) avatars[HOST_MEMBER_ID] = this.profile.avatar;
    for (const member of this.members.values()) {
      if (member.avatar && (member.status === 'active' || memberId === HOST_MEMBER_ID)) avatars[member.id] = member.avatar;
    }
    return avatars;
  }

  /** La foto de alguien que acaba de entrar viaja una sola vez a los demás (no en cada cambio). */
  private shareAvatar(member: HostMember): void {
    if (!member.avatar || member.status !== 'active') return;
    void this.broadcast({ type: 'avatars', avatars: { [member.id]: member.avatar } }, (m) => m.id !== member.id);
  }

  private snapshotFor(memberId: string): RoomSnapshot {
    return {
      info: this.info,
      rules: this.rules,
      members: this.memberList(memberId === HOST_MEMBER_ID),
      messages: this.messages.filter((m) => visibleTo(m, memberId)),
      selfId: memberId,
      avatars: this.avatarsFor(memberId),
    };
  }

  /** ¿Puede este participante recibir un privado? (el anfitrión o alguien activo). */
  private isRecipient(id: string): boolean {
    return id === HOST_MEMBER_ID || this.members.get(id)?.status === 'active';
  }

  /* ------------------------------------------------------------------ Envío por SSE */

  private async pushTo(member: HostMember, event: RoomEvent): Promise<void> {
    if (!this.key || member.streams.size === 0) return;
    const sealed = await sealJson(this.key, event);
    for (const streamId of member.streams) this.transport.push(streamId, sealed);
  }

  /** El mismo evento a varios: se cifra una sola vez. Sin filtro = todos los activos. */
  private async broadcast(event: RoomEvent, only?: (member: HostMember) => boolean): Promise<void> {
    if (!this.key) return;
    const targets = [...this.members.values()].filter((m) => m.status === 'active' && m.streams.size > 0 && (!only || only(m)));
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
    void this.broadcast({ type: 'message', message }, message.to ? (m) => visibleTo(message, m.id) : undefined);
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

  private storeItem(info: RoomItemInfo, blob: Blob, authorId: string, to?: string): RoomItemMeta {
    const id = randomToken(9);
    const meta: RoomItemMeta = { id, ...info, sizeBytes: blob.size };
    this.items.set(id, { meta, blob, authorId, to });
    this.itemBytes += blob.size;
    // Se descartan los más antiguos (Map conserva el orden de inserción)
    for (const [oldId, stored] of this.items) {
      if (this.itemBytes <= MAX_ITEM_STORE_BYTES || oldId === id) break;
      this.items.delete(oldId);
      this.itemBytes -= stored.blob.size;
    }
    return meta;
  }

  private publish(author: Author, text: string | undefined, item: RoomItemMeta | undefined, to: string | undefined): void {
    const clean = text?.trim().slice(0, ROOM_TEXT_MAX) || undefined;
    if (!clean && !item) return;
    this.addMessage({ id: randomToken(9), createdAt: Date.now(), authorId: author.id, authorName: author.name, authorColor: author.color, text: clean, item, to });
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
    if (!wire) return isOtherProtocolVersion(request.body) ? error(426, 'version') : error(400, 'bad-request');

    if (wire.op === 'hello') {
      const hello: HelloResponse = {
        app: 'agenda-universitaria',
        v: ROOM_PROTOCOL_VERSION,
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
    // La huella solo se acepta si la firma del dispositivo es válida para ESTA sala
    const peerId = request.identity ? ((await verifyIdentity(request.identity, this.salt, request.deviceId)) ?? undefined) : undefined;

    // El mismo dispositivo que vuelve (se cerró la app, cambió de red…): conserva su lugar
    const existing = [...this.members.values()].find((m) => m.deviceId === request.deviceId);
    if (existing) {
      existing.token = randomToken();
      existing.name = request.name;
      existing.color = request.color;
      const avatarChanged = existing.avatar !== request.avatar;
      existing.avatar = request.avatar;
      existing.peerId = peerId;
      this.membersChanged();
      if (avatarChanged) this.shareAvatar(existing);
      const result: JoinResult = { memberId: existing.id, token: existing.token };
      return json(200, { s: await sealJson(key, result) });
    }

    if (this.rules.locked) return error(423, 'locked');
    if (this.members.size + 1 >= ROOM_MAX_MEMBERS) return error(409, 'full');

    // Compañeros guardados por el anfitrión: sin sala de espera si así lo decidió
    const trusted = Boolean(peerId && this.rules.trustedAutoAdmit && this.isTrusted(peerId));
    const member: HostMember = {
      id: randomToken(9),
      name: request.name,
      color: request.color,
      deviceId: request.deviceId,
      token: randomToken(),
      status: this.rules.waitingRoom && !trusted ? 'pending' : 'active',
      joinedAt: now,
      streams: new Set(),
      avatar: request.avatar,
      peerId,
    };
    this.members.set(member.id, member);
    if (member.status === 'active') this.systemMessage(`${member.name} se unió a la sala`);
    this.membersChanged();
    this.shareAvatar(member);
    const result: JoinResult = { memberId: member.id, token: member.token };
    return json(200, { s: await sealJson(key, result) });
  }

  /** Reglas para publicar en el hilo (to vacío) o en un privado. null = permitido. */
  private postRule(member: HostMember, to: string | undefined, hasText: boolean, hasItem: boolean): RoomErrorCode | null {
    if (to) {
      if (!this.rules.privateChat) return 'rule';
      if (to === member.id || !this.isRecipient(to)) return 'not-found';
      return null;
    }
    if (this.rules.readOnly) return 'rule';
    if (hasText && !hasItem && !this.rules.textEnabled) return 'rule';
    return null;
  }

  private async call(memberId: string, sealed: string): Promise<HttpResult> {
    const key = this.key;
    if (!key) return error(410, 'gone');
    const member = this.members.get(memberId);
    if (!member) return error(410, 'gone');
    let request: ReturnType<typeof parseSealedCall>;
    try {
      request = parseSealedCall(await openJson(key, sealed));
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

    switch (call.op) {
      case 'post': {
        const rule = this.postRule(member, call.draft.to, true, false);
        if (rule) return error(rule === 'not-found' ? 404 : 403, rule);
        this.publish(member, call.draft.text, undefined, call.draft.to);
        return ok({ ok: true });
      }

      case 'uploadStart': {
        const rule = this.postRule(member, call.to, false, true);
        if (rule) return error(rule === 'not-found' ? 404 : 403, rule);
        if (call.size > ROOM_ITEM_MAX_BYTES) return error(413, 'too-large');
        const mine = [...this.uploads.values()].filter((u) => u.memberId === member.id).length;
        if (mine >= MAX_UPLOADS_PER_MEMBER) return error(429, 'too-many');
        const uploadId = randomToken(9);
        this.uploads.set(uploadId, { memberId: member.id, info: call.info, size: call.size, to: call.to, chunks: new Array(chunkCount(call.size)), received: 0, lastAt: Date.now() });
        return ok({ uploadId, chunkBytes: ROOM_CHUNK_BYTES });
      }

      case 'uploadChunk': {
        const upload = this.uploads.get(call.uploadId);
        if (!upload || upload.memberId !== member.id) return error(404, 'not-found');
        if (call.index >= upload.chunks.length) return error(400, 'bad-request');
        const bytes = base64StringToBytes(call.data);
        if (bytes.length !== expectedChunkBytes(upload.size, call.index)) return error(400, 'bad-request');
        if (!upload.chunks[call.index]) upload.received += 1;
        upload.chunks[call.index] = bytes;
        upload.lastAt = Date.now();
        return ok({ ok: true });
      }

      case 'uploadFinish': {
        const upload = this.uploads.get(call.uploadId);
        if (!upload || upload.memberId !== member.id) return error(404, 'not-found');
        if (upload.received !== upload.chunks.length) return error(400, 'bad-request');
        this.uploads.delete(call.uploadId);
        // Las reglas pudieron cambiar mientras subía
        const rule = this.postRule(member, upload.to, false, true);
        if (rule) return error(rule === 'not-found' ? 404 : 403, rule);
        const parts = upload.chunks.filter((c): c is Uint8Array<ArrayBuffer> => c !== undefined);
        const blob = new Blob(parts, { type: upload.info.mimeType || 'application/octet-stream' });
        const meta = this.storeItem(upload.info, blob, member.id, upload.to);
        const text = upload.to || this.rules.textEnabled ? call.text : undefined;
        this.publish(member, text, meta, upload.to);
        return ok({ itemId: meta.id });
      }

      case 'uploadCancel': {
        const upload = this.uploads.get(call.uploadId);
        if (upload && upload.memberId === member.id) this.uploads.delete(call.uploadId);
        return ok({ ok: true });
      }

      case 'fetchChunk': {
        const stored = this.items.get(call.itemId);
        if (!stored || !this.canRead(stored, member.id)) return error(404, 'not-found');
        if (call.index >= chunkCount(stored.blob.size)) return error(400, 'bad-request');
        const start = call.index * ROOM_CHUNK_BYTES;
        const bytes = new Uint8Array(await stored.blob.slice(start, start + ROOM_CHUNK_BYTES).arrayBuffer());
        return ok({ data: bytesToBase64String(bytes) });
      }
    }
  }

  private canRead(stored: StoredItem, memberId: string): boolean {
    return !stored.to || stored.to === memberId || stored.authorId === memberId;
  }

  private sweepUploads(): void {
    const limit = Date.now() - UPLOAD_IDLE_MS;
    for (const [id, upload] of this.uploads) if (upload.lastAt < limit) this.uploads.delete(id);
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
    for (const [id, upload] of this.uploads) if (upload.memberId === member.id) this.uploads.delete(id);
    const wasActive = member.status === 'active';
    this.members.delete(member.id);
    if (notice && wasActive) this.systemMessage(notice);
    this.membersChanged();
  }

  /* ------------------------------------------------------------------ Acciones del anfitrión */

  private get hostAuthor(): Author {
    return { id: HOST_MEMBER_ID, name: this.profile.name, color: this.profile.color };
  }

  /** Texto del anfitrión (siempre puede escribir, aunque haya desactivado el texto para los demás). */
  postText(draft: RoomPostDraft): void {
    if (this.ended) return;
    if (draft.to && !this.isRecipient(draft.to)) throw new Error('Esa persona ya no está en la sala.');
    this.publish(this.hostAuthor, draft.text, undefined, draft.to);
  }

  /** Elemento del anfitrión: queda en su memoria, sin viajar por la red hasta que alguien lo pide. */
  postItem(draft: RoomItemDraft, options: { text?: string; to?: string }): void {
    if (this.ended) return;
    if (draft.blob.size > ROOM_ITEM_MAX_BYTES) throw new Error('El elemento es demasiado pesado para la sala (máximo 300 MB).');
    if (options.to && !this.isRecipient(options.to)) throw new Error('Esa persona ya no está en la sala.');
    const { blob, ...info } = draft;
    const meta = this.storeItem(info, blob, HOST_MEMBER_ID, options.to);
    this.publish(this.hostAuthor, options.text, meta, options.to);
  }

  getItem(itemId: string): RoomReceivedItem {
    const stored = this.items.get(itemId);
    if (!stored || !this.canRead(stored, HOST_MEMBER_ID)) throw new Error('Ese elemento ya no está disponible en la sala.');
    return { meta: stored.meta, blob: stored.blob };
  }

  async approve(memberId: string): Promise<void> {
    const member = this.members.get(memberId);
    if (!member || member.status !== 'pending') return;
    member.status = 'active';
    this.systemMessage(`${member.name} se unió a la sala`);
    this.membersChanged();
    this.shareAvatar(member);
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
    if (this.uploadSweep) clearInterval(this.uploadSweep);
    this.members.clear();
    this.streamOwner.clear();
    this.items.clear();
    this.uploads.clear();
    void this.transport.stop().catch(() => undefined);
    this.endListener?.(reason, message);
  }
}
