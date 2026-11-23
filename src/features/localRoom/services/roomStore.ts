import type {
  RoomEndReason,
  RoomInfo,
  RoomInvite,
  RoomItemDraft,
  RoomItemMeta,
  RoomPostDraft,
  RoomProfile,
  RoomReceivedItem,
  RoomRules,
  RoomSnapshot,
  RoomTransfer,
} from '../types/room';
import { liveQuery } from 'dexie';
import { loadRoomIdentity, randomToken } from './roomCrypto';
import { roomContactRepository } from '../repositories/roomContactRepository';
import { RoomGuestClient, RoomTransferCancelled } from './roomGuestClient';
import { RoomHostEngine } from './roomHostEngine';
import { ROOM_ITEM_LABEL, assertRoomItemSize } from './roomItems';
import { endRoomPresence, initRoomPresenceListeners, notifyRoomActivity, updateRoomPresence } from './roomPresence';
import type { RoomMessage } from '../types/room';
import { createGuestTransport, createHostTransport } from './roomTransports';
import { combineHostTransports } from './nearbyLink';
import { createNearbyGuestTransport, createNearbyHostTransport, type NearbyRoom } from './nearbyTransports';

/**
 * Estado global de la sala para este dispositivo (una sola sala a la vez). Vive fuera de React
 * para que la sala siga abierta al cambiar de sección o cerrar la pantalla de la sala; la interfaz
 * lo lee con useLocalRoom (useSyncExternalStore).
 */

export type RoomSession =
  | { phase: 'idle' }
  | { phase: 'starting'; role: 'host' | 'guest' }
  | { phase: 'waiting'; info: RoomInfo; connection: 'online' | 'reconnecting' }
  | { phase: 'active'; role: 'host'; snapshot: RoomSnapshot; invite: RoomInvite; connection: 'online' }
  | { phase: 'active'; role: 'guest'; snapshot: RoomSnapshot; connection: 'online' | 'reconnecting' }
  | { phase: 'ended'; reason: RoomEndReason; message: string };

export interface RoomStoreState {
  session: RoomSession;
  /** Mensajes nuevos del hilo que todavía no se vieron (pantalla cerrada o en un chat privado). */
  unread: number;
  /** Mensajes privados sin leer, por compañero (id del participante). */
  privateUnread: Readonly<Record<string, number>>;
  screenOpen: boolean;
  /** Chat privado abierto (id del compañero) o null para el hilo de la sala. */
  activeChat: string | null;
  /** Elementos que este dispositivo ya guardó en su agenda (id del elemento). */
  saved: ReadonlySet<string>;
  /** Subidas y descargas en curso o con error, por id de transferencia. */
  transfers: Readonly<Record<string, RoomTransfer>>;
}

const PROFILE_KEY = 'agenda_room_profile_v1';
const DEVICE_KEY = 'agenda_room_device_id_v1';
const DEFAULT_NAME = 'Estudiante';
/** Cada cuánto se repinta una barra de progreso (no en cada bloque). */
const PROGRESS_THROTTLE_MS = 150;
export const ROOM_PROFILE_COLORS = ['#1e6bd6', '#0f8a6d', '#b3261e', '#8e44ad', '#c76a00', '#00838f', '#6d4c41', '#3f51b5'] as const;

const INITIAL: RoomStoreState = {
  session: { phase: 'idle' },
  unread: 0,
  privateUnread: {},
  screenOpen: false,
  activeChat: null,
  saved: new Set(),
  transfers: {},
};

let state: RoomStoreState = INITIAL;
const listeners = new Set<() => void>();
let engine: RoomHostEngine | null = null;
let client: RoomGuestClient | null = null;
let detach: (() => void) | null = null;
/** Mensajes ya contados (para no volver a sumarlos como no leídos). null = aún no llegó el primer estado. */
let seenMessages: Set<string> | null = null;
const controllers = new Map<string, AbortController>();
/** Compañeros guardados del anfitrión (entran sin sala de espera si la regla lo permite). */
let trustedPeers = new Set<string>();
let trustedWatch: { unsubscribe: () => void } | null = null;

