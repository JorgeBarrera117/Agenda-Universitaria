import { Capacitor } from '@capacitor/core';
import { WidgetBridge } from '../plugins/widgetBridge';

export interface ImageCopyResult {
  ok: boolean;
  /** Motivo del fallo, para mostrarlo al usuario y poder diagnosticarlo en el teléfono. */
  error?: string;
}

const WEB_CLIPBOARD_TIMEOUT_MS = 5000;

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Re-codifica una imagen (data:, blob: o ruta local) como PNG. Se decodifica con <img> y no con
 * fetch(): el CSP (connect-src 'self' https:) bloquea fetch sobre URLs data:, e img-src sí las permite.
 */
export async function imageSrcToPngBlob(src: string): Promise<Blob> {
  const img = new window.Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')?.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error('No se pudo convertir la imagen.');
  return blob;
}

/** Convierte un data URL en File sin fetch() (el CSP bloquea fetch sobre data:). */
export function dataUrlToFile(dataUrl: string, baseName: string): File {
  const [header, base64 = ''] = dataUrl.split(',', 2);
  const mimeType = /^data:([^;,]+)/.exec(header)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  return new File([bytes], `${baseName}.${extension}`, { type: mimeType });
}

/**
 * Imagen que hay ahora en el portapapeles del teléfono (copiada en la app, WhatsApp, Chrome…).
 * Solo en Android: allí el WebView no siempre entrega la imagen en el evento de pegar, así que se
 * lee con el puente nativo. Devuelve null si no hay imagen o fuera de Android.
 */
export async function readImageFromSystemClipboard(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const res = await WidgetBridge.readImageFromClipboard();
  if (!res?.hasImage || !res.dataUrl) return null;
  return dataUrlToFile(res.dataUrl, 'imagen-pegada');
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

/**
 * Copia una imagen al portapapeles del sistema para pegarla en WhatsApp, Telegram, Word, etc.
 * - Android (Capacitor): el portapapeles web del WebView no llega al ClipboardManager de Android,
 *   así que se usa el puente nativo (archivo en caché + FileProvider + ClipData image/*).
 * - Web/PC: ClipboardItem PNG. write() se llama sin await previo para seguir dentro del toque del
 *   usuario (si no, el navegador lo rechaza), y con tiempo límite para no dejar el aviso colgado.
 */
export async function copyImageToSystemClipboard(src: string): Promise<ImageCopyResult> {
  if (Capacitor.isNativePlatform()) {
    try {
      // WhatsApp y los teclados aceptan JPEG/PNG; WebP, blob: u otros se pasan a PNG
      const isJpeg = /^data:image\/jpe?g[;,]/i.test(src);
      const isPng = /^data:image\/png[;,]/i.test(src);
      const base64Data = isJpeg || isPng ? src : await blobToDataUrl(await imageSrcToPngBlob(src));
      const res = await WidgetBridge.copyImageToClipboard({
        base64Data,
        mimeType: isJpeg ? 'image/jpeg' : 'image/png',
      });
      return res?.success ? { ok: true } : { ok: false, error: 'el sistema no confirmó la copia' };
    } catch (err) {
      console.warn('Puente nativo de portapapeles:', err);
      return { ok: false, error: errorMessage(err) };
    }
  }

  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return { ok: false, error: 'este navegador no permite copiar imágenes' };
  }
  try {
    const write = navigator.clipboard.write([new ClipboardItem({ 'image/png': imageSrcToPngBlob(src) })]);
    await Promise.race([
      write,
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('el portapapeles no respondió')), WEB_CLIPBOARD_TIMEOUT_MS)
      ),
    ]);
    return { ok: true };
  } catch (err) {
    console.warn('Portapapeles web:', err);
    return { ok: false, error: errorMessage(err) };
  }
}
