import type { JSONContent } from '@tiptap/core';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
  type ParagraphChild,
} from 'docx';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { sanitizeNoteHtml } from '../../../shared/utils/sanitizeHtml';
import { deliverSharedBlob, shareFileBaseName, type SharedFileResult } from '../../../shared/utils/sharePackage';
import { isHighlightColor } from '../extensions/NoteHighlight';
import { HIGHLIGHT_PAPER_HEX, toHexColor } from '../utils/colorHex';
import { VOICE_NOTE_ATTR } from '../utils/voiceNoteEmbeds';

/**
 * Exportar un apunte a Word (.docx) y Markdown (.md), y prepararlo para imprimir.
 * - Word: se arma un .docx real (librería `docx`) recorriendo el documento de Tiptap (JSON), así
 *   títulos, listas, tablas con sombreado, colores, resaltado, enlaces y fotos llegan con su formato.
 * - Markdown: Turndown + GFM sobre el HTML saneado (tablas, tachado y listas de tareas).
 * - Impresión: un documento HTML aparte, siempre en claro y en A4, independiente del tema de la app.
 * Este módulo se carga a demanda (import dinámico): sus librerías no pesan en el arranque.
 */

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MARKDOWN_MIME = 'text/markdown';

/** Ancho útil de una hoja A4 con márgenes de 2 cm, en píxeles a 96 ppp (≈ 17 cm). */
const PAGE_CONTENT_WIDTH_PX = 642;

// ── Markdown ───────────────────────────────────────────────────────────────────────────────────

/** Un bloque vacío con significado propio: salto de página o nota de voz (o null si no lo es). */
function specialBlockMarkdown(node: HTMLElement): string | null {
  if (node.getAttribute?.('data-page-break')) return '\n\n<div style="page-break-after: always;"></div>\n\n';
  // Notas de voz: el audio no viaja en Markdown; queda una línea que dice que existía
  if (node.hasAttribute?.(VOICE_NOTE_ATTR)) return `\n\n> 🎤 Nota de voz: ${node.getAttribute('data-name') || 'grabación'} (no incluida)\n\n`;
  return null;
}

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    // Turndown descarta los elementos vacíos antes de mirar las reglas, y el salto de página y la
    // nota de voz son divs vacíos: se atienden aquí
    blankReplacement: (_content, node) =>
      specialBlockMarkdown(node as HTMLElement) ?? ((node as HTMLElement & { isBlock?: boolean }).isBlock ? '\n\n' : ''),
  });
  service.use(gfm);
  // Tareas de Tiptap: <li data-checked><label><input></label><div>…</div></li> → «- [x] …»
  service.addRule('noteTaskItem', {
    filter: (node) => node.nodeName === 'LI' && (node.parentNode as HTMLElement | null)?.getAttribute?.('data-type') === 'taskList',
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
      return `- [${checked ? 'x' : ' '}] ${content.trim().replace(/\n+/g, ' ')}\n`;
    },
  });
  return service;
}

/**
 * Prepara las tablas para GFM: sin <colgroup> (Tiptap lo pone antes del cuerpo y el plugin entonces
 * no ve la fila de encabezado) y con la primera fila como encabezado (Markdown lo exige).
 */
function tablesForMarkdown(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('colgroup').forEach((element) => element.remove());
  // Una celda de Markdown es una sola línea: sus párrafos se unen con un espacio
  parsed.querySelectorAll('td p, th p').forEach((paragraph) => {
    const fragment = parsed.createDocumentFragment();
    fragment.append(...Array.from(paragraph.childNodes));
    if (paragraph.nextElementSibling) fragment.append(' ');
    paragraph.replaceWith(fragment);
  });
  parsed.querySelectorAll('table').forEach((table) => {
    const firstRow = table.querySelector('tr');
    firstRow?.querySelectorAll(':scope > td').forEach((cell) => {
      const header = parsed.createElement('th');
      header.innerHTML = cell.innerHTML;
      cell.replaceWith(header);
    });
  });
  return parsed.body.innerHTML;
}

