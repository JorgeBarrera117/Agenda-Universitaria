import type { SubjectDocumentItem } from '../hooks/useSubjectDocuments';
import { blobToDataUrl, dataUrlToBlob } from '../../../shared/utils/dataUrl';

/**
 * Repositorio de la sección Archivos (documentos de cada materia).
 *
 * Vive aparte de la base de datos principal (Dexie):
 * - metadatos en localStorage;
 * - contenido (Blob) en su propia base IndexedDB, «AgendaDocsCacheDB».
 * Por eso no entraba en la copia de seguridad. Este módulo lo exporta y lo restaura para la
 * transferencia entre dispositivos.
 */

export const DOCUMENTS_STORAGE_KEY = 'agenda_subject_documents_metadata_v1';
const DB_NAME = 'AgendaDocsCacheDB';
const STORE_NAME = 'blobs';

// Los metadatos viven en localStorage (no en Dexie), así que cada instancia del hook carga su
// propia copia. Este evento avisa a los demás consumidores (p. ej. los contadores de pestañas).
export const DOCUMENTS_CHANGED_EVENT = 'agenda_documents_updated';

export function readStoredDocuments(): SubjectDocumentItem[] {
  try {
    const raw = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SubjectDocumentItem[]) : [];
  } catch {
    return [];
  }
}

export function writeStoredDocuments(docs: SubjectDocumentItem[]): void {
  localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(docs));
  window.dispatchEvent(new Event(DOCUMENTS_CHANGED_EVENT));
}

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

export async function saveBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDocsDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ id, blob });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getBlob(id: string): Promise<Blob | null> {
  const db = await openDocsDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ? (req.result.blob as Blob) : null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBlob(id: string): Promise<void> {
  const db = await openDocsDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Reemplaza todo el contenido del almacén en una sola transacción (o nada, si falla). */
async function replaceAllBlobs(entries: { id: string; blob: Blob }[]): Promise<void> {
  const db = await openDocsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const entry of entries) store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('No se pudieron guardar los archivos.'));
  });
}

/* ------------------------------------------------------------- Transferencia entre dispositivos */

/** Documento listo para viajar dentro del respaldo: metadatos y, si es un archivo, su contenido. */
export interface SerializedDocument {
  id: string;
  subjectId: string;
  name: string;
  fileExtension: string;
  mimeType: string;
  sizeBytes?: number;
  createdAt: string;
  isExternalLink?: boolean;
  externalUrl?: string;
  /** Contenido del archivo como data URL (los enlaces externos no tienen). */
  dataUrl?: string;
}

/** Todos los documentos con su contenido. Un archivo cuyo contenido ya no existe se omite. */
export async function exportDocuments(): Promise<SerializedDocument[]> {
  const result: SerializedDocument[] = [];
  for (const doc of readStoredDocuments()) {
    const meta: SerializedDocument = {
      id: doc.id,
      subjectId: doc.subjectId,
      name: doc.name,
      fileExtension: doc.fileExtension,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      createdAt: doc.createdAt,
      isExternalLink: doc.isExternalLink,
      externalUrl: doc.externalUrl,
    };
    if (doc.isExternalLink) {
      result.push(meta);
      continue;
    }
    const blob = await getBlob(doc.id);
    if (blob) result.push({ ...meta, dataUrl: await blobToDataUrl(blob) });
  }
  return result;
}

const isString = (value: unknown): value is string => typeof value === 'string';
const SAFE_EXTERNAL_URL = /^https?:\/\//i;

export interface PreparedDocuments {
  metadata: SubjectDocumentItem[];
  blobs: { id: string; blob: Blob }[];
}

/**
 * Valida y convierte los documentos recibidos SIN tocar nada todavía. Si algo no es válido,
 * lanza el error antes de borrar los datos de este dispositivo.
 */
export function prepareDocuments(raw: unknown): PreparedDocuments {
  if (!Array.isArray(raw)) throw new Error('La lista de archivos recibida no es válida.');
  const metadata: SubjectDocumentItem[] = [];
  const blobs: { id: string; blob: Blob }[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) throw new Error('Un archivo recibido no es válido.');
    const doc = item as Record<string, unknown>;
    if (!isString(doc.id) || !isString(doc.subjectId) || !isString(doc.name) || !isString(doc.createdAt)) {
      throw new Error('Un archivo recibido no tiene sus datos completos.');
    }
    const isLink = doc.isExternalLink === true;
    if (isLink && !(isString(doc.externalUrl) && SAFE_EXTERNAL_URL.test(doc.externalUrl))) {
      throw new Error(`El enlace «${doc.name}» no es válido.`);
    }
    if (!isLink && !(isString(doc.dataUrl) && doc.dataUrl.startsWith('data:'))) {
      throw new Error(`El archivo «${doc.name}» llegó sin contenido.`);
    }
    metadata.push({
      id: doc.id,
      subjectId: doc.subjectId,
      name: doc.name,
      fileExtension: isString(doc.fileExtension) ? doc.fileExtension : 'bin',
      mimeType: isString(doc.mimeType) ? doc.mimeType : 'application/octet-stream',
      sizeBytes: typeof doc.sizeBytes === 'number' ? doc.sizeBytes : undefined,
      createdAt: doc.createdAt,
      isExternalLink: isLink || undefined,
      externalUrl: isLink ? (doc.externalUrl as string) : undefined,
    });
    if (!isLink) blobs.push({ id: doc.id, blob: dataUrlToBlob(doc.dataUrl as string) });
  }
  return { metadata, blobs };
}

/** Sustituye todos los documentos de este dispositivo por los recibidos (ya validados). */
export async function replaceAllDocuments(prepared: PreparedDocuments): Promise<void> {
  await replaceAllBlobs(prepared.blobs);
  writeStoredDocuments(prepared.metadata);
}
