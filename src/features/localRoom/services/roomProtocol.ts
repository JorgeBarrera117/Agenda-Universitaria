import { isPrivateIPv4 } from '../../transfer/services/transferProtocol';
import {
  ROOM_CHUNK_BYTES,
  ROOM_ITEM_KINDS,
  ROOM_ITEM_MAX_BYTES,
  ROOM_TEXT_MAX,
  type RoomInfo,
  type RoomInvite,
  type RoomItemInfo,
  type RoomItemKind,
  type RoomItemMeta,
  type RoomMember,
  type RoomMessage,
  type RoomPostDraft,
  type RoomRules,
  type RoomSnapshot,
} from '../types/room';

/**
 * Protocolo de la sala sobre HTTP en la red local.
 *
 *   POST /room/v1/rpc     cuerpo JSON (WireRequest). hello va en claro; join y call, cifrados.
 *   GET  /room/v1/events  Server-Sent Events: cada `data:` es un RoomEvent cifrado.
 *
 * Versión 2 (Fase 2): chats privados (mensajes con destinatario) y elementos por bloques de
 * 512 KB cifrados (uploadStart, uploadChunk…, uploadFinish; fetchChunk para descargar).
 *
 * Los servidores nativos (LocalRoomServer.java en Android y roomServer.cjs en Windows) no conocen
 * este formato: entregan cada petición y cada conexión de eventos a la interfaz, que es donde vive
 * el motor del anfitrión (roomHostEngine.ts). Así hay una sola implementación de las reglas.
 */

export const ROOM_BASE_PATH = '/room/v1';
export const ROOM_PROTOCOL_VERSION = 2;
const INVITE_PREFIX = 'agenda-room://v1?';

/* --------------------------------------------------------------------------------- Invitación */

export function buildRoomInviteText(invite: RoomInvite): string {
  const params = new URLSearchParams();
  params.set('h', invite.hosts.join(','));
  params.set('p', String(invite.port));
  params.set('pin', invite.pin);
  if (invite.name) params.set('n', invite.name.slice(0, 40));
  return INVITE_PREFIX + params.toString();
}

function isValidHost(host: string): boolean {
  return isPrivateIPv4(host) || host === 'dev' || host === 'nearby';
}

function isValidPin(pin: string): boolean {
  return /^(\d{4}|\d{6})$/.test(pin);
}

export function parseRoomInviteText(text: string): RoomInvite | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(INVITE_PREFIX)) return null;
  const params = new URLSearchParams(trimmed.slice(INVITE_PREFIX.length));
  const hosts = (params.get('h') ?? '').split(',').map((h) => h.trim()).filter(isValidHost).slice(0, 4);
  const port = Number(params.get('p'));
  const pin = params.get('pin') ?? '';
  if (hosts.length === 0 || !Number.isInteger(port) || port < 0 || port > 65535 || !isValidPin(pin)) return null;
  const name = params.get('n')?.slice(0, 40) || undefined;
  return { hosts, port, pin, name };
}

/** «192.168.1.20:43210» escrito a mano + PIN. */
export function parseManualInvite(address: string, pin: string): RoomInvite | null {
  const match = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s*:\s*(\d{1,5})\s*$/.exec(address);
  if (!match || !isValidPin(pin.trim())) return null;
  const port = Number(match[2]);
  if (!isPrivateIPv4(match[1]) || port < 1 || port > 65535) return null;
  return { hosts: [match[1]], port, pin: pin.trim() };
}

export function rpcUrl(host: string, port: number): string {
  return `http://${host}:${port}${ROOM_BASE_PATH}/rpc`;
}

export function eventsUrl(host: string, port: number, memberId: string, proof: string): string {
  return `http://${host}:${port}${ROOM_BASE_PATH}/events?m=${encodeURIComponent(memberId)}&t=${encodeURIComponent(proof)}`;
}

/* --------------------------------------------------------------------------------- Mensajes */

export type WireRequest =
  | { v: 2; op: 'hello' }
  | { v: 2; op: 'join'; s: string }
  | { v: 2; op: 'call'; m: string; s: string };

export interface HelloResponse {
  app: 'agenda-universitaria';
  /** Versión del protocolo del anfitrión. */
  v: number;
  room: string;
  host: string;
  salt: string;
  pinLength: 4 | 6;
  locked: boolean;
}

export interface JoinRequest {
  name: string;
  color: string;
  deviceId: string;
}

