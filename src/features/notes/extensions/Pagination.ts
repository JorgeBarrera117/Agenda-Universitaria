import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

/**
 * Paginación real de la «vista de hoja», como el diseño de impresión de Word.
 *
 * El documento sigue siendo uno solo (un contenteditable), pero se dibuja en hojas A4 separadas:
 * - La hoja (.note-sheet) mide 21 cm, tiene márgenes de 2 cm y pinta sus páginas de 29,7 cm con un
 *   hueco entre ellas (CSS). Este plugin mide el contenido y, donde una línea ya no cabe en la
 *   página, inserta un ESPACIADOR (decoración de ProseMirror, no forma parte del apunte guardado)
 *   que la empuja al inicio de la página siguiente.
 * - Párrafos largos: se parten por líneas (espaciador dentro del párrafo). Fotos, tablas y demás
 *   bloques que no se pueden partir pasan enteros a la página siguiente.
 * - Salto de página manual (PageBreak): lo que sigue empieza en la página siguiente.
 *
 * Se mide la posición «natural» de cada línea (descontando los espaciadores actuales) y se simula
 * la paginación; si el resultado no cambia, no se toca nada. Fuera de la vista de hoja no hace nada.
 */

const CM = 96 / 2.54;
export const SHEET_PAGE = {
  widthPx: 21 * CM,
  heightPx: 29.7 * CM,
  marginPx: 2 * CM,
  gapPx: 24,
};
const STRIDE = SHEET_PAGE.heightPx + SHEET_PAGE.gapPx;
const PAGE_CONTENT = SHEET_PAGE.heightPx - 2 * SHEET_PAGE.marginPx;
const contentTop = (page: number) => page * STRIDE + SHEET_PAGE.marginPx;
const contentBottom = (page: number) => page * STRIDE + SHEET_PAGE.heightPx - SHEET_PAGE.marginPx;
const pageOf = (y: number) => Math.max(0, Math.floor(y / STRIDE));

interface SpacerSpec {
  pos: number;
  height: number;
  /** Dentro de un párrafo (parte sus líneas) o antes de un bloque. */
  inline: boolean;
}

interface Unit {
  pos: number;
  kind: 'text' | 'block' | 'break';
  dom: HTMLElement;
  /** Los títulos van con el párrafo que les sigue (no quedan solos al pie de la página). */
  isHeading?: boolean;
}

const paginationKey = new PluginKey<DecorationSet>('notePagination');

function spacerDecoration(spec: SpacerSpec): Decoration {
  return Decoration.widget(
    spec.pos,
    () => {
      const element = document.createElement(spec.inline ? 'span' : 'div');
      element.className = 'note-page-spacer';
      element.style.height = `${spec.height}px`;
      element.setAttribute('contenteditable', 'false');
      element.setAttribute('aria-hidden', 'true');
      return element;
    },
    { side: -1, ignoreSelection: true, key: `page-spacer-${spec.pos}-${Math.round(spec.height)}-${spec.inline ? 'i' : 'b'}` }
  );
}

/** Bloques que se paginan: párrafos y títulos (por líneas), y fotos, tablas o líneas enteras. */
function collectUnits(view: EditorView): Unit[] {
  const units: Unit[] = [];
  view.state.doc.descendants((node, pos) => {
    const dom = view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return node.type.name !== 'table';
    if (node.type.name === 'pageBreak') {
      units.push({ pos, kind: 'break', dom });
      return false;
    }
    if (node.type.name === 'table') {
      units.push({ pos, kind: 'block', dom });
      return false;
    }
    if (node.isTextblock) {
      units.push({ pos, kind: 'text', dom, isHeading: node.type.name === 'heading' });
      return false;
    }
    if (node.isAtom && node.isBlock) {
      units.push({ pos, kind: 'block', dom });
      return false;
    }
    return true;
  });
  return units;
}

interface Line {
  top: number;
  bottom: number;
  pos: number;
}

