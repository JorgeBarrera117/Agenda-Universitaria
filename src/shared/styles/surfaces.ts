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

/**
 * Botón que cubre toda la tarjeta (patrón "stretched link"): va en el título y su ::after se
 * extiende sobre la tarjeta (que es relative), así tocar cualquier parte abre la ficha sin
 * anidar botones dentro de otro botón. Los controles propios de la tarjeta (⋮, acciones) llevan
 * ABOVE_STRETCHED_CLASS para quedar por encima y seguir funcionando.
 */
export const STRETCHED_CARD_BUTTON_CLASS =
  "text-left after:absolute after:inset-0 after:rounded-[24px] sm:after:rounded-[28px] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[var(--color-md-primary)]";

/** Controles dentro de una tarjeta con STRETCHED_CARD_BUTTON_CLASS: por encima del botón estirado. */
export const ABOVE_STRETCHED_CLASS = 'relative z-10';
