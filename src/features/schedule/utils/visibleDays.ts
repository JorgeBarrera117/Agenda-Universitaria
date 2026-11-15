import type { AppSettings } from '../../settings/types';
import type { DayOfWeek } from '../types';

const ALL_DAYS: readonly DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Días que muestra el horario: los del rango elegido en Ajustes (Lun-Vie, Lun-Sáb o todos) y,
 * además, cualquier día que tenga clases (para no esconder una clase por el ajuste).
 *
 * El día de hoy NO se agrega por sí solo: antes, un domingo con el rango «Lun - Sáb» la vista
 * semanal mostraba también la columna del domingo y parecía que el ajuste no se aplicaba.
 */
export function getDisplayedDays(visibleDays: AppSettings['visibleDays'], daysWithClasses: Iterable<DayOfWeek>): DayOfWeek[] {
  const lastInRange: DayOfWeek = visibleDays === 'all' ? 7 : visibleDays === 'mon-sat' ? 6 : 5;
  const days = new Set<DayOfWeek>(ALL_DAYS.filter((day) => day <= lastInRange));
  for (const day of daysWithClasses) days.add(day);
  return ALL_DAYS.filter((day) => days.has(day));
}

/**
 * Día que se ve en la vista por día y en el selector del teléfono. Si el elegido (al abrir la app,
 * hoy) no está entre los visibles, se pasa al siguiente que sí lo esté: un domingo con «Lun - Sáb»
 * se abre en el lunes.
 */
export function resolveVisibleDay(day: DayOfWeek, displayed: readonly DayOfWeek[]): DayOfWeek {
  if (displayed.length === 0 || displayed.includes(day)) return day;
  for (let offset = 1; offset < 7; offset++) {
    const candidate = (((day - 1 + offset) % 7) + 1) as DayOfWeek;
    if (displayed.includes(candidate)) return candidate;
  }
  return displayed[0];
}
