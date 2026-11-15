/**
 * Formatos de foto que el navegador no sabe abrir por sí solo.
 *
 * Chrome, el WebView de Android y Electron (Chromium) decodifican JPEG, PNG, WebP, GIF, BMP y
 * AVIF, pero no HEIC/HEIF: el formato que usan por defecto las cámaras de iPhone y de muchos
 * Samsung. Esas fotos se convierten a JPEG en el propio dispositivo con libheif compilado a
 * WebAssembly (librería `heic-to`), así que funciona sin conexión y la foto nunca sale del equipo.
 */

/** Atributo `accept` para elegir fotos: algunos selectores no asocian .heic con image/*. */
export const IMAGE_ACCEPT = 'image/*,.heic,.heif';

/** Texto para los mensajes de error. */
export const SUPPORTED_IMAGE_FORMATS_LABEL = 'JPG, PNG, WebP o HEIC';

const IMAGE_EXTENSION = /\.(jpe?g|jfif|png|webp|gif|bmp|avif|heic|heif|hif)$/i;
const HEIF_EXTENSION = /\.(heic|heif|hif)$/i;
const HEIF_MIME = /^image\/hei[cf](-sequence)?$/i;

/** Marcas («brands») de la caja ftyp de un archivo HEIF con imagen HEVC. */
const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1']);
/** AVIF también es un contenedor HEIF (marca mif1), pero el navegador sí lo abre. */
const AVIF_BRANDS = new Set(['avif', 'avis']);

/**
 * ¿Es una imagen? Mira el tipo MIME y, si viene vacío (Android suele dejarlo vacío con HEIC),
 * la extensión del nombre.
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || (file.type === '' && IMAGE_EXTENSION.test(file.name));
}

/**
 * ¿Es una foto HEIC/HEIF? Lee la caja `ftyp` de los primeros bytes en lugar de fiarse solo del
 * nombre o del tipo MIME, que a veces llegan vacíos o equivocados.
 */
export async function isHeifImage(file: Blob & { name?: string }): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const ascii = (from: number) => String.fromCharCode(...header.subarray(from, from + 4));

  if (header.length >= 16 && ascii(4) === 'ftyp') {
    const boxSize = Math.min(header.length, ((header[0] << 24) | (header[1] << 16) | (header[2] << 8) | header[3]) >>> 0);
    // Marca principal (offset 8) y compatibles (desde el offset 16, de 4 en 4)
    const brands = [ascii(8)];
    for (let offset = 16; offset + 4 <= boxSize; offset += 4) brands.push(ascii(offset));
    if (brands.some((brand) => AVIF_BRANDS.has(brand))) return false;
    return brands.some((brand) => HEIF_BRANDS.has(brand));
  }

  // Cabecera ilegible: se decide por el tipo o la extensión
  return HEIF_MIME.test(file.type) || HEIF_EXTENSION.test(file.name ?? '');
}

/**
 * Devuelve una foto que el navegador pueda mostrar y dibujar en un canvas: la misma si ya lo es,
 * o una copia en JPEG si es HEIC/HEIF. La conversión tarda 1-3 s en un teléfono de gama media
 * (por eso quien la llame debe mostrar «Preparando foto…») y el decodificador (~3 MB) solo se
 * carga la primera vez que se necesita.
 */
export async function toBrowserReadableImage(file: File): Promise<File> {
  if (!(await isHeifImage(file))) return file;

  const { heicTo } = await import('heic-to/csp');
  // Calidad alta: después la foto se vuelve a comprimir al reducirla (apuntes, perfil, fondo)
  const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
  const name = file.name.replace(HEIF_EXTENSION, '') + '.jpg';
  return new File([jpeg], name, { type: 'image/jpeg', lastModified: file.lastModified });
}
