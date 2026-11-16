/**
 * Temporadas festivas: decoraciones que la app activa sola según la fecha del dispositivo.
 *
 * Navidad va del 1 de diciembre al 6 de enero (Día de Reyes), cuando termina la temporada en
 * Latinoamérica. Se puede apagar en Ajustes → Apariencia y tema → Decoración de temporada.
 */

export type Season = 'christmas';

/**
 * Solo para pruebas: 'christmas' fuerza la temporada y 'none' la apaga, sin esperar a diciembre.
 * Ejemplo: localStorage.setItem('agenda_season_override', 'christmas').
 */
export const SEASON_OVERRIDE_KEY = 'agenda_season_override';

function readOverride(): Season | 'none' | null {
  try {
    const value = localStorage.getItem(SEASON_OVERRIDE_KEY);
    return value === 'christmas' || value === 'none' ? value : null;
  } catch {
    return null;
  }
}

export function getSeason(date: Date = new Date()): Season | null {
  const override = readOverride();
  if (override) return override === 'none' ? null : override;
  const month = date.getMonth();
  const day = date.getDate();
  return month === 11 || (month === 0 && day <= 6) ? 'christmas' : null;
}

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

export interface SeasonGreeting {
  title: string;
  message: string;
}

/** Saludo del día: cuenta atrás a Navidad y Año Nuevo, y mensajes propios del 24, 25, 31 y 1. */
export function christmasGreeting(date: Date = new Date()): SeasonGreeting {
  const month = date.getMonth();
  const day = date.getDate();
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  if (month === 11) {
    if (day < 24) {
      const left = daysBetween(date, new Date(date.getFullYear(), 11, 25));
      return { title: '¡Felices fiestas!', message: `Faltan ${plural(left, 'día', 'días')} para Navidad.` };
    }
    if (day === 24) return { title: '¡Feliz Nochebuena!', message: 'Mañana es Navidad. Disfruta con los tuyos.' };
    if (day === 25) return { title: '¡Feliz Navidad!', message: 'Que tengas un gran día. Hoy toca descansar.' };
    if (day < 31) {
      const left = daysBetween(date, new Date(date.getFullYear() + 1, 0, 1));
      return { title: '¡Felices fiestas!', message: `Faltan ${plural(left, 'día', 'días')} para Año Nuevo.` };
    }
    return { title: '¡Feliz fin de año!', message: 'Hoy despedimos el año. ¡Gracias por estudiar con la agenda!' };
  }
  if (day === 1) return { title: '¡Feliz Año Nuevo!', message: 'Que este año venga lleno de logros.' };
  return { title: '¡Feliz Año Nuevo!', message: 'Mucho éxito en todo lo que viene.' };
}