export function noteToMarkdown(title: string, html: string): string {
  const body = createTurndown().turndown(tablesForMarkdown(sanitizeNoteHtml(html)));
  return `# ${title.trim() || 'Apunte'}\n\n${body}\n`;
}

export async function exportNoteMarkdown(title: string, html: string): Promise<SharedFileResult> {
  const fileName = `${shareFileBaseName(title, 'Apunte')}.md`;
  return deliverSharedBlob(new Blob([noteToMarkdown(title, html)], { type: MARKDOWN_MIME }), fileName, MARKDOWN_MIME);
}

// ── Word (.docx) ───────────────────────────────────────────────────────────────────────────────

interface PreparedImage {
  data: Uint8Array;
  type: 'png' | 'jpg' | 'gif' | 'bmp';
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer una foto del apunte.'));
    img.src = src;
  });
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Bytes, tipo y tamaño de cada foto; las que Word no admite (WebP…) se pasan a PNG. */
async function prepareImage(src: string, widthPercent: number | null): Promise<PreparedImage | null> {
  if (!src.startsWith('data:image/')) return null;
  try {
    const img = await loadImage(src);
    const mime = src.slice(5, src.indexOf(';'));
    let type: PreparedImage['type'] | null = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : mime === 'image/gif' ? 'gif' : mime === 'image/bmp' ? 'bmp' : null;
    let data: Uint8Array;
    if (type) {
      data = dataUrlBytes(src);
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      data = dataUrlBytes(canvas.toDataURL('image/png'));
      type = 'png';
    }
    const maxWidth = PAGE_CONTENT_WIDTH_PX * (widthPercent ? widthPercent / 100 : 1);
    const width = Math.min(img.naturalWidth || maxWidth, maxWidth);
    const height = img.naturalWidth ? (width * img.naturalHeight) / img.naturalWidth : width * 0.75;
    return { data, type, width: Math.round(width), height: Math.round(height) };
  } catch {
    return null;
  }
}

