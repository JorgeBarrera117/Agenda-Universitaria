import type { AgendaEvent, AgendaReminderLead } from '../types';
import {
  MONTHS_LONG,
  MONTHS_SHORT,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  fromDateKey,
  monthGrid,
  toDateKey,
  type MonthCell,
} from '../../../shared/utils/calendarDates';

/**
 * Fechas de la agenda como texto "YYYY-MM-DD" en hora local: se comparan y ordenan como texto y no
 * sufren el corrimiento de zona horaria de toISOString(). Las básicas viven en shared/utils/calendarDates.
 */
export { MONTHS_LONG, fromDateKey, monthGrid, toDateKey, type MonthCell };

export function addDaysToKey(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(fromDateKey(value).getTime());
}

export function isTimeValue(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** ¿El evento ocupa ese día? (los días libres pueden abarcar varios días) */
export function eventCoversDay(event: AgendaEvent, dayKey: string): boolean {
  if (event.type === 'holiday' && event.endDate && event.endDate > event.date) {
    return dayKey >= event.date && dayKey <= event.endDate;
  }
  return event.date === dayKey;
}

/** Día libre o feriado que cae en esa fecha, si hay. */
export function holidayOn(events: readonly AgendaEvent[], dayKey: string): AgendaEvent | undefined {
  return events.find((event) => event.type === 'holiday' && eventCoversDay(event, dayKey));
}

/** Fechas de días libres entre dos días (inclusive), para no avisar de clases en ellas. */
export function holidayKeysBetween(events: readonly AgendaEvent[], fromKey: string, toKey: string): Set<string> {
  const keys = new Set<string>();
  for (const event of events) {
    if (event.type !== 'holiday') continue;
    let key = event.date;
    const last = event.endDate && event.endDate > event.date ? event.endDate : event.date;
    let guard = 0;
    while (key <= last && guard < 400) {
      if (key >= fromKey && key <= toKey) keys.add(key);
      key = addDaysToKey(key, 1);
      guard += 1;
    }
  }
  return keys;
}

const LEAD_MINUTES: Record<Exclude<AgendaReminderLead, 'none'>, number> = { at: 0, '1h': 60, '1d': 24 * 60, '2d': 48 * 60 };

/** Fechas de una repetición: desde `start`, cada `everyWeeks` semanas, hasta `until` (como mucho `max`). */
export function repeatDates(start: string, everyWeeks: number, until: string, max: number): string[] {
  const dates: string[] = [];
  for (let key = start; key <= until && dates.length < max; key = addDaysToKey(key, everyWeeks * 7)) dates.push(key);
  return dates;
}

/** Momento del aviso de un evento (sin hora, cuenta desde las 08:00 de su día); null si no avisa. */
export function reminderMoment(event: AgendaEvent): Date | null {
  if (event.remind === 'none' || event.done) return null;
  const base = fromDateKey(event.date, event.time || '08:00');
  return new Date(base.getTime() - LEAD_MINUTES[event.remind] * 60_000);
}


/** "Hoy", "Mañana", "Ayer" o "mar 24 nov". */
export function relativeDayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return 'Hoy';
  if (key === addDaysToKey(todayKey, 1)) return 'Mañana';
  if (key === addDaysToKey(todayKey, -1)) return 'Ayer';
  const date = fromDateKey(key);
  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4);
  return `${WEEKDAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}`}`;
}

/** "Martes 24 de noviembre". */
export function longDayLabel(key: string): string {
  const date = fromDateKey(key);
  return `${WEEKDAYS_LONG[date.getDay()]} ${date.getDate()} de ${MONTHS_LONG[date.getMonth()].toLowerCase()}`;
}

/** Día de la semana como en el horario: 1 = lunes … 7 = domingo. */
export function scheduleWeekday(key: string): number {
  const day = fromDateKey(key).getDay();
  return day === 0 ? 7 : day;
}