function emit(next: Partial<RoomStoreState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribeRoomStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRoomStoreState(): RoomStoreState {
  return state;
}

/* ------------------------------------------------------------------ Perfil y dispositivo */

/**
 * Nombre en la sala: el que el estudiante escribió a mano en la sala o, si no lo cambió, el de su
 * perfil (Ajustes → Mi perfil). Así en la PC no queda «Estudiante» si el perfil tiene nombre.
 */
export function loadRoomProfile(studentName: string): RoomProfile {
  const fromProfile = studentName.trim().slice(0, 40);
  let stored: { name: string; color: string; custom: boolean } | null = null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed === 'object' && parsed !== null && 'name' in parsed && 'color' in parsed) {
      const { name, color } = parsed as { name: unknown; color: unknown };
      const custom = 'custom' in parsed ? (parsed as { custom: unknown }).custom === true : typeof name === 'string' && name.trim() !== DEFAULT_NAME;
      if (typeof name === 'string' && typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) stored = { name: name.trim().slice(0, 40), color, custom };
    }
  } catch {
    // Sin almacenamiento: perfil por defecto
  }
  const name = stored?.custom && stored.name ? stored.name : fromProfile || stored?.name || DEFAULT_NAME;
  return { name, color: stored?.color ?? ROOM_PROFILE_COLORS[0] };
}

export function saveRoomProfile(profile: RoomProfile, studentName: string): void {
  try {
    const name = profile.name.trim().slice(0, 40);
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, color: profile.color, custom: name !== studentName.trim() }));
  } catch {
    // Se usa solo en esta sesión
  }
}

function deviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const created = randomToken(16);
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return randomToken(16);
  }
}

/* ------------------------------------------------------------------ Sincronización con el motor/cliente */

/** Suma como no leído lo nuevo de otros que no se está viendo ahora mismo. */
function countUnread(snapshot: RoomSnapshot): Pick<RoomStoreState, 'unread' | 'privateUnread'> {
  let unread = state.unread;
  let privateUnread = state.privateUnread;
  if (!seenMessages) {
    // Primer estado (al entrar): el hilo anterior no cuenta como nuevo, pero los privados que ya
    // me escribieron (p. ej. el anfitrión al aceptarme) sí están sin leer
    seenMessages = new Set(snapshot.messages.map((m) => m.id));
    for (const message of snapshot.messages) {
      if (!message.to || message.to !== snapshot.selfId || message.authorId === snapshot.selfId) continue;
      if (!(state.screenOpen && state.activeChat === message.authorId)) {
        privateUnread = { ...privateUnread, [message.authorId]: (privateUnread[message.authorId] ?? 0) + 1 };
      }
    }
    return { unread, privateUnread };
  }
  for (const message of snapshot.messages) {
    if (seenMessages.has(message.id)) continue;
    seenMessages.add(message.id);
    if (message.system || message.authorId === snapshot.selfId) continue;
    // Fuera de la app: aviso nativo (Android en segundo plano / Windows sin foco)
    notifyRoomActivity(noticeFor(message, snapshot));
    if (message.to) {
      const peer = message.authorId;
      if (!(state.screenOpen && state.activeChat === peer)) privateUnread = { ...privateUnread, [peer]: (privateUnread[peer] ?? 0) + 1 };
    } else if (!(state.screenOpen && state.activeChat === null)) {
      unread += 1;
    }
  }
  return { unread, privateUnread };
}

/** Texto del aviso de un mensaje de otro participante. */
function noticeFor(message: RoomMessage, snapshot: RoomSnapshot): { key: string; title: string; body: string; chat?: string } {
  const isPrivate = Boolean(message.to);
  const item = message.item;
  const itemText = item ? `${isPrivate ? 'Te envió' : 'Compartió'} ${ROOM_ITEM_LABEL[item.kind].toLowerCase()}: ${item.title}` : '';
  const body = [itemText, message.text ?? ''].filter(Boolean).join(' · ') || 'Nuevo mensaje';
  return isPrivate
    ? { key: `chat:${message.authorId}`, title: `${message.authorName} · Chat privado`, body, chat: message.authorId }
    : { key: 'room', title: `${message.authorName} · ${snapshot.info.name}`, body };
}

/** Notificación persistente: sala, conectados y rol. */
function presenceFor(snapshot: RoomSnapshot, isHost: boolean): void {
  const online = snapshot.members.filter((m) => m.status === 'active' && m.online).length;
  const people = `${online} ${online === 1 ? 'conectado' : 'conectados'}`;
  updateRoomPresence({
    roomName: snapshot.info.name,
    subtitle: isHost ? `Eres el anfitrión · ${people}` : `${people} · Anfitrión: ${snapshot.info.hostName}`,
    isHost,
  });
}

