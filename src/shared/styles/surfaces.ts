/**
 * Superficies de legibilidad sobre el papel tapiz (Fase 9). Dan un respaldo translúcido con
 * desenfoque a los textos que antes flotaban directamente sobre el fondo, para que se lean bien
 * sobre cualquier patrón o foto. Solo usan tokens del tema.
 */

/** Cápsula de cabecera de pantalla: título, insignias, subtítulo y acciones principales. */
export const HEADER_SCRIM_CLASS =
  'rounded-2xl border border-[var(--color-md-outline-variant)]/30 bg-[var(--color-md-surface)]/70 p-3 shadow-2xs backdrop-blur-md';

/** Chip tonal para etiquetas de sección (p. ej. "Directorio alfabético · 5 docentes"). */
export const TONAL_CHIP_CLASS =
  'inline-flex items-center rounded-full border border-[var(--color-md-outline-variant)]/50 bg-[var(--color-md-surface-container)]/85 px-3 py-1 text-[11px] font-bold text-[var(--color-md-on-surface-variant)] shadow-2xs backdrop-blur-sm';
