import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Inserta un salto de página en el cursor (y deja un párrafo debajo para seguir escribiendo). */
      setPageBreak: () => ReturnType;
    };
  }
}

/**
 * Salto de página manual, como en Word: <div data-page-break>. En el editor y el lector se ve como
 * una línea con «Salto de página»; en la vista de hoja separa la hoja en dos; al imprimir corta la
 * página (break-after: page) y en Word es un salto de página real. Ctrl+Enter lo inserta.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true', class: 'note-page-break' })];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent([{ type: this.name }, { type: 'paragraph' }]).run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    };
  },
});
