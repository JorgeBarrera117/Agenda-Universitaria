import { TableCell, TableHeader } from '@tiptap/extension-table';
import { isHighlightColor, type HighlightColor } from './NoteHighlight';

/**
 * Celdas de tabla con sombreado. Como el resaltador, se guarda el NOMBRE del tono
 * (data-shade="amarillo") y el CSS lo pinta: pastel en modo claro y translúcido en modo oscuro, así
 * el texto de la celda se lee bien en ambos. Los tonos son los del resaltador (HIGHLIGHT_COLORS).
 */
const shadeAttribute = {
  shade: {
    default: null as HighlightColor | null,
    parseHTML: (element: HTMLElement): HighlightColor | null => {
      const value = element.getAttribute('data-shade');
      return isHighlightColor(value) ? value : null;
    },
    renderHTML: (attributes: Record<string, unknown>): Record<string, string> =>
      isHighlightColor(attributes.shade) ? { 'data-shade': attributes.shade } : {},
  },
};

export const NoteTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...shadeAttribute };
  },
});

export const NoteTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...shadeAttribute };
  },
});