function collectImages(node: JSONContent, out: JSONContent[]): void {
  if (node.type === 'image') out.push(node);
  node.content?.forEach((child) => collectImages(child, out));
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const hexNoHash = (value: string) => toHexColor(value).replace('#', '');

interface DocxContext {
  images: Map<JSONContent, PreparedImage | null>;
  /** Contador para reiniciar la numeración de cada lista numerada. */
  listInstance: number;
}

interface BlockStyle {
  indentLeft?: number;
  italics?: boolean;
}

/** La fuente del apunte en Word: con serifa → Georgia; monoespaciada → Consolas. */
function docxFont(fontFamily: string | null): string | null {
  if (!fontFamily) return null;
  if (/monospace/i.test(fontFamily)) return 'Consolas';
  if (/(^|,\s*)serif/i.test(fontFamily) || /georgia/i.test(fontFamily)) return 'Georgia';
  return fontFamily.split(',')[0].replace(/["']/g, '').trim() || null;
}

/** Alineación de un párrafo o título (TextAlign) en Word. */
function docxAlignment(value: unknown) {
  if (value === 'center') return AlignmentType.CENTER;
  if (value === 'right') return AlignmentType.RIGHT;
  if (value === 'justify') return AlignmentType.JUSTIFIED;
  return undefined;
}

function textRuns(nodes: JSONContent[] | undefined, base: Partial<IRunOptions> = {}): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  for (const node of nodes ?? []) {
    if (node.type === 'hardBreak') {
      runs.push(new TextRun({ ...base, text: '', break: 1 }));
      continue;
    }
    if (node.type !== 'text' || !node.text) continue;
    const options: Record<string, unknown> = { ...base, text: node.text };
    let href: string | null = null;
    for (const mark of node.marks ?? []) {
      const attrs = mark.attrs ?? {};
      if (mark.type === 'bold') options.bold = true;
      else if (mark.type === 'italic') options.italics = true;
      else if (mark.type === 'underline') options.underline = {};
      else if (mark.type === 'strike') options.strike = true;
      else if (mark.type === 'code') options.font = 'Consolas';
      else if (mark.type === 'link') href = str(attrs.href);
      else if (mark.type === 'highlight') {
        const color = isHighlightColor(attrs.color) ? attrs.color : 'amarillo';
        options.shading = { type: ShadingType.CLEAR, color: 'auto', fill: hexNoHash(HIGHLIGHT_PAPER_HEX[color]) };
      } else if (mark.type === 'subscript') options.subScript = true;
      else if (mark.type === 'superscript') options.superScript = true;
      else if (mark.type === 'textStyle') {
        const color = str(attrs.color);
        if (color) options.color = hexNoHash(color);
        const font = docxFont(str(attrs.fontFamily));
        if (font) options.font = font;
        const sizePx = Number.parseFloat(str(attrs.fontSize) ?? '');
        // Word mide en medios puntos: 1 px = 0,75 pt
        if (Number.isFinite(sizePx) && sizePx > 0) options.size = Math.round(sizePx * 0.75 * 2);
      }
    }
    if (href && /^(https?:|mailto:|tel:)/i.test(href)) {
      runs.push(new ExternalHyperlink({ link: href, children: [new TextRun({ ...(options as IRunOptions), style: 'Hyperlink' })] }));
    } else {
      runs.push(new TextRun(options as IRunOptions));
    }
  }
  return runs;
}

function blocksToDocx(nodes: JSONContent[] | undefined, ctx: DocxContext, style: BlockStyle = {}, listLevel = 0): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const indent = style.indentLeft ? { left: style.indentLeft } : undefined;
  const runBase: Partial<IRunOptions> = style.italics ? { italics: true } : {};

  for (const node of nodes ?? []) {
    const attrs = node.attrs ?? {};
    switch (node.type) {
      case 'paragraph':
        out.push(new Paragraph({ children: textRuns(node.content, runBase), indent, alignment: docxAlignment(attrs.textAlign), spacing: { after: 120 } }));
        break;
      case 'heading': {
        const level = num(attrs.level) ?? 1;
        const heading = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
        out.push(new Paragraph({ heading, children: textRuns(node.content), indent, alignment: docxAlignment(attrs.textAlign) }));
        break;
      }
      case 'bulletList':
      case 'orderedList': {
        const reference = node.type === 'bulletList' ? 'bullets' : 'numbers';
        const instance = ++ctx.listInstance;
        for (const item of node.content ?? []) {
          for (const [index, child] of (item.content ?? []).entries()) {
            if (child.type === 'paragraph' && index === 0) {
              out.push(new Paragraph({ children: textRuns(child.content, runBase), numbering: { reference, level: Math.min(listLevel, 8), instance } }));
            } else {
              out.push(...blocksToDocx([child], ctx, style, listLevel + 1));
            }
          }
        }
        break;
      }
      case 'taskList':
        for (const item of node.content ?? []) {
          const checked = item.attrs?.checked === true;
          for (const [index, child] of (item.content ?? []).entries()) {
            if (child.type === 'paragraph' && index === 0) {
              out.push(
                new Paragraph({
                  children: [new TextRun({ text: checked ? '☑ ' : '☐ ' }), ...textRuns(child.content, checked ? { ...runBase, strike: true } : runBase)],
                  indent: { left: (style.indentLeft ?? 0) + 360 * (listLevel + 1) },
                })
              );
            } else {
              out.push(...blocksToDocx([child], ctx, style, listLevel + 1));
            }
          }
        }
        break;
      case 'blockquote':
        out.push(...blocksToDocx(node.content, ctx, { indentLeft: (style.indentLeft ?? 0) + 567, italics: true }, listLevel));
        break;
      case 'codeBlock': {
        const code = (node.content ?? []).map((child) => child.text ?? '').join('');
        for (const line of code.split('\n')) {
          out.push(
            new Paragraph({
              children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 20 })],
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F1F3F4' },
              indent,
              spacing: { after: 0 },
            })
          );
        }
        out.push(new Paragraph({ children: [] }));
        break;
      }
      case 'pageBreak':
        out.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case 'horizontalRule':
        out.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BDBDBD', space: 1 } } }));
        break;
      case 'image': {
        const prepared = ctx.images.get(node);
        if (prepared) {
          const align = str(attrs.align);
          out.push(
            new Paragraph({
              alignment: align === 'left' ? AlignmentType.LEFT : align === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER,
              children: [new ImageRun({ type: prepared.type, data: prepared.data, transformation: { width: prepared.width, height: prepared.height } })],
            })
          );
        }
        break;
      }
      case 'voiceNote':
        out.push(new Paragraph({ children: [new TextRun({ text: `🎤 Nota de voz: ${str(attrs.name) ?? 'grabación'} (no incluida)`, italics: true, color: '666666' })] }));
        break;
      case 'table': {
        const rows = (node.content ?? []).map(
          (row) =>
            new TableRow({
              children: (row.content ?? []).map((cell) => {
                const cellAttrs = cell.attrs ?? {};
                const isHeader = cell.type === 'tableHeader';
                const shade = isHighlightColor(cellAttrs.shade) ? hexNoHash(HIGHLIGHT_PAPER_HEX[cellAttrs.shade]) : isHeader ? 'EEEEEE' : null;
                const children = blocksToDocx(cell.content, ctx).filter((child): child is Paragraph => child instanceof Paragraph);
                return new TableCell({
                  children: children.length > 0 ? children : [new Paragraph({ children: [] })],
                  columnSpan: num(cellAttrs.colspan) ?? undefined,
                  rowSpan: num(cellAttrs.rowspan) ?? undefined,
                  shading: shade ? { type: ShadingType.CLEAR, color: 'auto', fill: shade } : undefined,
                });
              }),
            })
        );
        if (rows.length > 0) {
          out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
          out.push(new Paragraph({ children: [] }));
        }
        break;
      }
      default:
        // Nodo desconocido: se intenta conservar su texto
        if (node.content) out.push(...blocksToDocx(node.content, ctx, style, listLevel));
    }
  }
  return out;
}

