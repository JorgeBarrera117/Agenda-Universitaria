import { SUBJECT_ICONS, SUBJECT_PRESET_COLORS } from '../components/SubjectIcon';

/** Íconos que existen como recurso de Android (ver scripts/generate-android-subject-icons.mjs). */
const ANDROID_ICON_IDS = new Set<string>([...SUBJECT_ICONS.map((option) => option.id), 'personal']);

/** Colores con ícono grande de notificación (scripts/generate-android-notification-icons.cjs). */
const LARGE_ICON_COLORS = SUBJECT_PRESET_COLORS.map((color) => color.toLowerCase());

/**
 * Nombre del recurso de Android (res/drawable/ic_subject_*.xml) del ícono de una materia, para los
 * widgets. Un ícono desconocido usa el libro, igual que la app.
 */
export function androidSubjectIconResource(iconId: string | undefined): string {
  const id = iconId && ANDROID_ICON_IDS.has(iconId) ? iconId : 'book';
  return `ic_subject_${id.replace(/-/g, '_')}`;
}

function toRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Color de la paleta más parecido (distancia RGB ponderada según la sensibilidad del ojo). */
function nearestPaletteColor(color: string | undefined): string {
  const target = color ? toRgb(color) : null;
  if (!target) return LARGE_ICON_COLORS[0];
  let best = LARGE_ICON_COLORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of LARGE_ICON_COLORS) {
    const rgb = toRgb(candidate);
    if (!rgb) continue;
    const distance = 2 * (rgb[0] - target[0]) ** 2 + 4 * (rgb[1] - target[1]) ** 2 + 3 * (rgb[2] - target[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/**
 * Ícono GRANDE de la notificación de una clase (res/drawable-nodpi/ic_lg_<ícono>_<color>.png): el
 * ícono de la materia sobre un círculo de su color. El plugin solo acepta imágenes empaquetadas, así
 * que un color propio usa el de la paleta más parecido.
 */
export function androidSubjectLargeIcon(iconId: string | undefined, color: string | undefined): string {
  const id = iconId && ANDROID_ICON_IDS.has(iconId) && iconId !== 'personal' ? iconId : 'book';
  return `ic_lg_${id.replace(/-/g, '_')}_${nearestPaletteColor(color).slice(1)}`;
}
