import { isValidElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { renderSubjectGlyph } from '../components/SubjectIcon';

const cache = new Map<string, Promise<string | null>>();

/** Trazos del ícono (contenido del <svg> de lucide) renderizados fuera de pantalla. */
function glyphMarkup(iconId: string | undefined): string {
  const glyph = renderSubjectGlyph(iconId, '');
  if (!isValidElement(glyph)) return '';
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(glyph));
  const markup = host.querySelector('svg')?.innerHTML ?? '';
  root.unmount();
  return markup;
}

async function render(iconId: string | undefined, color: string, size: number): Promise<string | null> {
  const inner = glyphMarkup(iconId);
  if (!inner) return null;
  const fill = /^#[0-9a-f]{6}$/i.test(color) ? color : '#00639B';
  // Cuadrado redondeado del color de la materia con el ícono en blanco (como SubjectBadge)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="6" fill="${fill}"/>` +
    `<g transform="translate(5 5) scale(0.5833)" fill="none" stroke="#ffffff" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

/**
 * Ícono de una materia como PNG (data URL): su dibujo en blanco sobre su color. Lo usan los avisos
 * de Windows, que no pueden mostrar componentes de React. Se guarda en memoria por ícono y color.
 * Devuelve null si no se pudo dibujar (el aviso usa entonces el ícono de la app).
 */
export function subjectBadgePng(iconId: string | undefined, color: string, size = 128): Promise<string | null> {
  const key = `${iconId ?? 'book'}|${color}|${size}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = render(iconId, color, size).catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}
