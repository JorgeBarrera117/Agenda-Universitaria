/** Solo imágenes rasterizadas: un SVG podría transportar scripts. */
export const SAFE_IMAGE_DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,[A-Za-z0-9+/=\s]+$/;

/**
 * Solo formatos de audio que graba MediaRecorder (WebM/Ogg con Opus, MP4/AAC en Safari) o comunes
 * (MP3, WAV), con el códec opcional ("audio/webm;codecs=opus").
 */
export const SAFE_AUDIO_DATA_URL =
  /^data:(audio\/(?:webm|ogg|mp4|mpeg|aac|wav|x-m4a)(?:;codecs=[A-Za-z0-9.,"-]+)?);base64,[A-Za-z0-9+/=\s]+$/;

/** Convierte un Blob en data URL base64 (para guardarlo dentro de un JSON). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(blob);
  });
}

/** Convierte un data URL base64 en Blob sin fetch() (el CSP bloquea fetch sobre data:). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ''] = dataUrl.split(',', 2);
  const mime = /^data:([^;,]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
