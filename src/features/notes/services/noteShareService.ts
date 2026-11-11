import { Capacitor } from '@capacitor/core';
import { APP_INFO } from '../../../shared/constants/appInfo';
import { WidgetBridge } from '../../../shared/plugins/widgetBridge';
import { SAFE_IMAGE_DATA_URL, blobToDataUrl, dataUrlToBlob } from '../../../shared/utils/dataUrl';
import { sanitizeNoteHtml } from '../../../shared/utils/sanitizeHtml';
import { db } from '../../../shared/db/AppDatabase';
import { subjectRepository } from '../../subjects/repositories/subjectRepository';
import { noteImageRepository } from '../repositories/noteImageRepository';
import { noteRepository } from '../repositories/noteRepository';
import type { Subject } from '../../subjects/types';
import type { Note } from '../types';

/**
 * Formato .agnote (Agenda Note): un apunte empaquetado en JSON para compartirlo entre estudiantes
 * por WhatsApp u otra app. Lleva el HTML del apunte (con sus fotos en base64), las etiquetas, la
 * materia de origen y las fotos adjuntas. Al importarlo se trata como contenido NO confiable.
 */
export const AGNOTE_APP_ID = 'agenda-universitaria';
export const AGNOTE_TYPE = 'note';
export const AGNOTE_FORMAT_VERSION = 1;
export const AGNOTE_EXTENSION = '.agnote';
/** MIME propio: permite que Android abra la app al tocar el archivo (ver AndroidManifest). */
export const AGNOTE_MIME_TYPE = 'application/vnd.agenda-universitaria.note+json';

/** Límites de importación: un archivo ajeno no debe poder bloquear la app ni la base de datos. */
const MAX_PACKAGE_CHARS = 40 * 1024 * 1024;
const MAX_TITLE_LENGTH = 200;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const MAX_ATTACHMENTS = 30;
const MAX_SUBJECT_NAME_LENGTH = 100;

export interface NoteShareSubject {
  name: string;
  code?: string;
  /** Color #RRGGBB, para recrear la materia igual si el receptor no la tiene. */
  color?: string;
}

export interface NoteShareAttachment {
  name: string;
  /** data:image/(png|jpeg|webp|gif);base64,… */
  dataUrl: string;
}

