import { registerPlugin, Capacitor } from '@capacitor/core';
import { db } from '../db/AppDatabase';
import type { NoteImage } from '../../features/notes/types';

interface WidgetBridgePlugin {
  updateWidgetData(options: { dataJson: string }): Promise<{ success: boolean }>;
  exportJsonFile(options: { content: string; fileName: string }): Promise<{ success: boolean; canceled?: boolean }>;
  saveToDownloads(options: { content: string; fileName: string }): Promise<{ success: boolean; fileName: string }>;
  shareJsonFile(options: { content: string; fileName: string }): Promise<{ success: boolean }>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

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
  const parsed = JSON.parse(rawText);

  if (!parsed.data || !parsed.data.subjects) {
    throw new Error('El archivo no contiene un formato de respaldo válido de Agenda Universitaria.');
  }

  // Reconstruir los Blobs binarios desde base64
  const restoredImages: NoteImage[] = [];
  if (parsed.data.images && Array.isArray(parsed.data.images)) {
    for (const raw of parsed.data.images) {
      if (raw.dataUrl) {
        restoredImages.push({
          id: raw.id,
          noteId: raw.noteId,
          name: raw.name,
          mimeType: raw.mimeType,
          blob: dataUrlToBlob(raw.dataUrl),
          createdAt: raw.createdAt,
        });
      }
    }
  }

  await db.transaction('rw', [db.subjects, db.professors, db.scheduleSlots, db.notes, db.noteImages], async () => {
    await db.subjects.clear();
    await db.professors.clear();
    await db.scheduleSlots.clear();
    await db.notes.clear();
    await db.noteImages.clear();

    if (parsed.data.subjects?.length) await db.subjects.bulkAdd(parsed.data.subjects);
    if (parsed.data.professors?.length) await db.professors.bulkAdd(parsed.data.professors);
    if (parsed.data.scheduleSlots?.length) await db.scheduleSlots.bulkAdd(parsed.data.scheduleSlots);
    if (parsed.data.notes?.length) await db.notes.bulkAdd(parsed.data.notes);
    if (restoredImages.length) await db.noteImages.bulkAdd(restoredImages);
  });
}

/**
 * Restaura toda la base de datos a partir de un archivo File (.json)
 */
export async function importDatabaseBackup(file: File): Promise<void> {
  const text = await file.text();
  await restoreFromRawJson(text);
}