/** Líneas de un párrafo: dónde empieza cada una (posición del documento) y su altura. */
function measureLines(view: EditorView, element: HTMLElement, toY: (clientY: number) => number): Line[] {
  const lines: Line[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let lastTop = Number.NEGATIVE_INFINITY;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.parentElement?.closest('.note-page-spacer')) continue;
    for (let i = 0; i < text.data.length; i++) {
      range.setStart(text, i);
      range.setEnd(text, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect || rect.height === 0) continue;
      const top = toY(rect.top);
      const bottom = toY(rect.bottom);
      if (top > lastTop + 2) {
        lines.push({ top, bottom, pos: view.posAtDOM(text, i) });
        lastTop = top;
      } else {
        const line = lines[lines.length - 1];
        line.bottom = Math.max(line.bottom, bottom);
      }
    }
  }
  return lines;
}

interface PaginationResult {
  sheet: HTMLElement;
  specs: SpacerSpec[];
  pages: number;
}

function paginate(view: EditorView): PaginationResult | null {
  const sheet = view.dom.closest<HTMLElement>('.note-sheet');
  if (!sheet) return null;
  const sheetRect = sheet.getBoundingClientRect();
  if (sheetRect.width === 0) return null;
  // La hoja puede verse a escala (zoom) en pantallas angostas: se mide en píxeles de la hoja real
  const zoom = sheetRect.width / SHEET_PAGE.widthPx;
  const toY = (clientY: number) => (clientY - sheetRect.top) / zoom;

  // Espaciadores actuales: se descuentan para obtener la posición natural del contenido
  const spacers = Array.from(view.dom.querySelectorAll<HTMLElement>('.note-page-spacer'))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { top: toY(rect.top), height: rect.height / zoom };
    })
    .sort((a, b) => a.top - b.top);
  const natural = (y: number) => {
    let shift = 0;
    for (const spacer of spacers) {
      if (spacer.top < y - 0.5) shift += spacer.height;
      else break;
    }
    return y - shift;
  };

  const specs: SpacerSpec[] = [];
  let offset = 0;
  let breakPage: number | null = null;
  let lastBottom = SHEET_PAGE.marginPx;
  // Título anterior que cupo en su página (por si su párrafo pasa a la siguiente)
  let pendingHeading: { pos: number; top: number; page: number } | null = null;

  /**
   * Mueve a la página siguiente lo que empieza en `top` (antes de `pos`). Si justo antes hay un título
   * en la misma página, se mueve el título y el bloque lo acompaña, como «conservar con el siguiente».
   */
  const moveToNextPage = (pos: number, top: number, page: number) => {
    const heading = pendingHeading && pendingHeading.page === page && pendingHeading.top > contentTop(page) + 0.5 ? pendingHeading : null;
    const from = heading ?? { pos, top };
    const shift = contentTop(page + 1) - from.top;
    if (shift <= 0.5) return 0;
    specs.push({ pos: from.pos, height: shift, inline: false });
    offset += shift;
    return shift;
  };

  for (const unit of collectUnits(view)) {
    const rect = unit.dom.getBoundingClientRect();
    const top = natural(toY(rect.top)) + offset;
    const bottom = natural(toY(rect.bottom)) + offset;

    if (unit.kind === 'break') {
      breakPage = pageOf(top);
      pendingHeading = null;
      continue;
    }
    if (rect.height === 0) continue;

    // Después de un salto de página manual: empieza en la página siguiente
    if (breakPage !== null) {
      const shift = contentTop(breakPage + 1) - top;
      breakPage = null;
      if (shift > 0.5) {
        specs.push({ pos: unit.pos, height: shift, inline: false });
        offset += shift;
        lastBottom = bottom + shift;
        continue;
      }
    }

    const page = pageOf(top);
    if (bottom <= contentBottom(page) + 0.5 && top >= contentTop(page) - 0.5) {
      lastBottom = bottom;
      pendingHeading = unit.isHeading ? { pos: unit.pos, top, page } : null;
      continue;
    }

    if (unit.kind === 'text') {
      // Párrafo que cruza el final de la página: se parte en la primera línea que no cabe
      const lines = measureLines(view, unit.dom, toY);
      lines.forEach((line, index) => {
        const lineTop = natural(line.top) + offset;
        const lineBottom = natural(line.bottom) + offset;
        const linePage = pageOf(lineTop);
        const target = lineBottom > contentBottom(linePage) + 0.5 ? contentTop(linePage + 1) : lineTop < contentTop(linePage) - 0.5 ? contentTop(linePage) : null;
        if (target === null) return;
        const shift = target - lineTop;
        if (shift <= 0.5) return;
        if (index === 0 && target > lineTop + 0.5 && lineBottom > contentBottom(linePage) + 0.5) {
          moveToNextPage(unit.pos, lineTop, linePage);
          return;
        }
        specs.push(index === 0 ? { pos: unit.pos, height: shift, inline: false } : { pos: line.pos, height: shift, inline: true });
        offset += shift;
      });
      lastBottom = natural(toY(rect.bottom)) + offset;
      pendingHeading = null;
      continue;
    }

    // Foto, tabla o línea: si cabe en una página, pasa entera a la siguiente
    const height = bottom - top;
    if (height <= PAGE_CONTENT) {
      let shift = 0;
      if (top < contentTop(page) - 0.5) {
        shift = contentTop(page) - top;
        specs.push({ pos: unit.pos, height: shift, inline: false });
        offset += shift;
      } else {
        shift = moveToNextPage(unit.pos, top, page);
      }
      lastBottom = bottom + Math.max(0, shift);
    } else {
      lastBottom = bottom;
    }
    pendingHeading = null;
  }

  return { sheet, specs, pages: pageOf(lastBottom) + 1 };
}

