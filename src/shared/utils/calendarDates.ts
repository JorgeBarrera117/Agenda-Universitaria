/**
 * Fechas de calendario como texto "YYYY-MM-DD" en hora local (sin el corrimiento de zona horaria
 * de toISOString). Las usan la Agenda y el selector de fecha.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Fecha local a medianoche (o a la hora dada) de un "YYYY-MM-DD". */
export function fromDateKey(key: string, time?: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const [h, min] = (time || '00:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h || 0, min || 0, 0, 0);
}

export const MONTHS_LONG = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const WEEKDAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Encabezado de la cuadrícula (empieza en lunes). */
export const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export interface MonthCell {
  key: string;
  day: number;
  inMonth: boolean;
}

/** Cuadrícula de un mes que empieza en lunes: 6 semanas (42 días) para que no salte de alto. */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // lunes = 0
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(year, month, 1 - offset + i);
    cells.push({ key: toDateKey(date), day: date.getDate(), inMonth: date.getMonth() === month });
  }
  return cells;
}

/** "vie, 20 nov" (con el año solo si no es el actual, para que quepa en campos angostos). */
export function mediumDateLabel(key: string): string {
  const date = fromDateKey(key);
  const year = date.getFullYear() === new Date().getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}${year}`;
}
