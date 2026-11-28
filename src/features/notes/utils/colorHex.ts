import type { HighlightColor } from '../extensions/NoteHighlight';

/** Color en #RRGGBB (al reabrir un apunte, el navegador entrega los colores como rgb(…)). */
export function toHexColor(value: string): string {
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return value.toUpperCase();
  return `#${rgb
    .slice(1, 4)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

/**
 * Tonos del resaltador y del sombreado de tablas en papel (los pastel del modo claro de index.css).
 * Los usan la impresión y la exportación a Word, donde no hay tema oscuro.
 */
export const HIGHLIGHT_PAPER_HEX: Record<HighlightColor, string> = {
  amarillo: '#FFF176',
  verde: '#B9F6CA',
  celeste: '#B3E5FC',
  rosa: '#F8BBD0',
  naranja: '#FFCC80',
  morado: '#D1C4E9',
  rojo: '#FFCDD2',
};
