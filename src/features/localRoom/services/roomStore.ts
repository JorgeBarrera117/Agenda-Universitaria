import type { RoomEndReason, RoomInfo, RoomInvite, RoomItemPayload, RoomPostDraft, RoomProfile, RoomRules, RoomSnapshot } from '../types/room';
import { randomToken } from './roomCrypto';
import { RoomGuestClient } from './roomGuestClient';
import { RoomHostEngine } from './roomHostEngine';
import { createGuestTransport, createHostTransport } from './roomTransports';

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
  /** Mensajes nuevos de otros mientras la pantalla de la sala estaba cerrada. */
  unread: number;
  screenOpen: boolean;
  /** Elementos que este dispositivo ya guardó en su agenda (id del elemento). */
  saved: ReadonlySet<string>;
}

const PROFILE_KEY = 'agenda_room_profile_v1';
const DEVICE_KEY = 'agenda_room_device_id_v1';
export const ROOM_PROFILE_COLORS = ['#1e6bd6', '#0f8a6d', '#b3261e', '#8e44ad', '#c76a00', '#00838f', '#6d4c41', '#3f51b5'] as const;

let state: RoomStoreState = { session: { phase: 'idle' }, unread: 0, screenOpen: false, saved: new Set() };
const listeners = new Set<() => void>();
let engine: RoomHostEngine | null = null;
let client: RoomGuestClient | null = null;
let detach: (() => void) | null = null;
let seenMessages = 0;

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

export function loadRoomProfile(fallbackName: string): RoomProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && 'name' in parsed && 'color' in parsed) {
        const { name, color } = parsed as { name: unknown; color: unknown };
        if (typeof name === 'string' && name.trim() && typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) return { name: name.trim().slice(0, 40), color };
      }
    }
  } catch {
    // Sin almacenamiento: perfil por defecto
  }
  return { name: fallbackName.trim().slice(0, 40) || 'Estudiante', color: ROOM_PROFILE_COLORS[0] };
}

export function saveRoomProfile(profile: RoomProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: profile.name.trim().slice(0, 40), color: profile.color }));
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

function countUnread(snapshot: RoomSnapshot): number {
  const messages = snapshot.messages;
  if (state.screenOpen || messages.length <= seenMessages) {
    seenMessages = messages.length;
    return state.screenOpen ? 0 : state.unread;
  }
  const fresh = messages.slice(seenMessages).filter((m) => !m.system && m.authorId !== snapshot.selfId).length;
  seenMessages = messages.length;
  return state.unread + fresh;
}

function syncFromEngine(): void {
  const view = engine?.getView();
  if (!view) return;
  emit({ session: { phase: 'active', role: 'host', snapshot: view.snapshot, invite: view.invite, connection: 'online' }, unread: countUnread(view.snapshot) });
}

function syncFromClient(): void {
  if (!client) return;
  const guest = client.getState();
  if (guest.phase === 'ended') return; // lo resuelve onEnd con su mensaje
  if (guest.phase === 'waiting' || !guest.snapshot) {
    emit({ session: { phase: 'waiting', info: guest.info, connection: guest.connection } });
    return;
  }
  emit({ session: { phase: 'active', role: 'guest', snapshot: guest.snapshot, connection: guest.connection }, unread: countUnread(guest.snapshot) });
}

function ended(reason: RoomEndReason, message: string): void {
  detach?.();
  detach = null;
  engine = null;
  client = null;
  seenMessages = 0;
  emit({ session: { phase: 'ended', reason, message }, unread: 0, saved: new Set() });
}

/* ------------------------------------------------------------------ Acciones */

export interface CreateRoomOptions {
  roomName: string;
  pinLength: 4 | 6;
  profile: RoomProfile;
  rules: Partial<RoomRules>;
}

export async function createRoom(options: CreateRoomOptions): Promise<void> {
  if (state.session.phase === 'active' || state.session.phase === 'waiting' || state.session.phase === 'starting') return;
  emit({ session: { phase: 'starting', role: 'host' }, unread: 0, saved: new Set() });
  try {
    const created = await RoomHostEngine.open(createHostTransport(), options);
    engine = created;
    detach = created.subscribe(syncFromEngine);
    created.onEnd((reason, message) =>
      ended(reason === 'closed' ? 'closed' : 'error', reason === 'closed' ? 'Cerraste la sala para todos.' : `La sala se cerró: ${message ?? 'se perdió la red local'}.`)
    );
    seenMessages = 0;
    syncFromEngine();
  } catch (error) {
    emit({ session: { phase: 'idle' } });
    throw error;
  }
}

export async function joinRoom(invite: RoomInvite, profile: RoomProfile): Promise<void> {
  if (state.session.phase === 'active' || state.session.phase === 'waiting' || state.session.phase === 'starting') return;
  emit({ session: { phase: 'starting', role: 'guest' }, unread: 0, saved: new Set() });
  try {
    const joined = await RoomGuestClient.connect(createGuestTransport(), invite, profile, deviceId());
    client = joined;
    detach = joined.subscribe(syncFromClient);
    joined.onEnd((reason, message) => ended(reason, message ?? (reason === 'left' ? 'Saliste de la sala.' : 'La sala terminó.')));
    seenMessages = 0;
    syncFromClient();
  } catch (error) {
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

export async function postToRoom(draft: RoomPostDraft): Promise<void> {
  if (engine) return engine.post(draft);
  if (client) return client.post(draft);
  throw new Error('No estás en una sala.');
}

export async function fetchRoomItem(itemId: string): Promise<RoomItemPayload> {
  if (engine) return engine.fetchItem(itemId);
  if (client) return client.fetchItem(itemId);
  throw new Error('No estás en una sala.');
}

export function markRoomItemSaved(itemId: string): void {
  const saved = new Set(state.saved);
  saved.add(itemId);
  emit({ saved });
}

export function setRoomScreenOpen(open: boolean): void {
  emit({ screenOpen: open, unread: open ? 0 : state.unread });
}

/* ------------------------------------------------------------------ Moderación (solo anfitrión) */

export const roomModeration = {
  approve: (memberId: string) => void engine?.approve(memberId),
  reject: (memberId: string) => void engine?.reject(memberId),
  kick: (memberId: string) => void engine?.kick(memberId),
  setRules: (patch: Partial<RoomRules>) => engine?.setRules(patch),
};
