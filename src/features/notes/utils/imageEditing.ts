/**
 * Operaciones del editor de fotos del apunte sobre <canvas>. Cada operación devuelve un lienzo
 * nuevo (no modifica el de entrada): así el anterior sirve como paso de «Deshacer».
 */

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible.');
  return { canvas, ctx };
}

/** Lienzo con la foto (data URL o blob: URL) a su tamaño real. */
export async function loadImageToCanvas(src: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const { canvas, ctx } = createCanvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(source.width, source.height);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

/** Gira 90° en el sentido de las agujas del reloj. */
export function rotateCanvasClockwise(source: HTMLCanvasElement): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(source.height, source.width);
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

export function cropCanvas(source: HTMLCanvasElement, rect: CropRect): HTMLCanvasElement {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const width = Math.min(source.width - x, Math.round(rect.width));
  const height = Math.min(source.height - y, Math.round(rect.height));
  const { canvas, ctx } = createCanvas(width, height);
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas;
}

/**
 * Texto sobre la foto con contorno oscuro (se lee sobre fondos claros y oscuros), centrado en el
 * punto tocado. Varias líneas si el texto trae saltos.
 */
export function drawTextOnCanvas(
  source: HTMLCanvasElement,
  text: string,
  center: { x: number; y: number },
  color: string,
  fontPx: number
): HTMLCanvasElement {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.font = `700 ${fontPx}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, fontPx / 7);
  ctx.strokeStyle = color === '#000000' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.75)';
  ctx.fillStyle = color;
  const lines = text.split('\n');
  const lineHeight = fontPx * 1.2;
  const top = center.y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const y = top + index * lineHeight;
    ctx.strokeText(line, center.x, y);
    ctx.fillText(line, center.x, y);
  });
  return canvas;
}

/** Exporta en WebP (o JPEG si el navegador no lo admite), como las fotos comprimidas del apunte. */
export function canvasToImageBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  // La prueba se hace en un lienzo de 1×1: codificar la foto entera solo para saberlo sería lento
  const type = createCanvas(1, 1).canvas.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo guardar la foto editada.'))), type, quality);
  });
}
