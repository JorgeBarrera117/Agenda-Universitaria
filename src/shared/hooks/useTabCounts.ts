import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/AppDatabase';
import {
  DOCUMENTS_CHANGED_EVENT,
  readStoredDocumentsCount,
} from '../../features/subjects/hooks/useSubjectDocuments';

export interface TabCounts {
  subjectCount: number;
  professorsCount: number;
  notesCount: number;
  documentsCount: number;
}

function subscribeToDocuments(onChange: () => void): () => void {
  window.addEventListener(DOCUMENTS_CHANGED_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(DOCUMENTS_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Contadores para los badges de Navbar y BottomNav. Usa count() del motor de IndexedDB (las
 * materias se filtran para excluir las archivadas: son pocas y livianas), así que
 * no hidrata objetos de dominio ni blobs. Cada consulta devuelve un número primitivo: editar un
 * apunte vuelve a contar, pero si la cifra no cambia React descarta la actualización y el layout
 * no se re-renderiza. Los documentos se cuentan desde sus metadatos en localStorage.
 */
export function useTabCounts(): TabCounts {
  // Solo materias en curso: las archivadas (semestres anteriores) no cuentan para el badge
  const subjectCount = useLiveQuery(() => db.subjects.filter((subject) => !subject.isArchived).count(), [], 0);
  const professorsCount = useLiveQuery(() => db.professors.count(), [], 0);
  const notesCount = useLiveQuery(() => db.notes.count(), [], 0);
  const documentsCount = useSyncExternalStore(subscribeToDocuments, readStoredDocumentsCount);

  return { subjectCount, professorsCount, notesCount, documentsCount };
}