export interface JoinResult {
  memberId: string;
  token: string;
}

export type RoomCall =
  | { op: 'post'; draft: RoomPostDraft }
  | { op: 'uploadStart'; info: RoomItemInfo; size: number; to?: string }
  | { op: 'uploadChunk'; uploadId: string; index: number; data: string }
  | { op: 'uploadFinish'; uploadId: string; text?: string }
  | { op: 'uploadCancel'; uploadId: string }
  | { op: 'fetchChunk'; itemId: string; index: number }
  | { op: 'leave' };

/** Cantidad de bloques de un contenido de size bytes (al menos uno). */
export function chunkCount(size: number): number {
  return Math.max(1, Math.ceil(size / ROOM_CHUNK_BYTES));
}

/** Petición cifrada de un participante: su token prueba quién es. */
export interface SealedCall {
  token: string;
  call: RoomCall;
}

export type RoomEndEventReason = 'closed' | 'kicked' | 'rejected';

export type RoomEvent =
  | { type: 'waiting'; info: RoomInfo }
  | { type: 'snapshot'; snapshot: RoomSnapshot }
  | { type: 'message'; message: RoomMessage }
  | { type: 'members'; members: RoomMember[] }
  | { type: 'rules'; rules: RoomRules }
  | { type: 'end'; reason: RoomEndEventReason };

/** Códigos de error de la sala (en el cuerpo de respuestas no 200). */
export type RoomErrorCode = 'pin' | 'locked' | 'full' | 'blocked' | 'too-many' | 'auth' | 'gone' | 'rule' | 'bad-request' | 'not-found' | 'too-large' | 'version';

export const ROOM_ERROR_MESSAGES: Record<RoomErrorCode, string> = {
  pin: 'El PIN no es correcto.',
  locked: 'El anfitrión cerró la entrada a la sala.',
  full: 'La sala está llena.',
  blocked: 'El anfitrión no te permite volver a esta sala.',
  'too-many': 'Demasiados intentos con un PIN equivocado. Espera un minuto.',
  auth: 'Ya no formas parte de esta sala.',
  gone: 'Ya no formas parte de esta sala.',
  rule: 'El anfitrión no lo permite ahora.',
  'bad-request': 'La sala no entendió la petición.',
  'not-found': 'Ese elemento ya no está disponible en la sala.',
  'too-large': 'El elemento es demasiado pesado para la sala (máximo 300 MB).',
  version: 'La sala usa otra versión de la app. Actualicen los dos dispositivos a la misma versión.',
};

/* --------------------------------------------------------------------------------- Validación */
// Lo que llega por la red se revisa campo por campo: aunque venga cifrado con la clave de la sala,
// lo pudo armar cualquier participante.

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  // Sin caracteres de control (salvo tabulador y saltos de línea)
  let clean = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) clean += char;
  }
  clean = clean.trim();
  return clean ? clean.slice(0, max) : undefined;
}

function color(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#5b6b8c';
}

function isKind(value: unknown): value is RoomItemKind {
  return typeof value === 'string' && (ROOM_ITEM_KINDS as readonly string[]).includes(value);
}

export function parseWireRequest(raw: string): WireRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== ROOM_PROTOCOL_VERSION) return null;
  if (parsed.op === 'hello') return { v: 2, op: 'hello' };
  if (parsed.op === 'join' && typeof parsed.s === 'string') return { v: 2, op: 'join', s: parsed.s };
  if (parsed.op === 'call' && typeof parsed.s === 'string' && typeof parsed.m === 'string') return { v: 2, op: 'call', m: parsed.m, s: parsed.s };
  return null;
}

/** Petición de un cliente con otra versión del protocolo (para avisar en vez de fallar en silencio). */
export function isOtherProtocolVersion(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) && typeof parsed.v === 'number' && parsed.v !== ROOM_PROTOCOL_VERSION;
  } catch {
    return false;
  }
}

export function parseJoinRequest(value: unknown): JoinRequest | null {
  if (!isRecord(value)) return null;
  const name = text(value.name, 40);
  const deviceId = text(value.deviceId, 64);
  if (!name || !deviceId) return null;
  return { name, color: color(value.color), deviceId };
}

