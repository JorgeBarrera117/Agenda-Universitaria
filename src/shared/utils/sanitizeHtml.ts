import DOMPurify from 'dompurify';

// Un apunte puede llegar de un respaldo ajeno, así que su HTML se trata como no confiable:
// se eliminan scripts, manejadores on* y URLs javascript:, conservando el formato de TipTap
// y las imágenes incrustadas como data URL.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
  });
}
