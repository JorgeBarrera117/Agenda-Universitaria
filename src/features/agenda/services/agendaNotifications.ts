import type { Subject } from '../../subjects/types';
import type { AgendaEvent } from '../types';
import {
  addDaysToKey,
  fromDateKey,
  holidayKeysBetween,
  relativeDayLabel,
  reminderMoment,
  scheduleWeekday,
  toDateKey,
} from '../utils/agendaDates';

/**
 * Avisos de la agenda y días libres para el servicio de notificaciones (Android y escritorio).
 * Solo funciones puras: reciben los datos y la hora actual y devuelven qué avisar y cuándo.
 */

/** Días hacia adelante en que se buscan días libres para no avisar de clases. */
export const HOLIDAY_HORIZON_DAYS = 56;
/** Máximo de avisos de la agenda programados a la vez (los más cercanos). */
const MAX_AGENDA_REMINDERS = 100;

/** Hash de 32 bits estable para derivar ids numéricos de notificación. */
export function hash32(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export interface AgendaReminderSpec {
  id: number;
  at: Date;
  title: string;
  body: string;
  subject?: Subject;
}

/** Avisos de tareas, exámenes y recordatorios que aún no pasaron, del más cercano al más lejano. */
export function buildAgendaReminders(events: readonly AgendaEvent[], subjects: readonly Subject[], now: Date): AgendaReminderSpec[] {
  const specs: AgendaReminderSpec[] = [];
  for (const event of events) {
    if (event.type === 'holiday') continue;
    const at = reminderMoment(event);
    if (!at || at.getTime() <= now.getTime()) continue;
    const subject = event.subjectId ? subjects.find((s) => s.id === event.subjectId) : undefined;
    // "hoy", "mañana" o la fecha, vistos desde el momento del aviso
    const day = relativeDayLabel(event.date, toDateKey(at)).toLowerCase();
    const time = event.time ? ` a las ${event.time}` : '';
    const subjectPart = subject ? ` · ${subject.name}` : '';
    let title: string;
    let body: string;
    if (event.type === 'task') {
      title = `Tarea: ${event.title}`;
      body = `Vence ${day}${time}${subjectPart}`;
    } else if (event.type === 'exam') {
      title = `Examen: ${event.title}`;
      body = `Es ${day}${time}${subjectPart}${event.place ? ` · ${event.place}` : ''}`;
    } else {
      title = event.title;
      body = `Recordatorio para ${day}${time}${subjectPart}`;
    }
    specs.push({ id: 4_000_000 + (hash32(event.id) % 10_000_000), at, title, body, subject });
  }
  return specs.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_AGENDA_REMINDERS);
}

/** Días libres ("YYYY-MM-DD") de hoy a HOLIDAY_HORIZON_DAYS adelante. */
export function upcomingHolidayKeys(events: readonly AgendaEvent[], now: Date): Set<string> {
  const today = toDateKey(now);
  return holidayKeysBetween(events, today, addDaysToKey(today, HOLIDAY_HORIZON_DAYS));
}

/** ¿Hay algún día libre próximo que caiga en ese día de la semana (1 = lunes … 7 = domingo)? */
export function holidayFallsOn(holidays: ReadonlySet<string>, weekday: number): boolean {
  for (const key of holidays) if (scheduleWeekday(key) === weekday) return true;
  return false;
}

/**
 * Fechas de las próximas semanas en ese día de la semana que NO son días libres. Android repite los
 * avisos de clase cada semana y no puede saltarse un día: si hay un día libre, esas clases se
 * programan fecha por fecha durante HOLIDAY_HORIZON_DAYS (se vuelve a calcular al abrir la app).
 */
export function classDatesSkippingHolidays(weekday: number, holidays: ReadonlySet<string>, now: Date): string[] {
  const today = toDateKey(now);
  const dates: string[] = [];
  for (let offset = 0; offset <= HOLIDAY_HORIZON_DAYS; offset += 1) {
    const key = addDaysToKey(today, offset);
    if (scheduleWeekday(key) === weekday && !holidays.has(key)) dates.push(key);
  }
  return dates;
}

/** Momento de un aviso en una fecha y hora, adelantado `minutesBefore` minutos. */
export function momentOn(dateKey: string, time: string, minutesBefore = 0): Date {
  return new Date(fromDateKey(dateKey, time).getTime() - minutesBefore * 60_000);
}
