import { Capacitor } from '@capacitor/core';
import { db } from '../db/AppDatabase';
import type { Note, NoteImage } from '../../features/notes/types';
import type { Subject } from '../../features/subjects/types';
import type { Professor } from '../../features/professors/types';
import type { ScheduleSlot } from '../../features/schedule/types';
import { WidgetBridge } from '../plugins/widgetBridge';
import { sanitizeNoteHtml } from './sanitizeHtml';

// Convertir Blob a DataURL base64 para exportar en JSON
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convertir DataURL base64 de vuelta a Blob al importar
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binaryStr = atob(parts[1]);
  const len = binaryStr.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

export interface ExportResult {
  method: 'downloads' | 'share' | 'file-picker' | 'clipboard' | 'download';
  canceled?: boolean;
  fileName?: string;
}

/**
 * Genera la cadena JSON y el nombre de archivo con todos los datos del semestre actual.
 */
export async function generateBackupData(): Promise<{ jsonString: string; fileName: string }> {
  const subjects = await db.subjects.toArray();
  const professors = await db.professors.toArray();
  const scheduleSlots = await db.scheduleSlots.toArray();
  const notes = await db.notes.toArray();
  const rawImages = await db.noteImages.toArray();

  const serializedImages = await Promise.all(
    rawImages.map(async (img) => ({
      id: img.id,
      noteId: img.noteId,
      name: img.name,
      mimeType: img.mimeType,
      dataUrl: await blobToDataUrl(img.blob),
      createdAt: img.createdAt,
    }))
  );

  const backupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      subjects,
      professors,
      scheduleSlots,
      notes,
      images: serializedImages,
    },
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const fileName = `agenda_universitaria_backup_${new Date().toISOString().split('T')[0]}.json`;
  return { jsonString, fileName };
}

/**
 * 1. Guardar directamente en la carpeta de Descargas (Download) de Android
 */
export async function saveBackupToDownloads(): Promise<{ success: boolean; fileName: string }> {
  const { jsonString, fileName } = await generateBackupData();

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await WidgetBridge.saveToDownloads({
        content: jsonString,
        fileName,
      });
      return { success: true, fileName: res.fileName || fileName };
    } catch (e) {
      console.warn('Fallo guardando en MediaStore Downloads:', e);
    }
  }

  // Fallback para navegador web
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return { success: true, fileName };
}

/**
 * 2. Compartir respaldo mediante la hoja nativa de Android (WhatsApp, Drive, Gmail, etc.)
 */
export async function shareBackup(): Promise<{ success: boolean; canceled?: boolean }> {
  const { jsonString, fileName } = await generateBackupData();

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await WidgetBridge.shareJsonFile({
        content: jsonString,
        fileName,
      });
      return { success: res.success };
    } catch (e) {
      console.warn('Fallo compartiendo archivo nativo:', e);
    }
  }

  // Fallback web: Web Share API si está disponible
  const blob = new Blob([jsonString], { type: 'application/json' });
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const file = new File([blob], fileName, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Respaldo Agenda Universitaria',
          text: 'Copia de seguridad en formato JSON de la Agenda Universitaria.',
        });
        return { success: true };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, canceled: true };
      }
    }
  }

  // Si no se puede compartir, copiar al portapapeles como respaldo seguro
  await copyBackupToClipboard();
  return { success: true };
}

/**
 * 3. Guardar como... eligiendo carpeta con Storage Access Framework (SAF) o File System API
 */
