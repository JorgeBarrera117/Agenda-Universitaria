import type { Subject } from '../../subjects/types';
import type { Note } from '../types';

/**
 * Apuntes personales: no pertenecen a ninguna materia (ideas, pendientes, notas de la vida
 * universitaria). Se guardan con `subjectId = ''` en lugar de null o undefined porque IndexedDB
 * sí indexa la cadena vacía: el filtro «Personal» usa el índice `subjectId` igual que una materia,
 * no hace falta migrar la base y los respaldos y archivos .agnote existentes siguen siendo válidos.
 */
export const PERSONAL_SUBJECT_ID = '';

/** Valor del filtro de la galería y del selector de materia para los apuntes personales. */
export const PERSONAL_CHOICE = 'personal';

export const PERSONAL_LABEL = 'Personal';
/** Terciario base de Material 3: se distingue de los colores de materia y contrasta con blanco. */
export const PERSONAL_COLOR = '#7D5260';
/** Ícono de SubjectIcon reservado para los apuntes personales (no se ofrece a las materias). */
export const PERSONAL_ICON = 'personal';

export function isPersonalNote(note: Pick<Note, 'subjectId'>): boolean {
  return note.subjectId === PERSONAL_SUBJECT_ID;
}

/** Cómo se muestra la clasificación de un apunte: su materia o «Personal». */
export interface NoteCategory {
  name: string;
  color: string;
  icon: string;
  code?: string;
  isPersonal: boolean;
}

export const PERSONAL_CATEGORY: NoteCategory = {
  name: PERSONAL_LABEL,
  color: PERSONAL_COLOR,
  icon: PERSONAL_ICON,
  isPersonal: true,
};

export function getNoteCategory(note: Pick<Note, 'subjectId'>, subjectMap: ReadonlyMap<string, Subject>): NoteCategory {
  if (isPersonalNote(note)) return PERSONAL_CATEGORY;
  const subject = subjectMap.get(note.subjectId);
  if (!subject) return { name: 'Sin materia', color: '#00639B', icon: 'book', isPersonal: false };
  return { name: subject.name, color: subject.color, icon: subject.icon ?? 'book', code: subject.code, isPersonal: false };
}

/** subjectId del apunte → valor del selector («personal» o el id de la materia). */
export function subjectIdToChoice(subjectId: string): string {
  return subjectId === PERSONAL_SUBJECT_ID ? PERSONAL_CHOICE : subjectId;
}

/** Valor del selector → subjectId que se guarda. */
export function choiceToSubjectId(choice: string): string {
  return choice === PERSONAL_CHOICE ? PERSONAL_SUBJECT_ID : choice;
}