function syncFromEngine(): void {
  const view = engine?.getView();
  if (!view) return;
  emit({ session: { phase: 'active', role: 'host', snapshot: view.snapshot, invite: view.invite, connection: 'online' }, ...countUnread(view.snapshot) });
  presenceFor(view.snapshot, true);
}

function syncFromClient(): void {
  if (!client) return;
  const guest = client.getState();
  if (guest.phase === 'ended') return; // lo resuelve onEnd con su mensaje
  if (guest.phase === 'waiting' || !guest.snapshot) {
    emit({ session: { phase: 'waiting', info: guest.info, connection: guest.connection } });
    updateRoomPresence({ roomName: guest.info.name, subtitle: 'Esperando a que el anfitrión te acepte', isHost: false });
    return;
  }
  emit({ session: { phase: 'active', role: 'guest', snapshot: guest.snapshot, connection: guest.connection }, ...countUnread(guest.snapshot) });
  presenceFor(guest.snapshot, false);
}

/** Aviso fuera de la app cuando la sala termina sin que este dispositivo lo haya pedido. */
const END_NOTICES: Partial<Record<RoomEndReason, { title: string; body: string }>> = {
  closed: { title: 'La sala se ha cerrado', body: 'El anfitrión finalizó la sesión' },
  kicked: { title: 'Ya no estás en la sala', body: 'El anfitrión te retiró de la sala' },
  rejected: { title: 'No te aceptaron en la sala', body: 'El anfitrión no aceptó tu solicitud' },
  lost: { title: 'Se perdió la conexión con la sala', body: 'Vuelve a entrar cuando estés cerca del anfitrión' },
};

/** Las notificaciones (persistente y de mensajes) devuelven acciones a la sala. */
function listenToNotifications(): void {
  initRoomPresenceListeners({
    onLeave: () => void leaveRoom().catch(() => undefined),
    onOpen: (chat) => {
      setRoomScreenOpen(true);
      const snapshot = state.session.phase === 'active' ? state.session.snapshot : null;
      setActiveChat(chat && snapshot?.members.some((m) => m.id === chat) ? chat : null);
    },
  });
}

function resetRoomState(): Partial<RoomStoreState> {
  for (const controller of controllers.values()) controller.abort();
  controllers.clear();
  seenMessages = null;
  return { unread: 0, privateUnread: {}, activeChat: null, saved: new Set(), transfers: {} };
}

function ended(reason: RoomEndReason, message: string): void {
  // El anfitrión que cierra (o el invitado que sale) no necesita aviso; los demás, sí
  const wasHost = engine !== null;
  endRoomPresence(wasHost ? undefined : END_NOTICES[reason]);
  detach?.();
  detach = null;
  trustedWatch?.unsubscribe();
  trustedWatch = null;
  engine = null;
  client = null;
  emit({ session: { phase: 'ended', reason, message }, ...resetRoomState() });
}

/* ------------------------------------------------------------------ Entrar y salir */

export interface CreateRoomOptions {
  roomName: string;
  pinLength: 4 | 6;
  profile: RoomProfile;
  rules: Partial<RoomRules>;
  /** Android: anunciar la sala también por cercanía (Bluetooth / Wi-Fi Direct). */
  nearby?: boolean;
}

function busy(): boolean {
  return state.session.phase === 'active' || state.session.phase === 'waiting' || state.session.phase === 'starting';
}