export async function saveBackupWithPicker(): Promise<ExportResult> {
  const { jsonString, fileName } = await generateBackupData();
  const blob = new Blob([jsonString], { type: 'application/json' });

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await WidgetBridge.exportJsonFile({
        content: jsonString,
        fileName,
      });
      if (res && res.canceled) {
        return { method: 'file-picker', canceled: true };
      }
      return { method: 'file-picker', canceled: false };
    } catch (e) {
      console.warn('Fallo en selector SAF:', e);
    }
  }

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (options?: unknown) => Promise<{
          createWritable: () => Promise<{
            write: (data: unknown) => Promise<void>;
            close: () => Promise<void>;
          }>;
        }>;
      }).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'Archivo de Respaldo JSON',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { method: 'file-picker', canceled: false };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { method: 'file-picker', canceled: true };
      }
    }
  }

  // Fallback si el selector no está disponible
  return saveBackupToDownloads().then((r) => ({
    method: 'downloads',
    fileName: r.fileName,
  }));
}

/**
 * 4. Copiar texto JSON completo al portapapeles (Infalible, cero permisos requeridos)
 */
export async function copyBackupToClipboard(): Promise<boolean> {
  const { jsonString } = await generateBackupData();
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(jsonString);
      return true;
    }
  } catch {
    // Continuar a fallback
  }

  // Fallback clásico con textarea oculto
  try {
    const textArea = document.createElement('textarea');
    textArea.value = jsonString;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Error al copiar al portapapeles:', err);
    return false;
  }
}

/**
 * Función compatible retrocompatible: exporta de forma inteligente
 */
export async function exportDatabaseBackup(): Promise<ExportResult> {
  if (Capacitor.isNativePlatform()) {
    // En Android, primero intentar guardar en Descargas directamente
    try {
      const res = await saveBackupToDownloads();
      return { method: 'downloads', fileName: res.fileName };
    } catch {
      return saveBackupWithPicker();
    }
  }
  return saveBackupWithPicker();
}

/**
 * Restaura toda la base de datos a partir de una cadena JSON en texto crudo
 */
export async function restoreFromRawJson(rawText: string): Promise<void> {
  let cleanText = (rawText || '').trim();

  // Eliminar Byte Order Mark (BOM) UTF-8 si está presente al inicio del archivo
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1).trim();
  }

  if (!cleanText || cleanText.length === 0) {
    throw new Error(
      'El archivo de respaldo seleccionado está completamente vacío (0 bytes). Verifica que seleccionaste el archivo correcto o usa la opción "Restaurar Pegando Texto".'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanText);
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      throw new Error(
        'El archivo seleccionado no tiene un formato JSON válido o está incompleto (Unexpected end of JSON input). Si guardaste el respaldo recientemente, asegúrate de que se descargó completo o prueba la opción "Restaurar Pegando Texto".'
      );
    }
    throw err;
  }

  const backup = parseBackupPayload(parsed);

  await db.transaction('rw', [db.subjects, db.professors, db.scheduleSlots, db.notes, db.noteImages], async () => {
    await db.subjects.clear();
    await db.professors.clear();
    await db.scheduleSlots.clear();
    await db.notes.clear();
    await db.noteImages.clear();

    if (backup.subjects.length) await db.subjects.bulkAdd(backup.subjects);
    if (backup.professors.length) await db.professors.bulkAdd(backup.professors);
    if (backup.scheduleSlots.length) await db.scheduleSlots.bulkAdd(backup.scheduleSlots);
    if (backup.notes.length) await db.notes.bulkAdd(backup.notes);
    if (backup.images.length) await db.noteImages.bulkAdd(backup.images);
  });
}

type UnknownRecord = Record<string, unknown>;

interface ParsedBackup {
  subjects: Subject[];
  professors: Professor[];
  scheduleSlots: ScheduleSlot[];
  notes: Note[];
  images: NoteImage[];
}

const INVALID_BACKUP_MESSAGE = 'El archivo no contiene un formato de respaldo válido de Agenda Universitaria.';