export function parseItemInfo(value: unknown): RoomItemInfo | null {
  if (!isRecord(value) || !isKind(value.kind)) return null;
  const title = text(value.title, 120);
  if (!title) return null;
  return {
    kind: value.kind,
    title,
    subtitle: text(value.subtitle, 160),
    fileName: text(value.fileName, 160),
    mimeType: text(value.mimeType, 120),
    subjectName: text(value.subjectName, 120),
  };
}

function shortId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : undefined;
}

function chunkIndex(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 100_000 ? value : undefined;
}

/** Un bloque en base64 no puede pasar de ROOM_CHUNK_BYTES una vez decodificado. */
const MAX_CHUNK_BASE64 = Math.ceil(ROOM_CHUNK_BYTES / 3) * 4;

export function parseSealedCall(value: unknown): SealedCall | null {
  if (!isRecord(value) || typeof value.token !== 'string' || !isRecord(value.call)) return null;
  const token = value.token;
  const call = value.call;
  switch (call.op) {
    case 'leave':
      return { token, call: { op: 'leave' } };
    case 'post': {
      if (!isRecord(call.draft)) return null;
      const draftText = typeof call.draft.text === 'string' ? call.draft.text.trim().slice(0, ROOM_TEXT_MAX) : '';
      const draftTo = shortId(call.draft.to);
      if (!draftText || (call.draft.to !== undefined && !draftTo)) return null;
      return { token, call: { op: 'post', draft: { text: draftText, to: draftTo } } };
    }
    case 'uploadStart': {
      const info = parseItemInfo(call.info);
      const size = call.size;
      const to = shortId(call.to);
      if (!info || typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > ROOM_ITEM_MAX_BYTES) return null;
      if (call.to !== undefined && !to) return null;
      return { token, call: { op: 'uploadStart', info, size, to } };
    }
    case 'uploadChunk': {
      const uploadId = shortId(call.uploadId);
      const i = chunkIndex(call.index);
      if (!uploadId || i === undefined || typeof call.data !== 'string' || call.data.length === 0 || call.data.length > MAX_CHUNK_BASE64) return null;
      return { token, call: { op: 'uploadChunk', uploadId, index: i, data: call.data } };
    }
    case 'uploadFinish': {
      const uploadId = shortId(call.uploadId);
      if (!uploadId) return null;
      const finishText = typeof call.text === 'string' ? call.text.trim().slice(0, ROOM_TEXT_MAX) : '';
      return { token, call: { op: 'uploadFinish', uploadId, text: finishText || undefined } };
    }
    case 'uploadCancel': {
      const uploadId = shortId(call.uploadId);
      return uploadId ? { token, call: { op: 'uploadCancel', uploadId } } : null;
    }
    case 'fetchChunk': {
      const itemId = shortId(call.itemId);
      const i = chunkIndex(call.index);
      return itemId && i !== undefined ? { token, call: { op: 'fetchChunk', itemId, index: i } } : null;
    }
    default:
      return null;
  }
}

function parseRules(value: unknown): RoomRules | null {
  if (!isRecord(value)) return null;
  const { waitingRoom, locked, readOnly, textEnabled, privateChat } = value;
  if (typeof waitingRoom !== 'boolean' || typeof locked !== 'boolean' || typeof readOnly !== 'boolean' || typeof textEnabled !== 'boolean' || typeof privateChat !== 'boolean') return null;
  return { waitingRoom, locked, readOnly, textEnabled, privateChat };
}

function parseInfo(value: unknown): RoomInfo | null {
  if (!isRecord(value)) return null;
  const name = text(value.name, 60);
  const hostName = text(value.hostName, 40);
  if (!name || !hostName) return null;
  return { name, hostName, pinLength: value.pinLength === 6 ? 6 : 4 };
}

function parseMember(value: unknown): RoomMember | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const name = text(value.name, 40);
  if (!name) return null;
  return {
    id: value.id,
    name,
    color: color(value.color),
    isHost: value.isHost === true,
    status: value.status === 'pending' ? 'pending' : 'active',
    online: value.online === true,
    joinedAt: typeof value.joinedAt === 'number' ? value.joinedAt : 0,
  };
}

function parseItemMeta(value: unknown): RoomItemMeta | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || !isKind(value.kind)) return undefined;
  const title = text(value.title, 120);
  if (!title) return undefined;
  return {
    id: value.id,
    kind: value.kind,
    title,
    subtitle: text(value.subtitle, 160),
    sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : 0,
    fileName: text(value.fileName, 160),
    mimeType: text(value.mimeType, 120),
    subjectName: text(value.subjectName, 120),
  };
}