export async function createRoom(options: CreateRoomOptions): Promise<void> {
  if (busy()) return;
  listenToNotifications();
  emit({ session: { phase: 'starting', role: 'host' }, ...resetRoomState() });
  try {
    const roomName = options.roomName.trim() || 'Sala de clase';
    const identity = await loadRoomIdentity();
    // Lista de confianza en vivo: si el anfitrión guarda a alguien durante la sala, vale de inmediato
    trustedPeers = await roomContactRepository.peerIds();
    trustedWatch = liveQuery(() => roomContactRepository.peerIds()).subscribe({ next: (ids) => (trustedPeers = ids), error: () => undefined });
    const transport = options.nearby
      ? combineHostTransports(createHostTransport(), createNearbyHostTransport(roomName, options.profile.name, identity.peerId))
      : createHostTransport();
    const created = await RoomHostEngine.open(transport, { ...options, peerId: identity.peerId, isTrusted: (peerId) => trustedPeers.has(peerId) });
    engine = created;
    detach = created.subscribe(syncFromEngine);
    created.onEnd((reason, message) =>
      ended(reason === 'closed' ? 'closed' : 'error', reason === 'closed' ? 'Cerraste la sala para todos.' : `La sala se cerró: ${message ?? 'se perdió la red local'}.`)
    );
    syncFromEngine();
  } catch (error) {
    trustedWatch?.unsubscribe();
    trustedWatch = null;
    emit({ session: { phase: 'idle' } });
    throw error;
  }
}

export async function joinRoom(invite: RoomInvite, profile: RoomProfile): Promise<void> {
  if (busy()) return;
  listenToNotifications();
  emit({ session: { phase: 'starting', role: 'guest' }, ...resetRoomState() });
  try {
    const joined = await RoomGuestClient.connect(createGuestTransport(), invite, profile, deviceId(), await loadRoomIdentity());
    client = joined;
    detach = joined.subscribe(syncFromClient);
    joined.onEnd((reason, message) => ended(reason, message ?? (reason === 'left' ? 'Saliste de la sala.' : 'La sala terminó.')));
    syncFromClient();
  } catch (error) {
    emit({ session: { phase: 'idle' } });
    throw error;
  }
}

/** Entrar a una sala encontrada en «Salas cercanas» (sin red wifi), con su PIN. */
export async function joinNearbyRoom(room: NearbyRoom, pin: string, profile: RoomProfile): Promise<void> {
  if (busy()) return;
  listenToNotifications();
  emit({ session: { phase: 'starting', role: 'guest' }, ...resetRoomState() });
  const transport = createNearbyGuestTransport(room.endpointId, profile.name);
  try {
    const joined = await RoomGuestClient.connect(transport, { hosts: ['nearby'], port: 0, pin, name: room.roomName }, profile, deviceId(), await loadRoomIdentity());
    client = joined;
    detach = joined.subscribe(syncFromClient);
    joined.onEnd((reason, message) => ended(reason, message ?? (reason === 'left' ? 'Saliste de la sala.' : 'La sala terminó.')));
    syncFromClient();
  } catch (error) {
    transport.dispose();
    emit({ session: { phase: 'idle' } });
    throw error;
  }
}

/** Invitado: salir. Anfitrión: equivale a cerrar la sala para todos. */
export async function leaveRoom(): Promise<void> {
  if (engine) {
    await engine.close();
    return;
  }
  if (client) await client.leave();
}

export function dismissRoomEnd(): void {
  if (state.session.phase === 'ended') emit({ session: { phase: 'idle' } });
}

/* ------------------------------------------------------------------ Publicar */

/** Texto en el hilo o, con draft.to, en un chat privado. */
export async function postToRoom(draft: RoomPostDraft): Promise<void> {
  if (engine) return engine.postText(draft);
  if (client) return client.post(draft);
  throw new Error('No estás en una sala.');
}

/* ------------------------------------------------------------------ Transferencias */

function setTransfer(id: string, patch: Partial<RoomTransfer> | null, base?: RoomTransfer): void {
  const transfers = { ...state.transfers };
  if (patch === null) delete transfers[id];
  else {
    const current = transfers[id] ?? base;
    if (!current) return;
    transfers[id] = { ...current, ...patch };
  }
  emit({ transfers });
}

/** Avance con velocidad promedio; se repinta como mucho cada PROGRESS_THROTTLE_MS. */
function progressReporter(id: string): (doneBytes: number) => void {
  const startedAt = performance.now();
  let lastPaint = 0;
  return (doneBytes) => {
    const now = performance.now();
    const current = state.transfers[id];
    if (!current || current.status !== 'running') return;
    if (now - lastPaint < PROGRESS_THROTTLE_MS && doneBytes < current.totalBytes) return;
    lastPaint = now;
    const seconds = Math.max((now - startedAt) / 1000, 0.001);
    setTransfer(id, { doneBytes, bytesPerSecond: doneBytes / seconds });
  };
}

