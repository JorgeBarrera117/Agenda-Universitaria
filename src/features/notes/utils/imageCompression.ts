/**
 * Utilidad de compresión de imágenes en el cliente (Browser-Side).
 * Utiliza HTML5 Canvas y createImageBitmap para redimensionar fotos de cámaras
 * de alta resolución (ej. 12-48 MPx) a un tamaño óptimo para pizarras y apuntes (max 1600px)
 * reduciendo el peso de ~8MB a ~200-300KB sin pérdida perceptible de legibilidad en texto.
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.8
): Promise<{ blob: Blob; mimeType: string }> {
  // 1. Decodificar la imagen utilizando createImageBitmap (más rápido y respeta orientación EXIF)
  let imageBitmap: ImageBitmap | null = null;
  let fallbackUrl: string | null = null;

  try {
    try {
      imageBitmap = await createImageBitmap(file);
    } catch {
      // Fallback con Image HTML y limpieza garantizada de ObjectURL
      imageBitmap = await new Promise<ImageBitmap>((resolve, reject) => {
        const img = new Image();
        fallbackUrl = URL.createObjectURL(file);
        img.onload = async () => {
          try {
            const bmp = await createImageBitmap(img);
            resolve(bmp);
          } catch (err) {
            reject(err);
          } finally {
            if (fallbackUrl) {
              URL.revokeObjectURL(fallbackUrl);
              fallbackUrl = null;
            }
          }
        };
        img.onerror = (e) => {
          if (fallbackUrl) {
            URL.revokeObjectURL(fallbackUrl);
            fallbackUrl = null;
          }
          reject(e);
        };
        img.src = fallbackUrl;
      });
    }

    // 2. Calcular nuevas dimensiones manteniendo la relación de aspecto (aspect ratio)
    let { width, height } = imageBitmap;
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // 3. Dibujar en un canvas fuera de pantalla
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo obtener el contexto 2D para compresión.');

    // Fondo blanco por si la imagen tiene transparencias (PNG/WebP)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    // 4. Determinar formato óptimo (WebP preferido, JPEG fallback)
    const isWebPSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    const targetMime = isWebPSupported ? 'image/webp' : 'image/jpeg';

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          // Inmediatamente vaciar el canvas para liberar la memoria gráfica en el heap y GPU
          canvas.width = 0;
          canvas.height = 0;

          if (!blob) {
            reject(new Error('Fallo al comprimir la imagen en Blob.'));
            return;
          }
          resolve({ blob, mimeType: targetMime });
        },
        targetMime,
        quality
      );
    });
  } finally {
    // Liberar la textura gráfica no comprimida del bitmap en la GPU/RAM del dispositivo
    if (imageBitmap) {
      imageBitmap.close();
    }
    if (fallbackUrl) {
      URL.revokeObjectURL(fallbackUrl);
    }
  }
}
