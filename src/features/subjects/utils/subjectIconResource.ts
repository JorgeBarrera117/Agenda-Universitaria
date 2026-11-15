import { SUBJECT_ICONS } from '../components/SubjectIcon';

/** Íconos que existen como recurso de Android (ver scripts/generate-android-subject-icons.mjs). */
const ANDROID_ICON_IDS = new Set<string>([...SUBJECT_ICONS.map((option) => option.id), 'personal']);

/**
 * Nombre del recurso de Android (res/drawable/ic_subject_*.xml) del ícono de una materia, para las
 * notificaciones y los widgets. Un ícono desconocido usa el libro, igual que la app.
 */
export function androidSubjectIconResource(iconId: string | undefined): string {
  const id = iconId && ANDROID_ICON_IDS.has(iconId) ? iconId : 'book';
  return `ic_subject_${id.replace(/-/g, '_')}`;
}