export interface NoteSharePackage {
  app: typeof AGNOTE_APP_ID;
  type: typeof AGNOTE_TYPE;
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
  note: {
    title: string;
    /** HTML de TipTap; las fotos insertadas en el texto van como data URL. */
    content: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  subject: NoteShareSubject | null;
  /** Fotos adjuntas al apunte (tabla noteImages), aparte de las insertadas en el texto. */
  attachments: NoteShareAttachment[];
}

export interface NoteExportResult {
  method: 'share' | 'download';
  fileName: string;
}

/** Nombre de archivo seguro a partir del título: sin tildes, rutas ni caracteres raros. */
export function agnoteFileName(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return `${base || 'apunte'}${AGNOTE_EXTENSION}`;
}

/** Arma el paquete .agnote de un apunte (incluye sus fotos adjuntas). */
export async function buildNoteSharePackage(
  note: Note,
  subject?: Pick<Subject, 'name' | 'code' | 'color'> | null
): Promise<NoteSharePackage> {
  const images = await noteImageRepository.getByNoteId(note.id);
  const attachments: NoteShareAttachment[] = [];
  for (const image of images) {
    const dataUrl = await blobToDataUrl(image.blob);
    // Solo imágenes rasterizadas, igual que al importar
    if (SAFE_IMAGE_DATA_URL.test(dataUrl)) attachments.push({ name: image.name, dataUrl });
  }

  return {
    app: AGNOTE_APP_ID,
    type: AGNOTE_TYPE,
    formatVersion: AGNOTE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_INFO.version,
    note: {
      title: note.title,
      content: note.content,
      tags: note.tags,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
    subject: subject ? { name: subject.name, code: subject.code, color: subject.color } : null,
    attachments,
  };
}

/**
 * Comparte un apunte como archivo .agnote. En Android abre la hoja de compartir del sistema
 * (WhatsApp, Telegram, Drive…); en la web o en PC descarga el archivo.
 */
export async function exportNoteToAgnote(
  note: Note,
  subject?: Pick<Subject, 'name' | 'code' | 'color'> | null
): Promise<NoteExportResult> {
  const sharePackage = await buildNoteSharePackage(note, subject);
  const content = JSON.stringify(sharePackage);
  const fileName = agnoteFileName(note.title);

  if (Capacitor.isNativePlatform()) {
    await WidgetBridge.shareAgnoteFile({ content, fileName, mimeType: AGNOTE_MIME_TYPE });
    return { method: 'share', fileName };
  }

  const url = URL.createObjectURL(new Blob([content], { type: AGNOTE_MIME_TYPE }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Se libera después: revocar en el mismo tick puede cancelar la descarga en algunos navegadores
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { method: 'download', fileName };
}

const INVALID_AGNOTE_MESSAGE = 'El archivo no es un apunte compartido de Agenda Universitaria.';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isIsoDate(value: unknown): value is string {
  return isString(value) && !Number.isNaN(Date.parse(value));
}

function cleanText(value: unknown, maxLength: number): string {
  return isString(value) ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

/**
 * Valida y limpia el contenido de un .agnote. El archivo viene de otra persona: se comprueba la
 * cabecera y la versión, se sanitiza el HTML (DOMPurify) y se descartan imágenes que no sean
 * rasterizadas, campos desconocidos y valores fuera de los límites.
 */
export function parseAgnoteContent(rawJson: string): NoteSharePackage {
  if (rawJson.length > MAX_PACKAGE_CHARS) {
    throw new Error('El apunte compartido es demasiado grande para importarlo.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(INVALID_AGNOTE_MESSAGE);
  }

  if (!isRecord(parsed) || parsed.app !== AGNOTE_APP_ID || parsed.type !== AGNOTE_TYPE) {
    throw new Error(INVALID_AGNOTE_MESSAGE);
  }
  const formatVersion = parsed.formatVersion;
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion) || formatVersion < 1) {
    throw new Error(INVALID_AGNOTE_MESSAGE);
  }
  if (formatVersion > AGNOTE_FORMAT_VERSION) {
    throw new Error('Este apunte se creó con una versión más nueva de la app. Actualiza Agenda Universitaria para abrirlo.');
  }

  const rawNote = parsed.note;
  if (!isRecord(rawNote) || !isString(rawNote.content)) {
    throw new Error(INVALID_AGNOTE_MESSAGE);
  }

  const now = new Date().toISOString();
  const tags = Array.isArray(rawNote.tags)
    ? [...new Set(rawNote.tags.map((tag) => cleanText(tag, MAX_TAG_LENGTH)).filter(Boolean))].slice(0, MAX_TAGS)
    : [];

  let subject: NoteShareSubject | null = null;
  if (isRecord(parsed.subject)) {
    const name = cleanText(parsed.subject.name, MAX_SUBJECT_NAME_LENGTH);
    if (name) {
      const code = cleanText(parsed.subject.code, 20);
      const color = isString(parsed.subject.color) && /^#[0-9a-f]{6}$/i.test(parsed.subject.color) ? parsed.subject.color : undefined;
      subject = { name, ...(code ? { code } : {}), ...(color ? { color } : {}) };
    }
  }

  const attachments: NoteShareAttachment[] = [];
  if (Array.isArray(parsed.attachments)) {
    for (const raw of parsed.attachments.slice(0, MAX_ATTACHMENTS)) {
      if (!isRecord(raw) || !isString(raw.dataUrl) || !SAFE_IMAGE_DATA_URL.test(raw.dataUrl)) continue;
      attachments.push({ name: cleanText(raw.name, 120) || 'imagen', dataUrl: raw.dataUrl });
    }
  }

  return {
    app: AGNOTE_APP_ID,
    type: AGNOTE_TYPE,
    formatVersion,
    exportedAt: isIsoDate(parsed.exportedAt) ? parsed.exportedAt : now,
    appVersion: cleanText(parsed.appVersion, 20),
    note: {
      title: cleanText(rawNote.title, MAX_TITLE_LENGTH) || 'Apunte compartido',
      content: sanitizeNoteHtml(rawNote.content),
      tags,
      createdAt: isIsoDate(rawNote.createdAt) ? rawNote.createdAt : now,
      updatedAt: isIsoDate(rawNote.updatedAt) ? rawNote.updatedAt : now,
    },
    subject,
    attachments,
  };
}

/** Fotos adjuntas del paquete como Blob, listas para noteImageRepository.addBlob al importar. */
export function agnoteAttachmentBlobs(sharePackage: NoteSharePackage): { name: string; blob: Blob; mimeType: string }[] {
  return sharePackage.attachments.map((attachment) => {
    const blob = dataUrlToBlob(attachment.dataUrl);
    return { name: attachment.name, blob, mimeType: blob.type };
  });
}

/** Nombre comparable: sin tildes, mayúsculas ni espacios extra ("Cálculo  I" ≈ "calculo i"). */
function comparableName(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Materia local equivalente a la de origen: primero por código, después por nombre. */
export function findMatchingSubject<T extends Pick<Subject, 'id' | 'name' | 'code'>>(
  subjects: readonly T[],
  origin: NoteShareSubject | null
): T | undefined {
  if (!origin) return undefined;
  const code = origin.code ? comparableName(origin.code) : '';
  if (code) {
    const byCode = subjects.find((s) => s.code && comparableName(s.code) === code);
    if (byCode) return byCode;
  }
  const name = comparableName(origin.name);
  return subjects.find((s) => comparableName(s.name) === name);
}

export type AgnoteImportTarget =
  | { kind: 'existing'; subjectId: string }
  | { kind: 'create'; name: string; code?: string; color: string };

/**
 * Guarda un apunte compartido en la base de datos local: crea la materia si hace falta, el apunte
 * y sus fotos adjuntas en una sola transacción (si algo falla no queda un apunte a medias).
 * El paquete ya viene validado y sanitizado por parseAgnoteContent.
 */
export async function importAgnotePackage(
  sharePackage: NoteSharePackage,
  target: AgnoteImportTarget,
  tags: string[]
): Promise<{ note: Note; subjectId: string; createdSubject: boolean }> {
  const attachments = agnoteAttachmentBlobs(sharePackage);
  // db.professors también: subjectRepository.create abre su propia transacción anidada sobre
  // subjects y professors, y Dexie exige que el padre incluya todas las tablas que usan sus hijas
  return db.transaction('rw', [db.subjects, db.professors, db.notes, db.noteImages], async () => {
    let subjectId: string;
    if (target.kind === 'existing') {
      if (!(await subjectRepository.getById(target.subjectId))) {
        throw new Error('La materia elegida ya no existe.');
      }
      subjectId = target.subjectId;
    } else {
      const subject = await subjectRepository.create({
        name: target.name.trim().slice(0, MAX_SUBJECT_NAME_LENGTH) || 'Apuntes compartidos',
        ...(target.code ? { code: target.code } : {}),
        color: target.color,
      });
      subjectId = subject.id;
    }

    const note = await noteRepository.create({
      subjectId,
      title: sharePackage.note.title,
      content: sharePackage.note.content,
      tags,
    });
    for (const attachment of attachments) {
      await noteImageRepository.addBlob(note.id, attachment.name, attachment.blob, attachment.mimeType);
    }
    return { note, subjectId, createdSubject: target.kind === 'create' };
  });
}
