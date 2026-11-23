import type { Note } from '../../notes/types';
import type { Professor } from '../../professors/types';
import type { ScheduleSlot } from '../../schedule/types';
import type { Subject } from '../../subjects/types';
import type { SubjectDocumentItem } from '../../subjects/hooks/useSubjectDocuments';
import { getBlob, readStoredDocuments, saveBlob, writeStoredDocuments } from '../../subjects/services/documentStorage';
import { parseSharedFileContent, type IncomingSharedFile } from '../../../shared/hooks/useIncomingSharedFile';
import { ROOM_ITEM_MAX_BYTES, type RoomItemKind, type RoomItemPayload } from '../types/room';
import { base64StringToBytes, bytesToBase64String } from './roomCrypto';

/**
 * Elementos de la sala: se arman con los mismos formatos de compartir de cada sección
 * (.agschedule, .agclass, .agcontact, .agnote) y, al guardarlos, pasan por sus mismos validadores
 * y modales de importación, que ya detectan duplicados (Actualizar / Combinar / Guardar como nuevo).
 * Los archivos de la Biblioteca viajan en base64 y se guardan con la detección de duplicados de
 * abajo (mismo nombre y tamaño en la misma materia).
 */

export const ROOM_ITEM_LABEL: Record<RoomItemKind, string> = {
  schedule: 'Horario',
  subject: 'Materia',
  contact: 'Contacto docente',
  note: 'Apunte',
  document: 'Archivo',
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function formatRoomBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ Armar */

export async function buildScheduleRoomItem(
  semesterName: string,
  subjects: readonly Subject[],
  slots: readonly ScheduleSlot[],
  professors: readonly Professor[]
): Promise<RoomItemPayload> {
  const { buildScheduleSharePackage } = await import('../../schedule/services/scheduleShareService');
  const current = subjects.filter((s) => !s.isArchived);
  const sharePackage = buildScheduleSharePackage(semesterName, current, slots, professors);
  return {
    kind: 'schedule',
    title: semesterName.trim() ? `Horario · ${semesterName.trim()}` : 'Horario completo',
    subtitle: `${plural(sharePackage.subjects.length, 'materia', 'materias')} · ${plural(sharePackage.slots.length, 'clase', 'clases')}`,
    data: JSON.stringify(sharePackage),
  };
}

export async function buildSubjectRoomItem(subject: Subject, slots: readonly ScheduleSlot[], professors: readonly Professor[]): Promise<RoomItemPayload> {
  const { buildSubjectSharePackage } = await import('../../subjects/services/subjectShareService');
  const sharePackage = buildSubjectSharePackage(subject, slots, professors);
  const professor = sharePackage.professors[0]?.name;
  return {
    kind: 'subject',
    title: subject.name,
    subtitle: [subject.code, professor, plural(sharePackage.slots.length, 'clase', 'clases')].filter(Boolean).join(' · '),
    data: JSON.stringify(sharePackage),
  };
}

export function professorSubjectNames(professor: Professor, subjects: readonly Subject[]): string[] {
  return subjects.filter((s) => professor.subjectIds.includes(s.id) || s.professorId === professor.id).map((s) => s.name);
}

export async function buildContactRoomItem(professor: Professor, subjects: readonly Subject[]): Promise<RoomItemPayload> {
  const { buildProfessorSharePackage } = await import('../../professors/services/professorShareService');
  const names = professorSubjectNames(professor, subjects);
  return {
    kind: 'contact',
    title: professor.name,
    subtitle: names.length > 0 ? names.join(', ') : professor.email,
    data: JSON.stringify(buildProfessorSharePackage(professor, names)),
  };
}

export async function buildNoteRoomItem(note: Note, subject: Subject | undefined): Promise<RoomItemPayload> {
  const { buildNoteSharePackage } = await import('../../notes/services/noteShareService');
  const sharePackage = await buildNoteSharePackage(note, subject ?? null);
  const attachments = sharePackage.attachments.length + (sharePackage.recordings?.length ?? 0);
  return {
    kind: 'note',
    title: note.title.trim() || 'Apunte sin título',
    subtitle: [subject?.name ?? 'Personal', attachments > 0 ? plural(attachments, 'adjunto', 'adjuntos') : undefined].filter(Boolean).join(' · '),
    data: JSON.stringify(sharePackage),
  };
}

export async function buildDocumentRoomItem(document: SubjectDocumentItem, subjectName: string | undefined): Promise<RoomItemPayload> {
  if (document.isExternalLink) throw new Error('Los enlaces externos no se pueden enviar por la sala.');
  const blob = await getBlob(document.id);
  if (!blob) throw new Error('No se encontró el archivo en este dispositivo.');
  if (blob.size > ROOM_ITEM_MAX_BYTES) throw new Error(`El archivo pesa ${formatRoomBytes(blob.size)}; en esta versión la sala acepta hasta 10 MB.`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    kind: 'document',
    title: document.name,
    subtitle: [subjectName, formatRoomBytes(blob.size)].filter(Boolean).join(' · '),
    fileName: document.name,
    mimeType: document.mimeType || blob.type || 'application/octet-stream',
    subjectName,
    data: bytesToBase64String(bytes),
  };
}

/** Un elemento listo para publicar no puede pasar del tope de la sala. */
export function assertRoomItemSize(payload: RoomItemPayload): void {
  const bytes = payload.kind === 'document' ? Math.floor((payload.data.length * 3) / 4) : payload.data.length;
  if (bytes > ROOM_ITEM_MAX_BYTES) throw new Error(`Pesa ${formatRoomBytes(bytes)}; en esta versión la sala acepta hasta 10 MB.`);
}

/* ------------------------------------------------------------------ Guardar */

/** Horario, materia, contacto y apunte: se validan con el parser de su formato (y su tipo debe coincidir). */
export async function parseRoomPackage(payload: RoomItemPayload): Promise<IncomingSharedFile> {
  const parsed = await parseSharedFileContent(payload.data);
  if (parsed.kind !== payload.kind) throw new Error('El contenido no coincide con lo que se anunció en la sala.');
  return parsed;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function suggestDocumentSubject(subjects: readonly Subject[], subjectName: string | undefined): Subject | undefined {
  if (!subjectName) return undefined;
  const wanted = normalizeName(subjectName);
  return subjects.find((s) => normalizeName(s.name) === wanted);
}

export function documentPayloadBytes(payload: RoomItemPayload): number {
  const padding = payload.data.endsWith('==') ? 2 : payload.data.endsWith('=') ? 1 : 0;
  return Math.floor((payload.data.length * 3) / 4) - padding;
}

/** El mismo archivo (nombre y tamaño) ya está en esa materia. */
export function findDuplicateDocument(subjectId: string, fileName: string, sizeBytes: number): SubjectDocumentItem | undefined {
  const wanted = normalizeName(fileName);
  return readStoredDocuments().find((d) => d.subjectId === subjectId && !d.isExternalLink && normalizeName(d.name) === wanted && d.sizeBytes === sizeBytes);
}

/** «Tarea.pdf» → «Tarea (2).pdf» si ya hay uno con ese nombre en la materia. */
function uniqueFileName(subjectId: string, fileName: string): string {
  const taken = new Set(readStoredDocuments().filter((d) => d.subjectId === subjectId).map((d) => normalizeName(d.name)));
  if (!taken.has(normalizeName(fileName))) return fileName;
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : '';
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base} (${n})${ext}`;
    if (!taken.has(normalizeName(candidate))) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}

export async function saveRoomDocument(payload: RoomItemPayload, subjectId: string): Promise<SubjectDocumentItem> {
  const fileName = uniqueFileName(subjectId, payload.fileName || payload.title);
  const mimeType = payload.mimeType || 'application/octet-stream';
  const blob = new Blob([base64StringToBytes(payload.data)], { type: mimeType });
  const document: SubjectDocumentItem = {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    subjectId,
    name: fileName,
    fileExtension: fileName.split('.').pop()?.toLowerCase() || 'bin',
    mimeType,
    sizeBytes: blob.size,
    createdAt: new Date().toISOString(),
  };
  await saveBlob(document.id, blob);
  writeStoredDocuments([...readStoredDocuments(), document]);
  return document;
}
