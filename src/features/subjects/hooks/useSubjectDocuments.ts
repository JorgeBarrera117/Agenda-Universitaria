import { useState, useEffect, useCallback } from 'react';

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allDocs));

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allDocs));

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

    const objectUrl = URL.createObjectURL(blob);

    // Intentar abrir con visor predeterminado del sistema operativo
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

  // Eliminar acceso directo
  const deleteDocument = async (docId: string) => {
    await deleteBlob(docId);
    const raw = localStorage.getItem(STORAGE_KEY);
    const allDocs: SubjectDocumentItem[] = raw ? JSON.parse(raw) : [];
    const filtered = allDocs.filter((d) => d.id !== docId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
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

  return {
    documents,
    isLoading,
    addLocalDocument,
    addExternalLink,
    openDocument,
    deleteDocument,
    getDocumentCountForSubject,
    reload: loadDocuments,
  };
}
