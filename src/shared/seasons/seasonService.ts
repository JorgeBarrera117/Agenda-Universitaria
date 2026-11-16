/**
 * Temporadas festivas: decoraciones que la app activa sola según la fecha del dispositivo.
 *
 * - Navidad: del 1 al 30 de diciembre (nieve y fondo navideño).
 * - Año Nuevo: del 31 de diciembre al 31 de enero. Fuegos artificiales, chispas de fogata y un
 *   fondo con el año viejo (el monigote que en Ecuador se quema a medianoche), las 12 uvas y el
 *   reloj.
 *
 * Se apagan en Ajustes → Apariencia y tema → Decoración de temporada.
 */

export type Season = 'christmas' | 'newyear';

/**
 * Solo para pruebas: 'christmas' o 'newyear' fuerzan esa temporada y 'none' la apaga, sin
 * esperar a la fecha. Ejemplo: localStorage.setItem('agenda_season_override', 'newyear').
 */
export const SEASON_OVERRIDE_KEY = 'agenda_season_override';

function readOverride(): Season | 'none' | null {
  try {
    const value = localStorage.getItem(SEASON_OVERRIDE_KEY);
    return value === 'christmas' || value === 'newyear' || value === 'none' ? value : null;
  } catch {
    return null;
  }
}

export function getSeason(date: Date = new Date()): Season | null {
  const override = readOverride();
  if (override) return override === 'none' ? null : override;
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 11) return day === 31 ? 'newyear' : 'christmas';
  if (month === 0) return 'newyear';
  return null;
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Ánimo para el resto de enero: cambia cada día para que el saludo no se repita. */
const JANUARY_MESSAGES = [
  'Año nuevo, metas nuevas: ¡tú puedes con este semestre!',
  'Que este año tus apuntes estén al día y tus notas, por las nubes.',
  'Un paso a la vez: organiza tu semana y lo demás llega solo.',
  'Este es tu año. Aprovecha cada clase.',
  'Lo que empieces hoy, lo agradecerás en los exámenes.',
];

/** Saludo del día según la temporada: cuenta atrás y mensajes propios de las fechas clave. */
export function seasonGreeting(season: Season, date: Date = new Date()): SeasonGreeting {
  const month = date.getMonth();
  const day = date.getDate();

  if (season === 'christmas') {
    if (month === 11 && day < 24) {
      const left = daysBetween(date, new Date(date.getFullYear(), 11, 25));
      return { title: '¡Felices fiestas!', message: `Faltan ${plural(left, 'día', 'días')} para Navidad.` };
    }
    if (month === 11 && day === 24) return { title: '¡Feliz Nochebuena!', message: 'Mañana es Navidad. Disfruta con los tuyos.' };
    if (month === 11 && day === 25) return { title: '¡Feliz Navidad!', message: 'Que tengas un gran día. Hoy toca descansar.' };
    const left = daysBetween(date, new Date(date.getFullYear() + 1, 0, 1));
    return { title: '¡Felices fiestas!', message: `Faltan ${plural(left, 'día', 'días')} para Año Nuevo.` };
  }

  if (month === 11) {
    return { title: '¡Feliz fin de año!', message: 'Esta noche se quema el año viejo. ¡A recibir el nuevo con todo!' };
  }
  if (day === 1) return { title: '¡Feliz Año Nuevo!', message: 'Que este año venga lleno de logros.' };
  return { title: '¡Feliz Año Nuevo!', message: JANUARY_MESSAGES[day % JANUARY_MESSAGES.length] };
}
