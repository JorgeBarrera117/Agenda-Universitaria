import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { WidgetBridge } from '../../../shared/plugins/widgetBridge';
import { isShareCanceled, shareText, type ShareOutcome } from '../../../shared/utils/shareText';

// Helper para convertir Blob a base64 puro (sin prefijo data:...)
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface SubjectDocumentItem {
  id: string;
  subjectId: string;
  name: string;
  fileExtension: string;
  mimeType: string;
  sizeBytes?: number;
  createdAt: string;
  isExternalLink?: boolean;
  externalUrl?: string;
  blob?: Blob;
}

const STORAGE_KEY = 'agenda_subject_documents_metadata_v1';
const DB_NAME = 'AgendaDocsCacheDB';
const STORE_NAME = 'blobs';

// Los metadatos viven en localStorage (no en Dexie), así que cada instancia del hook carga su
// propia copia. Este evento avisa a los demás consumidores (p. ej. los contadores de pestañas).
export const DOCUMENTS_CHANGED_EVENT = 'agenda_documents_updated';

/** Resultado de compartir un documento: igual que shareText, más la descarga como último recurso. */
export type DocumentShareOutcome = ShareOutcome | 'downloaded';

/** Nombre con extensión: quien lo recibe (y Android) necesita saber qué tipo de archivo es. */
function shareFileName(doc: SubjectDocumentItem): string {
  const ext = doc.fileExtension?.toLowerCase();
  if (!ext || ext === 'bin' || doc.name.toLowerCase().endsWith(`.${ext}`)) return doc.name;
  return `${doc.name}.${ext}`;
}

function writeStoredDocuments(docs: SubjectDocumentItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  window.dispatchEvent(new Event(DOCUMENTS_CHANGED_EVENT));
}

let cachedRaw: string | null = null;
let cachedCount = 0;

/** Total de documentos guardados; solo vuelve a parsear el JSON cuando su texto cambia. */
export function readStoredDocumentsCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      cachedCount = Array.isArray(parsed) ? parsed.length : 0;
    }
    return cachedCount;
  } catch {
    return 0;
  }
}

