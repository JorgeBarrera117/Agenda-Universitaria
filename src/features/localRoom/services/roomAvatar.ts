import { ROOM_AVATAR_MAX_CHARS } from '../types/room';

/**
 * Miniatura de la foto de Mi perfil para la Sala Local: recorte cuadrado centrado de 96×96 px en
 * JPEG, bajando la calidad hasta quedar por debajo de 25 KB. Viaja cifrada una sola vez al entrar.
 */

const SIZE = 96;
const QUALITIES = [0.82, 0.7, 0.55, 0.4];
const cache = new Map<string, Promise<string | undefined>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo leer la foto de perfil.'));
    image.src = src;
  });
}

async function build(src: string): Promise<string | undefined> {
  const image = await loadImage(src);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (!side) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
  for (const quality of QUALITIES) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= ROOM_AVATAR_MAX_CHARS) return dataUrl;
  }
  return undefined;
}

/** undefined si no hay foto o no se pudo reducir (se usan las iniciales con color). */
export function makeAvatarThumb(src: string | undefined): Promise<string | undefined> {
  if (!src) return Promise.resolve(undefined);
  let pending = cache.get(src);
  if (!pending) {
    pending = build(src).catch(() => undefined);
    cache.set(src, pending);
  }
  return pending;
}
