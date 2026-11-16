import type { TimeFormat } from '../../features/settings/types';

/**
 * Hora «HH:MM» (como se guarda en el horario) para mostrarla según Ajustes → General:
 * 24 h → «15:00»; 12 h → «3:00 p. m.». Un valor mal formado se devuelve tal cual.
 */
export function formatClockTime(time: string, format: TimeFormat | undefined): string {
  if (format !== '12h') return time;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  const hours = Number(match[1]);
  if (hours > 23) return time;
  const suffix = hours < 12 ? 'a. m.' : 'p. m.';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${match[2]} ${suffix}`;
}

/** Rango «08:00 – 10:00» o «8:00 a. m. – 10:00 a. m.». */
export function formatTimeRange(start: string, end: string, format: TimeFormat | undefined, separator = ' – '): string {
  return `${formatClockTime(start, format)}${separator}${formatClockTime(end, format)}`;
}
