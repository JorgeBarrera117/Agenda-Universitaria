/**
 * Recorta una foto al cuadrado central y la reduce a `size`×`size` en JPEG.
 *
 * Usa createImageBitmap en vez de FileReader: decodifica el archivo directamente (sin convertir
 * una foto de 12 MP a una cadena base64 de varios MB) y respeta la orientación EXIF de la cámara.
 * El resultado (~15-30 KB) es lo bastante pequeño para guardarse junto a los ajustes.
 */
export async function cropImageToSquareDataUrl(file: File, size = 256, quality = 0.85): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.');
  }

  const bitmap = await decodeImage(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible.');

    // JPEG no tiene transparencia: fondo blanco para PNG/WebP con alfa
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Respaldo para navegadores que no decodifican ciertos formatos con createImageBitmap
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
