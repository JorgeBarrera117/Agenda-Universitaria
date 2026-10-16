import { registerPlugin, Capacitor } from '@capacitor/core';
import { db } from '../db/AppDatabase';
import type { NoteImage } from '../../features/notes/types';

interface WidgetBridgePlugin {
  updateWidgetData(options: { dataJson: string }): Promise<{ success: boolean }>;
  exportJsonFile(options: { content: string; fileName: string }): Promise<{ success: boolean; canceled?: boolean }>;
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
  method: 'share' | 'file-picker' | 'download';
  canceled?: boolean;
}

export async function exportDatabaseBackup(): Promise<ExportResult> {
  const subjects = await db.subjects.toArray();
  const professors = await db.professors.toArray();
  const scheduleSlots = await db.scheduleSlots.toArray();
  const notes = await db.notes.toArray();
  const rawImages = await db.noteImages.toArray();

  // Convertir cada imagen en base64 para poder exportarla dentro del JSON
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
  const blob = new Blob([jsonString], { type: 'application/json' });

  // 1. En entorno Android / Nativo de Capacitor:
  // Usamos el Storage Access Framework (SAF) nativo mediante ACTION_CREATE_DOCUMENT.
  // Abre el explorador de archivos oficial del sistema ("Guardar como...") permitiendo al usuario
  // elegir la carpeta exacta (Descargas, Documentos, Drive, SD), modificar el nombre si desea y guardar.
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
    } catch (nativeErr) {
      console.error('Error en exportación nativa SAF:', nativeErr);
      // Si por alguna anomalía el selector nativo falla, continúa a los fallbacks web
    }
  }

  // 2. En Desktop (Chrome, Edge, Opera) con File System Access API:
  // Abre el explorador de archivos nativo "Guardar como..." para que el usuario elija la ruta exacta.
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
      return { method: 'file-picker' };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { method: 'file-picker', canceled: true };
      }
      // Si el usuario cancela o hay error, continuar a compartir o descarga
    }
  }

  // 3. En navegadores móviles con Web Share API (archivos):
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const file = new File([blob], fileName, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Respaldo Agenda Universitaria',
          text: 'Copia de seguridad en formato JSON de la Agenda Universitaria.',
        });
        return { method: 'share' };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { method: 'share', canceled: true };
      }
      // Si falla o el usuario no puede compartir archivos, continúa al siguiente método
    }
  }

  // 4. Fallback tradicional: descarga directa en la carpeta de Descargas
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return { method: 'download' };
}

export async function importDatabaseBackup(file: File): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text);

  if (!parsed.data || !parsed.data.subjects) {
    throw new Error('El archivo no contiene un formato de respaldo válido.');
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