function parseMessage(value: unknown): RoomMessage | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.authorId !== 'string') return null;
  const message: RoomMessage = {
    id: value.id,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    authorId: value.authorId,
    authorName: text(value.authorName, 40) ?? 'Participante',
    authorColor: color(value.authorColor),
    system: value.system === true || undefined,
    text: text(value.text, ROOM_TEXT_MAX + 80),
    item: parseItemMeta(value.item),
    to: shortId(value.to),
  };
  return message.text || message.item ? message : null;
}

function parseList<T>(value: unknown, parse: (item: unknown) => T | null | undefined): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const entry of value) {
    const parsed = parse(entry);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function parseRoomEvent(value: unknown): RoomEvent | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'waiting': {
      const info = parseInfo(value.info);
      return info ? { type: 'waiting', info } : null;
    }
    case 'snapshot': {
      const s = value.snapshot;
      if (!isRecord(s) || typeof s.selfId !== 'string') return null;
      const info = parseInfo(s.info);
      const rules = parseRules(s.rules);
      if (!info || !rules) return null;
      return {
        type: 'snapshot',
        snapshot: { info, rules, selfId: s.selfId, members: parseList(s.members, parseMember), messages: parseList(s.messages, parseMessage) },
      };
    }
    case 'message': {
      const message = parseMessage(value.message);
      return message ? { type: 'message', message } : null;
    }
    case 'members':
      return { type: 'members', members: parseList(value.members, parseMember) };
    case 'rules': {
      const rules = parseRules(value.rules);
      return rules ? { type: 'rules', rules } : null;
    }
    case 'end':
      return value.reason === 'kicked' || value.reason === 'rejected' ? { type: 'end', reason: value.reason } : { type: 'end', reason: 'closed' };
    default:
      return null;
  }
}

export function parseHelloResponse(raw: string): HelloResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.app !== 'agenda-universitaria' || typeof parsed.salt !== 'string') return null;
  return {
    app: 'agenda-universitaria',
    v: typeof parsed.v === 'number' ? parsed.v : 1,
    room: text(parsed.room, 60) ?? 'Sala',
    host: text(parsed.host, 40) ?? 'Anfitrión',
    salt: parsed.salt,
    pinLength: parsed.pinLength === 6 ? 6 : 4,
    locked: parsed.locked === true,
  };
}

export function errorCodeOf(raw: string): RoomErrorCode | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && typeof parsed.error === 'string' && parsed.error in ROOM_ERROR_MESSAGES) return parsed.error as RoomErrorCode;
  } catch {
    // Respuesta que no es JSON
  }
  return null;
}

/* --------------------------------------------------------------------------------- Transportes */

export interface HostRequest {
  id: string;
  body: string;
  remote: string;
}

export interface HostStreamOpen {
  streamId: string;
  /** Lo que va después de «?» en la URL de eventos. */
  query: string;
  remote: string;
}

export interface HostTransportHandlers {
  onRequest: (request: HostRequest) => void;
  onStreamOpen: (stream: HostStreamOpen) => void;
  onStreamClosed: (streamId: string) => void;
  /** El servidor se cayó (p. ej. se apagó el wifi). */
  onStopped: (reason: string) => void;
}

/** Servidor de la red local, puente fino hacia el motor del anfitrión. */
export interface HostTransport {
  /** hosts vacío = sin red local (solo cercanía). nearby = también se anuncia por cercanía. */
  start: (handlers: HostTransportHandlers) => Promise<{ port: number; hosts: string[]; nearby?: boolean }>;
  stop: () => Promise<void>;
  respond: (requestId: string, status: number, body: string) => void;
  push: (streamId: string, data: string) => void;
  closeStream: (streamId: string) => void;
}

export interface GuestStreamHandlers {
  onData: (data: string) => void;
  onEnd: (error?: string) => void;
}

/** Cliente HTTP y SSE del invitado (nativo: la interfaz no puede abrir http:// de la red local). */
export interface GuestTransport {
  request: (url: string, body: string, timeoutMs: number) => Promise<{ status: number; body: string }>;
  openStream: (url: string, handlers: GuestStreamHandlers) => Promise<() => void>;
  /** Cierra el canal al salir (por cercanía: desconecta del anfitrión). */
  dispose?: () => void;
}
