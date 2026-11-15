import { NodeSelection, Selection, type Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

/** Posición de una instancia concreta de nodo en el documento (ProseMirror conserva la instancia al moverla). */
export function findNodePos(doc: PMNode, target: PMNode): number {
  let found = -1;
  doc.descendants((child, pos) => {
    if (found >= 0) return false;
    if (child === target) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Pone un nodo de bloque (foto o nota de voz) en `target` dentro de la transacción y devuelve su
 * posición final, o -1 si no se pudo. Sin `target` usa la selección actual. Un texto seleccionado
 * se reemplaza, como al pegar.
 * - En un párrafo vacío: lo sustituye (no deja un hueco encima).
 * - Al principio o al final de un párrafo: va antes o después de él.
 * - En medio del texto: el párrafo se divide en dos; con `splitText: false` va antes o después del
 *   párrafo, según la mitad tocada (al mover no se corta una frase por la mitad).
 */
export function placeBlockNode(tr: Transaction, node: PMNode, target?: number, { splitText = true }: { splitText?: boolean } = {}): number {
  // Con una foto o nota de voz seleccionada, lo nuevo va debajo de ella (no la reemplaza)
  const pos =
    target ?? (tr.selection.empty ? tr.selection.from : tr.selection instanceof NodeSelection ? tr.selection.to : undefined);
  const $target = pos === undefined ? null : tr.doc.resolve(pos);
  if (!$target || !$target.parent.isTextblock) {
    if (pos === undefined) tr.replaceSelectionWith(node, false);
    else tr.insert(pos, node);
  } else if ($target.parent.content.size === 0) {
    tr.replaceWith($target.before(), $target.after(), node);
  } else if ($target.parentOffset === 0) {
    tr.insert($target.before(), node);
  } else if ($target.parentOffset === $target.parent.content.size) {
    tr.insert($target.after(), node);
  } else if (!splitText) {
    tr.insert($target.parentOffset < $target.parent.content.size / 2 ? $target.before() : $target.after(), node);
  } else {
    tr.insert(pos as number, node);
  }
  return findNodePos(tr.doc, node);
}

/**
 * Inserta un bloque en la selección (o en `pos`, al soltar un arrastre) y deja el cursor en el
 * párrafo de debajo, creándolo si hace falta: si el bloque quedara seleccionado, lo siguiente que
 * se escribiera lo reemplazaría.
 */
export function insertBlockNodeInView(view: EditorView, node: PMNode, pos?: number): void {
  const tr = view.state.tr;
  const start = placeBlockNode(tr, node, pos);
  if (start >= 0) {
    const after = start + node.nodeSize;
    if (!tr.doc.resolve(after).nodeAfter) tr.insert(after, view.state.schema.nodes.paragraph.create());
    tr.setSelection(Selection.near(tr.doc.resolve(after), 1));
  }
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

/**
 * Mueve un bloque (identificado por su instancia) a la posición `target` del documento actual y lo
 * deja seleccionado. «missing»: el bloque ya no está en el apunte; «inside»: el destino es el propio bloque.
 */
export function moveBlockNodeInView(view: EditorView, node: PMNode, target: number): 'moved' | 'missing' | 'inside' {
  const { state } = view;
  const from = findNodePos(state.doc, node);
  if (from < 0) return 'missing';
  const to = from + node.nodeSize;
  if (target >= from && target <= to) return 'inside';

  const tr = state.tr.delete(from, to);
  const start = placeBlockNode(tr, node, tr.mapping.map(target), { splitText: false });
  if (start < 0) return 'missing';
  tr.setSelection(NodeSelection.create(tr.doc, start));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return 'moved';
}