const listLevels = (format: (typeof LevelFormat)[keyof typeof LevelFormat], text: (level: number) => string) =>
  Array.from({ length: 9 }, (_, level) => ({
    level,
    format,
    text: text(level),
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));

export async function noteToDocxBlob(title: string, doc: JSONContent): Promise<Blob> {
  const imageNodes: JSONContent[] = [];
  collectImages(doc, imageNodes);
  const images = new Map<JSONContent, PreparedImage | null>();
  for (const node of imageNodes) {
    images.set(node, await prepareImage(str(node.attrs?.src) ?? '', num(node.attrs?.width)));
  }

  const document = new Document({
    creator: 'Agenda Universitaria',
    title: title.trim() || 'Apunte',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: [
        { reference: 'bullets', levels: listLevels(LevelFormat.BULLET, (level) => ['•', '◦', '▪'][level % 3]) },
        { reference: 'numbers', levels: listLevels(LevelFormat.DECIMAL, (level) => `%${level + 1}.`) },
      ],
    },
    sections: [
      {
        // A4 con márgenes de 2 cm (medidas en twips: 1 cm ≈ 567)
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title.trim() || 'Apunte' })] }), ...blocksToDocx(doc.content, { images, listInstance: 0 })],
      },
    ],
  });
  return Packer.toBlob(document);
}

export async function exportNoteDocx(title: string, doc: JSONContent): Promise<SharedFileResult> {
  const fileName = `${shareFileBaseName(title, 'Apunte')}.docx`;
  return deliverSharedBlob(await noteToDocxBlob(title, doc), fileName, DOCX_MIME);
}