// Solo se aceptan imágenes rasterizadas: un SVG podría transportar scripts.
const SAFE_IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,[A-Za-z0-9+/=\s]+$/;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function readRecords(data: UnknownRecord, key: string, requiredStrings: readonly string[]): UnknownRecord[] {
  const value = data[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${INVALID_BACKUP_MESSAGE} (la sección "${key}" no es una lista).`);
  }
  return value.map((item, index) => {
    if (!isRecord(item) || !requiredStrings.every((field) => isString(item[field]))) {
      throw new Error(`${INVALID_BACKUP_MESSAGE} (registro ${index + 1} de "${key}" incompleto).`);
    }
    return item;
  });
}

/**
 * Valida la forma de un respaldo antes de tocar la base de datos. El archivo puede venir de
 * otra persona, así que el HTML de los apuntes se sanitiza y se descartan imágenes no rasterizadas.
 */
function parseBackupPayload(parsed: unknown): ParsedBackup {
  if (!isRecord(parsed) || !isRecord(parsed.data) || !Array.isArray(parsed.data.subjects)) {
    throw new Error(INVALID_BACKUP_MESSAGE);
  }
  const data = parsed.data;

  const subjects = readRecords(data, 'subjects', ['id', 'name']) as unknown as Subject[];
  const professors = readRecords(data, 'professors', ['id', 'name']).map((raw) => ({
    ...raw,
    subjectIds: Array.isArray(raw.subjectIds) ? raw.subjectIds.filter(isString) : [],
  })) as unknown as Professor[];
  const scheduleSlots = readRecords(data, 'scheduleSlots', ['id', 'subjectId']) as unknown as ScheduleSlot[];

  const notes: Note[] = readRecords(data, 'notes', ['id', 'subjectId']).map((raw) => {
    const now = new Date().toISOString();
    return {
      id: raw.id as string,
      subjectId: raw.subjectId as string,
      title: isString(raw.title) ? raw.title : '',
      content: isString(raw.content) ? sanitizeNoteHtml(raw.content) : '',
      tags: Array.isArray(raw.tags) ? raw.tags.filter(isString) : [],
      createdAt: isString(raw.createdAt) ? raw.createdAt : now,
      updatedAt: isString(raw.updatedAt) ? raw.updatedAt : now,
    };
  });

  const images: NoteImage[] = [];
  for (const raw of readRecords(data, 'images', ['id', 'noteId'])) {
    const match = isString(raw.dataUrl) ? SAFE_IMAGE_DATA_URL.exec(raw.dataUrl) : null;
    if (!match || !isString(raw.dataUrl)) continue;
    images.push({
      id: raw.id as string,
      noteId: raw.noteId as string,
      name: isString(raw.name) ? raw.name : 'imagen',
      mimeType: match[1],
      blob: dataUrlToBlob(raw.dataUrl),
      createdAt: isString(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
    });
  }

  return { subjects, professors, scheduleSlots, notes, images };
}

/**
 * 5. Restaura toda la base de datos de forma nativa e infalible en Android mediante SAF (Storage Access Framework)
 */
export async function pickAndRestoreBackup(): Promise<{ success: boolean; canceled?: boolean }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await WidgetBridge.pickAndReadJsonFile();
      if (res.canceled) {
        return { success: false, canceled: true };
      }
      if (res.content) {
        await restoreFromRawJson(res.content);
        return { success: true, canceled: false };
      }
    } catch (e) {
      console.warn('Fallo en selector nativo pickAndReadJsonFile:', e);
      throw e;
    }
  }
  return { success: false, canceled: false };
}

/**
 * Restaura toda la base de datos a partir de un archivo File (.json) en navegadores web
 */
export async function importDatabaseBackup(file: File): Promise<void> {
  let text = '';
  try {
    text = await file.text();
  } catch {
    text = '';
  }

  // Si file.text() devolvió vacío en algún WebView, recurrir a FileReader tradicional
  if (!text || text.trim() === '') {
    text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  if (!text || text.trim() === '') {
    throw new Error('El archivo seleccionado está vacío (0 bytes). Verifica que elegiste la copia de seguridad correcta.');
  }

  await restoreFromRawJson(text);
}