// Inicializador de base de datos aislada para blobs sin alterar la DB principal
function openDocsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDocsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ id, blob });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDocsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBlob(id: string): Promise<void> {
  const db = await openDocsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function useSubjectDocuments(subjectId?: string) {
  const [documents, setDocuments] = useState<SubjectDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar metadatos desde almacenamiento
  const loadDocuments = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const allDocs: SubjectDocumentItem[] = raw ? JSON.parse(raw) : [];
      if (subjectId) {
        setDocuments(allDocs.filter((d) => d.subjectId === subjectId));
      } else {
        setDocuments(allDocs);
      }
    } catch {
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Agregar un documento vinculado desde archivo local
  const addLocalDocument = async (
    targetSubjectId: string,
    file: File
  ): Promise<SubjectDocumentItem> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const newDoc: SubjectDocumentItem = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      subjectId: targetSubjectId,
      name: file.name,
      fileExtension: ext,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    };

    // Guardar blob en almacén de caché aislado
    await saveBlob(newDoc.id, file);

    // Guardar metadatos en localStorage
    const raw = localStorage.getItem(STORAGE_KEY);
    const allDocs: SubjectDocumentItem[] = raw ? JSON.parse(raw) : [];
    allDocs.push(newDoc);
    writeStoredDocuments(allDocs);

    loadDocuments();
    return newDoc;
  };

  // Agregar un enlace externo (Google Drive, OneDrive, etc.)
  const addExternalLink = async (
    targetSubjectId: string,
    name: string,
    url: string
  ): Promise<SubjectDocumentItem> => {
    const ext = 'url';
    const newDoc: SubjectDocumentItem = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      subjectId: targetSubjectId,
      name: name.trim(),
      fileExtension: ext,
      mimeType: 'text/uri-list',
      createdAt: new Date().toISOString(),
      isExternalLink: true,
      externalUrl: url.trim(),
    };

    const raw = localStorage.getItem(STORAGE_KEY);
    const allDocs: SubjectDocumentItem[] = raw ? JSON.parse(raw) : [];
    allDocs.push(newDoc);
    writeStoredDocuments(allDocs);

    loadDocuments();
    return newDoc;
  };

  // Abrir documento (puente hacia la app correspondiente del SO)
  const openDocument = async (doc: SubjectDocumentItem) => {
    if (doc.isExternalLink && doc.externalUrl) {
      window.open(doc.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const blob = await getBlob(doc.id);
    if (!blob) {
      throw new Error('El archivo no está disponible en la caché local.');
    }

    // En dispositivos móviles (Android nativo): usar Intent del SO para abrir el selector de apps
    if (Capacitor.isNativePlatform()) {
      const base64Data = await blobToBase64(blob);
      await WidgetBridge.openDocument({
        fileName: doc.name,
        base64Data,
        mimeType: doc.mimeType,
      });
      return;
    }

    // En Electron nativo (Windows PC): abrir directamente con la app predeterminada del sistema (Acrobat, Word, Excel, etc.)
    if (typeof window !== 'undefined' && window.electronAPI?.openDocument) {
      const base64Data = await blobToBase64(blob);
      const res = await window.electronAPI.openDocument({
        fileName: doc.name,
        base64Data,
        mimeType: doc.mimeType,
      });
      if (res && res.success === false && res.error) {
        throw new Error(res.error);
      }
      return;
    }

    // En navegador web de escritorio: fallback con enlace temporal
    const objectUrl = URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.href = objectUrl;
    tempLink.download = doc.name;
    tempLink.target = '_blank';
    tempLink.rel = 'noopener,noreferrer';
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);

    // Liberar recurso tras un margen de tiempo
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
  };

  /**
   * Comparte un documento hacia WhatsApp, Gmail, Telegram…
   * - Enlace externo: título y URL como texto (hoja nativa en Android, Web Share o portapapeles).
   * - Archivo local en Android: el binario real por el puente nativo (FileProvider).
   * - Archivo local en la web: Web Share con archivos si el navegador lo admite; si no, se descarga.
   */
  const shareDocument = async (doc: SubjectDocumentItem): Promise<DocumentShareOutcome> => {
    if (doc.isExternalLink && doc.externalUrl) {
      return shareText({ title: doc.name, text: `${doc.name}\n${doc.externalUrl}` });
    }

    const blob = await getBlob(doc.id);
    if (!blob) {
      throw new Error('El archivo no está disponible en la caché local.');
    }
    const fileName = shareFileName(doc);
    const mimeType = doc.mimeType || blob.type || 'application/octet-stream';

    if (Capacitor.isNativePlatform()) {
      const base64Data = await blobToBase64(blob);
      await WidgetBridge.shareFile({ fileName, base64Data, mimeType });
      return 'shared';
    }

    const file = new File([blob], fileName, { type: mimeType });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: doc.name });
        return 'shared';
      } catch (err) {
        if (isShareCanceled(err)) return 'canceled';
        console.warn('Web Share API con archivos:', err);
      }
    }

    // Último recurso (PC sin Web Share): descargar para adjuntarlo a mano
    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    return 'downloaded';
  };

  // Eliminar acceso directo
  const deleteDocument = async (docId: string) => {
    await deleteBlob(docId);
    const raw = localStorage.getItem(STORAGE_KEY);
    const allDocs: SubjectDocumentItem[] = raw ? JSON.parse(raw) : [];
    const filtered = allDocs.filter((d) => d.id !== docId);
    writeStoredDocuments(filtered);
    loadDocuments();
  };

  // Obtener conteo de documentos por materia
  const getDocumentCountForSubject = (subjId: string): number => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const allDocs: SubjectDocumentItem[] = raw ? JSON.parse(raw) : [];
      return allDocs.filter((d) => d.subjectId === subjId).length;
    } catch {
      return 0;
    }
  };

  // Reasignar documento a otra materia
  const reassignSubject = async (docId: string, newSubjectId: string) => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const allDocs: SubjectDocumentItem[] = raw ? JSON.parse(raw) : [];
    const updated = allDocs.map((d) => (d.id === docId ? { ...d, subjectId: newSubjectId } : d));
    writeStoredDocuments(updated);
    loadDocuments();
  };

  // Obtener conteo total global de documentos
  const getTotalDocumentsCount = (): number => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const allDocs: SubjectDocumentItem[] = raw ? JSON.parse(raw) : [];
      return allDocs.length;
    } catch {
      return 0;
    }
  };

  return {
    documents,
    isLoading,
    addLocalDocument,
    addExternalLink,
    openDocument,
    shareDocument,
    deleteDocument,
    reassignSubject,
    getDocumentCountForSubject,
    getTotalDocumentsCount,
    reload: loadDocuments,
  };
}
