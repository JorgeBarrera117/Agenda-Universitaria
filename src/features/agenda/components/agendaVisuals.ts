import type { AgendaEvent } from '../types';
import type { Subject } from '../../subjects/types';

/** Rojo de error de Material 3: los días libres resaltan como en un calendario de pared. */
export const HOLIDAY_COLOR = '#BA1A1A';
/** Sin materia, los eventos usan el azul de la app. */
const NEUTRAL_COLOR = '#00639B';

export function agendaEventColor(event: Pick<AgendaEvent, 'type' | 'subjectId'>, subjects: readonly Subject[]): string {
  if (event.type === 'holiday') return HOLIDAY_COLOR;
  const subject = event.subjectId ? subjects.find((s) => s.id === event.subjectId) : undefined;
  return subject?.color || NEUTRAL_COLOR;
}
