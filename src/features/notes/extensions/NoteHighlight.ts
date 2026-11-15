import { Mark, mergeAttributes } from '@tiptap/react';

/**
 * Colores del resaltador. Se guarda el NOMBRE (data-color="amarillo"), no un color fijo: el CSS
 * (index.css) pinta cada nombre con un tono pastel en modo claro y uno translúcido en modo oscuro,
 * así el texto se lee bien en los dos y los apuntes compartidos se ven igual en cualquier tema.
 */
export const HIGHLIGHT_COLORS = [
  { id: 'amarillo', label: 'Amarillo' },
  { id: 'verde', label: 'Verde' },
  { id: 'celeste', label: 'Celeste' },
  { id: 'rosa', label: 'Rosa' },
  { id: 'naranja', label: 'Naranja' },
  { id: 'morado', label: 'Morado' },
  { id: 'rojo', label: 'Rojo' },
] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]['id'];

export const DEFAULT_HIGHLIGHT: HighlightColor = 'amarillo';

export function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === 'string' && HIGHLIGHT_COLORS.some((color) => color.id === value);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteHighlight: {
      /** Resalta la selección (o lo que se escriba a continuación) con el color indicado. */
      setHighlight: (color: HighlightColor) => ReturnType;
      /** Quita el resaltado de la selección. */
      unsetHighlight: () => ReturnType;
    };
  }
}

/**
 * Marca de resaltador para los apuntes: <mark data-color="…">. Un apunte importado con un color
 * desconocido (o el <mark> de otra app) queda en amarillo.
 */
export const NoteHighlight = Mark.create({
  name: 'highlight',

  // Se puede cambiar de color encima de otro resaltado sin anidar marcas
  excludes: 'highlight',

  addAttributes() {
    return {
      color: {
        default: DEFAULT_HIGHLIGHT,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-color');
          return isHighlightColor(value) ? value : DEFAULT_HIGHLIGHT;
        },
        renderHTML: (attributes: { color?: unknown }) => ({
          'data-color': isHighlightColor(attributes.color) ? attributes.color : DEFAULT_HIGHLIGHT,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'mark' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setHighlight:
        (color: HighlightColor) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      // Ctrl/Cmd + Mayús + H: resaltar o quitar el resaltado (amarillo)
      'Mod-Shift-h': () => this.editor.commands.toggleMark(this.name, { color: DEFAULT_HIGHLIGHT }),
    };
  },
});
