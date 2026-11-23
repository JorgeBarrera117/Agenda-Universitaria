import type { Note } from '../../notes/types';
import type { Professor } from '../../professors/types';
import type { ScheduleSlot } from '../../schedule/types';
import type { Subject } from '../../subjects/types';
import type { SubjectDocumentItem } from '../../subjects/hooks/useSubjectDocuments';
import { getBlob, readStoredDocuments, saveBlob, writeStoredDocuments } from '../../subjects/services/documentStorage';
import { parseSharedFileContent, type IncomingSharedFile } from '../../../shared/hooks/useIncomingSharedFile';
import { ROOM_ITEM_MAX_BYTES, type RoomItemDraft, type RoomItemKind, type RoomReceivedItem } from '../types/room';

/**
 * Elementos de la sala: se arman con los mismos formatos de compartir de cada sección
 * (.agschedule, .agclass, .agcontact, .agnote) y, al guardarlos, pasan por sus mismos validadores
 * y modales de importación, que ya detectan duplicados (Actualizar / Combinar / Guardar como nuevo).
 * Todo viaja como Blob por bloques (ver roomGuestClient): los archivos de la Biblioteca nunca se
 * convierten enteros a texto, así que un PDF de cientos de MB no se duplica en memoria. Al
 * guardarlos se detectan duplicados (mismo nombre y tamaño en la misma materia).
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

function jsonBlob(value: unknown): Blob {
  return new Blob([JSON.stringify(value)], { type: 'application/json' });
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
): Promise<RoomItemDraft> {
  const { buildScheduleSharePackage } = await import('../../schedule/services/scheduleShareService');
  const current = subjects.filter((s) => !s.isArchived);
  const sharePackage = buildScheduleSharePackage(semesterName, current, slots, professors);
  return {
    kind: 'schedule',
    title: semesterName.trim() ? `Horario · ${semesterName.trim()}` : 'Horario completo',
    subtitle: `${plural(sharePackage.subjects.length, 'materia', 'materias')} · ${plural(sharePackage.slots.length, 'clase', 'clases')}`,
    blob: jsonBlob(sharePackage),
  };
}

export async function buildSubjectRoomItem(subject: Subject, slots: readonly ScheduleSlot[], professors: readonly Professor[]): Promise<RoomItemDraft> {
  const { buildSubjectSharePackage } = await import('../../subjects/services/subjectShareService');
  const sharePackage = buildSubjectSharePackage(subject, slots, professors);
  const professor = sharePackage.professors[0]?.name;
  return {
    kind: 'subject',
    title: subject.name,
    subtitle: [subject.code, professor, plural(sharePackage.slots.length, 'clase', 'clases')].filter(Boolean).join(' · '),
    blob: jsonBlob(sharePackage),
  };
}

export function professorSubjectNames(professor: Professor, subjects: readonly Subject[]): string[] {
  return subjects.filter((s) => professor.subjectIds.includes(s.id) || s.professorId === professor.id).map((s) => s.name);
}

export async function buildContactRoomItem(professor: Professor, subjects: readonly Subject[]): Promise<RoomItemDraft> {
  const { buildProfessorSharePackage } = await import('../../professors/services/professorShareService');
  const names = professorSubjectNames(professor, subjects);
  return {
    kind: 'contact',
    title: professor.name,
    subtitle: names.length > 0 ? names.join(', ') : professor.email,
    blob: jsonBlob(buildProfessorSharePackage(professor, names)),
  };
}

export async function buildNoteRoomItem(note: Note, subject: Subject | undefined): Promise<RoomItemDraft> {
  const { buildNoteSharePackage } = await import('../../notes/services/noteShareService');
  const sharePackage = await buildNoteSharePackage(note, subject ?? null);
  const attachments = sharePackage.attachments.length + (sharePackage.recordings?.length ?? 0);
  return {
    kind: 'note',
    title: note.title.trim() || 'Apunte sin título',
    subtitle: [subject?.name ?? 'Personal', attachments > 0 ? plural(attachments, 'adjunto', 'adjuntos') : undefined].filter(Boolean).join(' · '),
    blob: jsonBlob(sharePackage),
  };
}

export async function buildDocumentRoomItem(document: SubjectDocumentItem, subjectName: string | undefined): Promise<RoomItemDraft> {
  if (document.isExternalLink) throw new Error('Los enlaces externos no se pueden enviar por la sala.');
  const blob = await getBlob(document.id);
  if (!blob) throw new Error('No se encontró el archivo en este dispositivo.');
  if (blob.size > ROOM_ITEM_MAX_BYTES) throw new Error(`El archivo pesa ${formatRoomBytes(blob.size)}; la sala acepta hasta 300 MB.`);
  return {
    kind: 'document',
    title: document.name,
    subtitle: [subjectName, formatRoomBytes(blob.size)].filter(Boolean).join(' · '),
    fileName: document.name,
    mimeType: document.mimeType || blob.type || 'application/octet-stream',
    subjectName,
    blob,
  };
}

/** Un elemento listo para publicar no puede pasar del tope de la sala. */
export function assertRoomItemSize(draft: RoomItemDraft): void {
  if (draft.blob.size > ROOM_ITEM_MAX_BYTES) throw new Error(`Pesa ${formatRoomBytes(draft.blob.size)}; la sala acepta hasta 300 MB.`);
}

/* ------------------------------------------------------------------ Guardar */

/** Horario, materia, contacto y apunte: se validan con el parser de su formato (y su tipo debe coincidir). */
export async function parseRoomPackage(item: RoomReceivedItem): Promise<IncomingSharedFile> {
  const parsed = await parseSharedFileContent(await item.blob.text());
  if (parsed.kind !== item.meta.kind) throw new Error('El contenido no coincide con lo que se anunció en la sala.');
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

export async function saveRoomDocument(item: RoomReceivedItem, subjectId: string): Promise<SubjectDocumentItem> {
  const fileName = uniqueFileName(subjectId, item.meta.fileName || item.meta.title);
  const mimeType = item.meta.mimeType || item.blob.type || 'application/octet-stream';
  const blob = item.blob.type === mimeType ? item.blob : new Blob([item.blob], { type: mimeType });
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
