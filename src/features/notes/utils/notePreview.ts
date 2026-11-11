export interface NotePreviewData {
  /** Primera foto insertada en el apunte (solo data:image/… o blob:), o null. */
  coverImageUrl: string | null;
  /** Extracto en texto plano (máx. PREVIEW_MAX_CHARS) o un texto de respaldo. */
  cleanText: string;
  /** false cuando cleanText es un texto de respaldo y no contenido real del apunte. */
  hasText: boolean;
}

const PREVIEW_MAX_CHARS = 180;
const EMPTY_NOTE_TEXT = 'Documento sin contenido escrito aún.';
const PHOTO_ONLY_TEXT = 'Foto de apunte adjunta';

/** Solo se aceptan fotos locales: el CSP ya bloquea URLs remotas y así no se intenta cargarlas. */
const SAFE_IMAGE_SRC = /^(data:image\/|blob:)/i;

const BASIC_ENTITIES: Record<string, string> = { nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };

/**
 * Decodifica entidades HTML (&middot;, &aacute;, &#8212;…) en una sola pasada, así "&amp;lt;"
 * queda como "&lt;" literal. En el navegador usa un <textarea>: su contenido es texto puro
 * (RCDATA), no crea elementos ni ejecuta nada. Fuera del navegador cubre las entidades básicas.
 */
function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return BASIC_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * Convierte el contenido de un apunte (HTML de TipTap con Markdown/KaTeX heredado) a texto plano.
 * Purga la cadena COMPLETA: truncar antes partía las etiquetas <img src="data:…"> de cientos de KB
 * y el HTML sin cerrar acababa visible en las tarjetas.
 */
export function notePlainText(rawContent: string): string {
  if (!rawContent) return '';
  const stripped = rawContent
    .replace(/<img[^>]*>/gi, ' ')
    // Etiquetas en línea sin espacio ("<em>partes</em>:" → "partes:"); las de bloque separan palabras
    .replace(/<\/?(?:strong|b|em|i|u|s|mark|span|a|code|sub|sup)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' [Código] ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' [Fórmula] ')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[*+-]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
  // Las entidades se decodifican al final, cuando ya no queda HTML que reinterpretar
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}

/** Portada y extracto para la tarjeta de un apunte. */
export function parseNotePreview(rawContent: string): NotePreviewData {
  if (!rawContent) {
    return { coverImageUrl: null, cleanText: EMPTY_NOTE_TEXT, hasText: false };
  }

  // La URL de la primera foto se extrae antes de purgar las etiquetas
  const src = /<img[^>]+src=["']([^"']+)["']/i.exec(rawContent)?.[1] ?? null;
  const coverImageUrl = src && SAFE_IMAGE_SRC.test(src) ? src : null;

  // Se trunca una vez que ya es texto plano
  const text = notePlainText(rawContent);
  if (!text) {
    return { coverImageUrl, cleanText: coverImageUrl ? PHOTO_ONLY_TEXT : EMPTY_NOTE_TEXT, hasText: false };
  }
  return {
    coverImageUrl,
    cleanText: text.length > PREVIEW_MAX_CHARS ? `${text.slice(0, PREVIEW_MAX_CHARS).trimEnd()}…` : text,
    hasText: true,
  };
}
