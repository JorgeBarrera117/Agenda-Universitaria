import type { Editor } from '@tiptap/react';
import { CellSelection, isInTable, selectedRect } from '@tiptap/pm/tables';
import type { HighlightColor } from '../extensions/NoteHighlight';

/** A qué se aplica el sombreado: la celda (o las celdas seleccionadas), su fila entera o su columna. */
export type ShadeTarget = 'cell' | 'row' | 'column';

/**
 * Sombrea (o quita el sombreado con `null`) en la tabla donde está el cursor. Usa el rectángulo de
 * la selección de prosemirror-tables: con varias celdas seleccionadas, «fila» abarca todas sus filas
 * y «columna» todas sus columnas. Cambiar atributos no mueve posiciones, así que basta un recorrido.
 */
export function shadeTableCells(editor: Editor, target: ShadeTarget, shade: HighlightColor | null): boolean {
  const { state, view } = editor;
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  const area =
    target === 'row'
      ? { left: 0, right: rect.map.width, top: rect.top, bottom: rect.bottom }
      : target === 'column'
        ? { left: rect.left, right: rect.right, top: 0, bottom: rect.map.height }
        : { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  const tr = state.tr;
  for (const relative of rect.map.cellsInRect(area)) {
    const pos = rect.tableStart + relative;
    const node = tr.doc.nodeAt(pos);
    if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, shade });
  }
  view.dispatch(tr);
  view.focus();
  return true;
}

/** ¿Hay varias celdas seleccionadas (arrastrando sobre la tabla)? */
export function hasMultiCellSelection(editor: Editor): boolean {
  const { selection } = editor.state;
  return selection instanceof CellSelection && selection.$anchorCell.pos !== selection.$headCell.pos;
}