export const Pagination = Extension.create({
  name: 'notePagination',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: paginationKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const next = tr.getMeta(paginationKey) as DecorationSet | undefined;
            return next ?? set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return paginationKey.getState(state);
          },
        },
        view(view) {
          let timer = 0;
          let frame = 0;
          let lastSignature = '';
          let lastSheet: HTMLElement | null = null;
          // Tras aplicar espaciadores se vuelve a medir para confirmar; con tope por si oscila
          let selfPasses = 0;

          const run = () => {
            const result = paginate(view);
            if (result) {
              result.sheet.style.minHeight = `${result.pages * STRIDE - SHEET_PAGE.gapPx}px`;
              lastSheet = result.sheet;
            } else if (lastSheet) {
              lastSheet.style.minHeight = '';
              lastSheet = null;
            }
            const signature = result ? result.specs.map((spec) => `${spec.pos}:${Math.round(spec.height)}:${spec.inline ? 'i' : 'b'}`).join('|') : '';
            if (signature === lastSignature) {
              selfPasses = 0;
              return;
            }
            lastSignature = signature;
            const set = result ? DecorationSet.create(view.state.doc, result.specs.map(spacerDecoration)) : DecorationSet.empty;
            view.dispatch(view.state.tr.setMeta(paginationKey, set).setMeta('addToHistory', false));
            if (selfPasses < 4) {
              selfPasses += 1;
              schedule(40);
            }
          };

          const schedule = (delay = 150) => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
              window.cancelAnimationFrame(frame);
              frame = window.requestAnimationFrame(run);
            }, delay);
          };

          // Cambios de ancho (activar la vista de hoja, girar el teléfono) y fotos que terminan de cargar
          const resizeObserver = new ResizeObserver(() => schedule(60));
          resizeObserver.observe(view.dom);
          const onLoad = (event: Event) => {
            if (event.target instanceof HTMLImageElement) schedule(30);
          };
          view.dom.addEventListener('load', onLoad, true);
          void document.fonts?.ready.then(() => schedule(0));
          schedule(0);

          return {
            update(updatedView, previousState) {
              if (updatedView.state.doc !== previousState.doc) {
                selfPasses = 0;
                schedule();
              }
            },
            destroy() {
              window.clearTimeout(timer);
              window.cancelAnimationFrame(frame);
              resizeObserver.disconnect();
              view.dom.removeEventListener('load', onLoad, true);
              if (lastSheet) lastSheet.style.minHeight = '';
            },
          };
        },
      }),
    ];
  },
});
