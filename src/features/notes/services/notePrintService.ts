import { Capacitor } from '@capacitor/core';
import { WidgetBridge } from '../../../shared/plugins/widgetBridge';
import { sanitizeNoteHtml } from '../../../shared/utils/sanitizeHtml';
import { HIGHLIGHT_PAPER_HEX } from '../utils/colorHex';
import { VOICE_NOTE_ATTR } from '../utils/voiceNoteEmbeds';

/**
 * Imprimir un apunte. Se arma un documento HTML aparte, siempre en claro y en A4 (independiente del
 * tema de la app), y se manda a imprimir:
 * - Web y PC (Electron): en un iframe oculto con `print()`; el diálogo del sistema permite elegir
 *   impresora o «Guardar como PDF».
 * - Android: el WebView no implementa `window.print()`, así que lo imprime el puente nativo con
 *   PrintManager (que también ofrece «Guardar como PDF»).
 */

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch);

const shadeCss = Object.entries(HIGHLIGHT_PAPER_HEX)
  .map(([id, hex]) => `mark[data-color='${id}'], td[data-shade='${id}'], th[data-shade='${id}'] { background: ${hex}; }`)
  .join('\n');

const PRINT_CSS = `
@page { size: A4; margin: 2cm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #1f1f1f; }
body { font-family: 'Google Sans Text', Roboto, 'Segoe UI', Arial, sans-serif; font-size: 11.5pt; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1.note-title { font-size: 22pt; margin: 0 0 4pt; }
.note-meta { color: #5f6368; font-size: 9.5pt; margin-bottom: 14pt; border-bottom: 1px solid #dadce0; padding-bottom: 8pt; }
h1 { font-size: 18pt; margin: 14pt 0 6pt; } h2 { font-size: 15pt; margin: 12pt 0 5pt; } h3 { font-size: 13pt; margin: 10pt 0 4pt; }
h1, h2, h3 { break-after: avoid; }
p { margin: 0 0 8pt; }
ul, ol { padding-left: 18pt; margin: 0 0 8pt; }
blockquote { border-left: 3px solid #1a73e8; margin: 8pt 0; padding: 2pt 10pt; color: #444; font-style: italic; background: #f6f8fc; }
code { font-family: Consolas, 'Roboto Mono', monospace; font-size: 0.9em; background: #f1f3f4; border-radius: 3px; padding: 0 3px; }
pre { background: #f1f3f4; border-radius: 6px; padding: 8pt 10pt; white-space: pre-wrap; break-inside: avoid; }
pre code { background: none; padding: 0; }
a { color: #1a73e8; }
hr { border: 0; border-top: 1px solid #bdbdbd; margin: 12pt 0; }
img { max-width: 100%; height: auto; display: block; margin: 8pt auto; break-inside: avoid; border-radius: 6px; }
img[data-align='left'] { float: left; margin: 2pt 10pt 6pt 0; }
img[data-align='right'] { float: right; margin: 2pt 0 6pt 10pt; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
tr { break-inside: avoid; }
td, th { border: 1px solid #bdbdbd; padding: 4pt 6pt; vertical-align: top; text-align: left; }
th { background: #eeeeee; font-weight: 700; }
td p, th p { margin: 0; }
td p:empty::after, th p:empty::after { content: '\\00a0'; }
mark { background: #FFF176; color: inherit; padding: 0 2px; border-radius: 2px; }
${shadeCss}
ul[data-type='taskList'] { list-style: none; padding-left: 4pt; }
ul[data-type='taskList'] > li { display: flex; gap: 6pt; }
ul[data-type='taskList'] > li > label::before { content: '☐'; }
ul[data-type='taskList'] > li[data-checked='true'] > label::before { content: '☑'; }
ul[data-type='taskList'] > li[data-checked='true'] > div { text-decoration: line-through; color: #777; }
ul[data-type='taskList'] > li > div > p { margin: 0; }
.voice-note-print { font-style: italic; color: #666; }
.note-page-break { break-after: page; page-break-after: always; height: 0; margin: 0; border: 0; }
`;

/** Documento HTML completo, en claro y A4, listo para imprimir (o guardar como PDF). */
export function buildPrintHtml(title: string, html: string, meta: string): string {
  const parsed = new DOMParser().parseFromString(sanitizeNoteHtml(html), 'text/html');
  // Notas de voz: en papel solo queda su nombre
  parsed.querySelectorAll(`[${VOICE_NOTE_ATTR}]`).forEach((element) => {
    const line = parsed.createElement('p');
    line.className = 'voice-note-print';
    line.textContent = `🎤 Nota de voz: ${element.getAttribute('data-name') || 'grabación'}`;
    element.replaceWith(line);
  });
  const safeTitle = escapeHtml(title.trim() || 'Apunte');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${safeTitle}</title><style>${PRINT_CSS}</style></head><body><h1 class="note-title">${safeTitle}</h1><div class="note-meta">${escapeHtml(meta)}</div>${parsed.body.innerHTML}</body></html>`;
}

/** Abre el diálogo de impresión del sistema con el apunte. */
export async function printNote(title: string, html: string, meta: string): Promise<void> {
  const document_ = buildPrintHtml(title, html, meta);
  const jobName = title.trim() || 'Apunte';

  if (Capacitor.isNativePlatform()) {
    await WidgetBridge.printHtml({ html: document_, jobName });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    const cleanup = () => window.setTimeout(() => frame.remove(), 1000);
    frame.onload = () => {
      const view = frame.contentWindow;
      if (!view) {
        frame.remove();
        reject(new Error('No se pudo preparar la impresión.'));
        return;
      }
      view.addEventListener('afterprint', cleanup, { once: true });
      // Las fotos ya vienen incrustadas (data URL): basta un respiro para que se pinten
      window.setTimeout(() => {
        view.focus();
        view.print();
        resolve();
        // Si el navegador no avisa afterprint, el iframe igual se retira
        window.setTimeout(() => frame.remove(), 60_000);
      }, 150);
    };
    frame.srcdoc = document_;
    document.body.appendChild(frame);
  });
}
