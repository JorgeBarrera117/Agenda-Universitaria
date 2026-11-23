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
}

export const DEFAULT_ROOM_RULES: RoomRules = {
  waitingRoom: true,
  locked: false,
  readOnly: false,
  textEnabled: true,
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
}

/** Contenido de un elemento, tal como se publica y se descarga. */
export interface RoomItemPayload {
  kind: RoomItemKind;
  title: string;
  subtitle?: string;
  fileName?: string;
  mimeType?: string;
  /**
   * Horario, materia, contacto y apunte: el JSON de su archivo (.agschedule, .agclass, .agcontact,
   * .agnote). Archivo de la Biblioteca: el contenido en base64.
   */
  data: string;
  /** Archivo de la Biblioteca: materia de origen (para proponer dónde guardarlo). */
  subjectName?: string;
}

/** Lo que el participante escribe o adjunta antes de publicarlo. */
export interface RoomPostDraft {
  text?: string;
  item?: RoomItemPayload;
}

/** Perfil con el que uno aparece en la sala. */
export interface RoomProfile {
  name: string;
  color: string;
}

/** Datos para entrar: los lleva el QR o se escriben a mano. */
export interface RoomInvite {
  hosts: string[];
  port: number;
  pin: string;
  /** Nombre de la sala (solo para mostrarlo mientras se conecta). */
  name?: string;
}

/** Por qué terminó la sala para este dispositivo. */
export type RoomEndReason = 'closed' | 'kicked' | 'rejected' | 'left' | 'lost' | 'error';

export const ROOM_TEXT_MAX = 250;
export const ROOM_MAX_MEMBERS = 25;
/** Tope de un elemento (antes de cifrar). Los archivos más pesados llegan en la Fase 2. */
export const ROOM_ITEM_MAX_BYTES = 10 * 1024 * 1024;