function transferError(err: unknown): string {
  return err instanceof Error ? err.message : 'La transferencia falló.';
}

/**
 * Comparte un elemento en el hilo o en un privado (options.to).
 * - Anfitrión: queda en su memoria al instante.
 * - Invitado: se sube por bloques en segundo plano; su tarjeta muestra el progreso y se puede cancelar.
 */
export function shareItem(draft: RoomItemDraft, options: { text?: string; to?: string }): void {
  assertRoomItemSize(draft);
  if (engine) {
    engine.postItem(draft, options);
    return;
  }
  const guest = client;
  if (!guest) throw new Error('No estás en una sala.');
  const id = `up:${randomToken(6)}`;
  const { blob, ...info } = draft;
  const controller = new AbortController();
  controllers.set(id, controller);
  setTransfer(id, {}, { id, direction: 'up', info, chat: options.to ?? null, totalBytes: blob.size, doneBytes: 0, bytesPerSecond: 0, status: 'running' });
  void guest
    .uploadItem(draft, options, progressReporter(id), controller.signal)
    .then(() => setTransfer(id, null))
    .catch((err: unknown) => setTransfer(id, err instanceof RoomTransferCancelled ? null : { status: 'error', error: transferError(err) }))
    .finally(() => controllers.delete(id));
}

/** Id de la transferencia de descarga de un elemento (para mostrar su progreso en la tarjeta). */
export function downloadTransferId(itemId: string): string {
  return `down:${itemId}`;
}

/**
 * Trae un elemento para guardarlo. Del anfitrión es inmediato; un invitado lo descarga por
 * bloques con progreso. Lanza RoomTransferCancelled si el usuario cancela.
 */
export async function downloadRoomItem(meta: RoomItemMeta): Promise<RoomReceivedItem> {
  if (engine) return engine.getItem(meta.id);
  const guest = client;
  if (!guest) throw new Error('No estás en una sala.');
  const id = downloadTransferId(meta.id);
  if (state.transfers[id]?.status === 'running') throw new Error('Ya se está descargando.');
  const controller = new AbortController();
  controllers.set(id, controller);
  setTransfer(id, {}, { id, direction: 'down', itemId: meta.id, chat: null, totalBytes: meta.sizeBytes, doneBytes: 0, bytesPerSecond: 0, status: 'running' });
  try {
    const blob = await guest.downloadItem(meta, progressReporter(id), controller.signal);
    setTransfer(id, null);
    return { meta, blob };
  } catch (err) {
    setTransfer(id, err instanceof RoomTransferCancelled ? null : { status: 'error', error: transferError(err) });
    throw err;
  } finally {
    controllers.delete(id);
  }
}

/** Cancela una transferencia en curso, o descarta el aviso de una que falló. */
export function cancelTransfer(id: string): void {
  const controller = controllers.get(id);
  if (controller) controller.abort();
  else setTransfer(id, null);
}

export function markRoomItemSaved(itemId: string): void {
  const saved = new Set(state.saved);
  saved.add(itemId);
  emit({ saved });
}

/* ------------------------------------------------------------------ Pantalla y chats */

export function setRoomScreenOpen(open: boolean): void {
  if (!open) {
    emit({ screenOpen: false });
    return;
  }
  const chat = state.activeChat;
  emit(chat ? { screenOpen: true, privateUnread: { ...state.privateUnread, [chat]: 0 } } : { screenOpen: true, unread: 0 });
}

/** Abre un chat privado (id del compañero) o vuelve al hilo de la sala (null). */
export function setActiveChat(peerId: string | null): void {
  if (peerId) emit({ activeChat: peerId, privateUnread: { ...state.privateUnread, [peerId]: 0 } });
  else emit({ activeChat: null, unread: state.screenOpen ? 0 : state.unread });
}

export function totalPrivateUnread(privateUnread: Readonly<Record<string, number>>): number {
  return Object.values(privateUnread).reduce((sum, n) => sum + n, 0);
}

/* ------------------------------------------------------------------ Moderación (solo anfitrión) */

export const roomModeration = {
  approve: (memberId: string) => void engine?.approve(memberId),
  reject: (memberId: string) => void engine?.reject(memberId),
  kick: (memberId: string) => void engine?.kick(memberId),
  setRules: (patch: Partial<RoomRules>) => engine?.setRules(patch),
};
