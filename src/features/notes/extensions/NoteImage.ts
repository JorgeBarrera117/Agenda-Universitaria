import Image from '@tiptap/extension-image';
import { NodeSelection } from '@tiptap/pm/state';

/**
 * Posición de una foto respecto al texto:
 * - 'center': sola en su línea, centrada (como hasta ahora).
 * - 'left' / 'right': a un lado, con el texto que sigue rodeándola (como «Ajustar texto» de Word).
 */
export type ImageAlign = 'center' | 'left' | 'right';

export const IMAGE_ALIGNS: readonly ImageAlign[] = ['left', 'center', 'right'];
export const MIN_IMAGE_WIDTH = 20;
export const MAX_IMAGE_WIDTH = 100;
/** Ancho con el que una foto pasa a un lado si aún no tenía uno: deja sitio al texto. */
export const SIDE_IMAGE_DEFAULT_WIDTH = 45;

function isImageAlign(value: unknown): value is ImageAlign {
  return typeof value === 'string' && (IMAGE_ALIGNS as readonly string[]).includes(value);
}

export function clampImageWidth(value: number): number {
  return Math.round(Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, value)));
}

function parseWidth(element: HTMLElement): number | null {
  const raw = Number.parseFloat(element.getAttribute('data-width') ?? '');
  return Number.isFinite(raw) ? clampImageWidth(raw) : null;
}

export interface NoteImageAttrs {
  src: string;
  alt?: string | null;
  /** Ancho en % del ancho del apunte; null = tamaño natural (hasta el 100 %). */
  width: number | null;
  align: ImageAlign;
}

/**
 * Foto del apunte con tamaño y posición. Se guardan en el HTML como `data-width`/`data-align`
 * (más `style="width:…%"` para que el lector, que muestra el HTML saneado, la vea igual).
 *
 * En el editor usa una vista propia (NodeView) con un tirador en la esquina para redimensionarla
 * arrastrando, con el dedo o el mouse. ProseMirror no ve esos eventos (stopEvent) y el ancho solo
 * se guarda al soltar: una sola transacción, que Deshacer revierte de una vez.
 */
export const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => parseWidth(element),
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.width === 'number'
            ? { 'data-width': String(attributes.width), style: `width: ${attributes.width}%` }
            : {},
      },
      align: {
        default: 'center',
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-align');
          return isImageAlign(value) ? value : 'center';
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.align && attributes.align !== 'center' ? { 'data-align': String(attributes.align) } : {},
      },
    };
  },

  addNodeView() {
    return ({ node: initialNode, getPos, editor }) => {
      let node = initialNode;
      const dom = document.createElement('div');
      dom.className = 'note-image';
      const img = document.createElement('img');
      img.draggable = false;
      const handle = document.createElement('span');
      handle.className = 'note-image-handle';
      handle.setAttribute('aria-hidden', 'true');
      dom.append(img, handle);

      const render = () => {
        const attrs = node.attrs as NoteImageAttrs;
        if (img.getAttribute('src') !== attrs.src) img.src = attrs.src;
        img.alt = attrs.alt ?? '';
        dom.dataset.align = attrs.align;
        dom.style.width = attrs.width ? `${attrs.width}%` : '';
        dom.classList.toggle('has-width', Boolean(attrs.width));
      };
      render();

      // Redimensionar arrastrando el tirador (Pointer Events: dedo, lápiz y mouse)
      let drag: { pointerId: number; startX: number; startPx: number; containerPx: number; width: number } | null = null;

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);
        const container = editor.view.dom.getBoundingClientRect().width || 1;
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startPx: dom.getBoundingClientRect().width,
          containerPx: container,
          width: (node.attrs as NoteImageAttrs).width ?? 100,
        };
        dom.classList.add('is-resizing');
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const align = (node.attrs as NoteImageAttrs).align;
        // El tirador está en la esquina exterior: a la derecha crece hacia la derecha, en las
        // fotos alineadas a la derecha crece hacia la izquierda, y centradas crecen por los dos lados
        const factor = align === 'right' ? -1 : align === 'center' ? 2 : 1;
        const px = drag.startPx + (event.clientX - drag.startX) * factor;
        drag.width = clampImageWidth((px / drag.containerPx) * 100);
        dom.style.width = `${drag.width}%`;
        dom.classList.add('has-width');
      };

      const onPointerUp = (event: PointerEvent) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const { width } = drag;
        drag = null;
        dom.classList.remove('is-resizing');
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return;
        const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, width });
        tr.setSelection(NodeSelection.create(tr.doc, pos));
        editor.view.dispatch(tr);
      };

      handle.addEventListener('pointerdown', onPointerDown);
      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', onPointerUp);
      handle.addEventListener('pointercancel', onPointerUp);

      return {
        dom,
        update: (updated) => {
          if (updated.type !== node.type) return false;
          node = updated;
          render();
          return true;
        },
        selectNode: () => dom.classList.add('ProseMirror-selectednode'),
        deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
        // Los eventos del tirador son del redimensionado, no del editor
        stopEvent: (event) => event.target instanceof globalThis.Node && handle.contains(event.target),
        ignoreMutation: () => true,
        destroy: () => {
          handle.removeEventListener('pointerdown', onPointerDown);
          handle.removeEventListener('pointermove', onPointerMove);
          handle.removeEventListener('pointerup', onPointerUp);
          handle.removeEventListener('pointercancel', onPointerUp);
        },
      };
    };
  },
});
