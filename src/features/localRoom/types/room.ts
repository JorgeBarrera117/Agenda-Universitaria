/**
 * Modelos de la Sala de Intercambio Local.
 *
 * Topología en estrella: un dispositivo es el anfitrión (abre un servidor en la red local y guarda
 * el estado de la sala en memoria) y los demás se conectan a él. Nada de esto se guarda en Dexie:
 * la sala es efímera. Solo lo que cada estudiante decide «Guardar en mi agenda» pasa a su base local.
 */

/** Los cinco tipos de contenido académico que se pueden compartir. */
export type RoomItemKind = 'schedule' | 'subject' | 'contact' | 'note' | 'document';

export const ROOM_ITEM_KINDS: readonly RoomItemKind[] = ['schedule', 'subject', 'contact', 'note', 'document'];

/** Reglas que el anfitrión puede cambiar en cualquier momento. */
export interface RoomRules {
  /** Los que entran esperan a que el anfitrión los acepte. */
  waitingRoom: boolean;
  /** No entra nadie más (ni siquiera a la sala de espera). */
  locked: boolean;
  /** Solo el anfitrión publica; los demás miran y guardan. */
  readOnly: boolean;
  /** Se permite escribir texto (si no, solo se comparten elementos). */
  textEnabled: boolean;
  /** Los participantes pueden abrir chats privados 1 a 1. */
  privateChat: boolean;
  /** Los compañeros guardados por el anfitrión entran sin pasar por la sala de espera. */
  trustedAutoAdmit: boolean;
}

export const DEFAULT_ROOM_RULES: RoomRules = {
  waitingRoom: true,
  locked: false,
  readOnly: false,
  textEnabled: true,
  privateChat: true,
  trustedAutoAdmit: true,
};

export type RoomMemberStatus = 'pending' | 'active';

/** Lo que todos ven de un participante. */
export interface RoomMember {
  id: string;
  name: string;
  /** Color del avatar (#rrggbb). */
  color: string;
  isHost: boolean;
  status: RoomMemberStatus;
  /** Tiene la conexión de eventos abierta ahora mismo. */
  online: boolean;
  joinedAt: number;
  /** Huella verificada de su dispositivo (firma ECDSA): sirve para guardarlo como compañero. */
  peerId?: string;
}

/** Ficha de un elemento compartido: lo que viaja en el hilo. El contenido se pide aparte. */
export interface RoomItemMeta {
  id: string;
  kind: RoomItemKind;
  title: string;
  subtitle?: string;
  /** Tamaño aproximado del contenido, en bytes. */
  sizeBytes: number;
  /** Solo archivos de la Biblioteca. */
  fileName?: string;
  mimeType?: string;
  /** Archivo de la Biblioteca: materia de origen (para proponer dónde guardarlo). */
  subjectName?: string;
}

export interface RoomMessage {
  id: string;
  createdAt: number;
  authorId: string;
  authorName: string;
  authorColor: string;
  /** Aviso de la sala («Ana se unió»): sin burbuja. */
  system?: boolean;
  text?: string;
  item?: RoomItemMeta;
  /** Chat privado: id del destinatario. Solo lo reciben el autor y el destinatario. */
  to?: string;
}

export interface RoomInfo {
  name: string;
  hostName: string;
  pinLength: 4 | 6;
}

/** Estado completo que ve un participante. */
export interface RoomSnapshot {
  info: RoomInfo;
  rules: RoomRules;
  /** El anfitrión ve también a los que esperan; los invitados solo a los activos. */
  members: RoomMember[];
  messages: RoomMessage[];
  selfId: string;
  /** Fotos (miniaturas de 96 px) por id de participante. Llegan una vez, no en cada cambio. */
  avatars: Record<string, string>;
}

/** Datos visibles de un elemento antes de publicarlo (sin id ni tamaño: los pone el anfitrión). */
export interface RoomItemInfo {
  kind: RoomItemKind;
  title: string;
  subtitle?: string;
  fileName?: string;
  mimeType?: string;
  subjectName?: string;
}

/**
 * Elemento listo para compartir. El contenido va como Blob y viaja por bloques:
 * - horario, materia, contacto y apunte: el JSON de su archivo (.agschedule, .agclass, .agcontact, .agnote);
 * - archivo de la Biblioteca: el archivo tal cual (se lee por partes, nunca entero en memoria como texto).
 */
export interface RoomItemDraft extends RoomItemInfo {
  blob: Blob;
}

/** Elemento recibido (descargado por bloques) listo para guardar. */
export interface RoomReceivedItem {
  meta: RoomItemMeta;
  blob: Blob;
}

/** Texto para el hilo o para un chat privado (to = destinatario). */
export interface RoomPostDraft {
  text: string;
  to?: string;
}

/** Subida o descarga en curso de un elemento (barra de progreso en su tarjeta). */
export interface RoomTransfer {
  id: string;
  direction: 'up' | 'down';
  /** Descarga: elemento que se baja. */
  itemId?: string;
  /** Subida: datos para dibujar la tarjeta mientras se envía. */
  info?: RoomItemInfo;
  /** Chat donde aparece (null = hilo de la sala). */
  chat: string | null;
  totalBytes: number;
  doneBytes: number;
  /** Bytes por segundo (promedio desde el inicio). */
  bytesPerSecond: number;
  status: 'running' | 'error' | 'cancelled';
  error?: string;
}

/** Perfil con el que uno aparece en la sala. */
export interface RoomProfile {
  name: string;
  color: string;
  /** Miniatura de la foto de Mi perfil (data:image/jpeg, 96 px, < 25 KB). */
  avatar?: string;
}

/** Tope de una miniatura en base64 (25 KB de imagen). */
export const ROOM_AVATAR_MAX_CHARS = 34_500;

/** Datos para entrar: los lleva el QR o se escriben a mano. */
export interface RoomInvite {
  hosts: string[];
  port: number;
  pin: string;
  /** Nombre de la sala (solo para mostrarlo mientras se conecta). */
  name?: string;
  /** La sala también se anuncia por cercanía (Bluetooth / Wi-Fi Direct, sin red wifi). */
  nearby?: boolean;
}

/** Por qué terminó la sala para este dispositivo. */
export type RoomEndReason = 'closed' | 'kicked' | 'rejected' | 'left' | 'lost' | 'error';

export const ROOM_TEXT_MAX = 250;
export const ROOM_MAX_MEMBERS = 25;
/**
 * Tope de un elemento. Viaja por bloques, así que el límite es la memoria del anfitrión, que
 * guarda lo publicado mientras dure la sala (ver MAX_ITEM_STORE_BYTES en roomHostEngine).
 */
export const ROOM_ITEM_MAX_BYTES = 300 * 1024 * 1024;
/** Tamaño de cada bloque (antes de cifrar). */
export const ROOM_CHUNK_BYTES = 512 * 1024;
/** Bloques que viajan a la vez (aprovecha la red sin saturar el puente nativo). */
export const ROOM_CHUNK_PARALLEL = 3;

/**
 * Compañero guardado (tabla roomContacts de Dexie). deviceId es la HUELLA verificada de su
 * dispositivo (peerId), no un identificador interno: no se puede falsificar sin su clave privada.
 */
export interface RoomContact {
  deviceId: string;
  name: string;
  /** Miniatura de su foto (si tenía). */
  avatarThumb?: string;
  color: string;
  /** Última vez que coincidieron en una sala (ms). */
  lastSeen: number;
}
