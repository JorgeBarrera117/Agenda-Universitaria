import type { TransferDirection } from './transferProtocol';

/**
 * Cifrado de extremo a extremo de la transferencia por wifi.
 *
 * El respaldo se comprime (gzip) y se cifra con AES-256-GCM, que también detecta cualquier
 * alteración. La clave es aleatoria, se crea para cada transferencia y solo viaja dentro del QR:
 * - alguien en la misma red no puede leer lo que pasa por el wifi;
 * - el proceso principal de Electron, que solo reenvía, tampoco puede leerlo.
 *
 * Formato: base64( IV de 12 bytes ‖ texto cifrado con su etiqueta GCM ).
 */

const KEY_BYTES = 32;
const IV_BYTES = 12;
const BASE64_CHUNK = 0x6000; // múltiplo de 3 (para codificar) y de 4 en base64 (para decodificar)

export class TransferCryptoError extends Error {}

export function createTransferKey(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

function additionalData(direction: TransferDirection): Uint8Array<ArrayBuffer> {
  // Liga el mensaje a su dirección: un paquete "PC → teléfono" no se acepta como "teléfono → PC"
  return new TextEncoder().encode(`agenda-transfer-v1:${direction}`);
}

async function importKey(keyBase64Url: string): Promise<CryptoKey> {
  const raw = base64UrlToBytes(keyBase64Url);
  if (raw.length !== KEY_BYTES) throw new TransferCryptoError('Clave de transferencia no válida.');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function pipeThrough(bytes: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function sealTransferPayload(text: string, keyBase64Url: string, direction: TransferDirection): Promise<string> {
  const key = await importKey(keyBase64Url);
  const compressed = await pipeThrough(new TextEncoder().encode(text), new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: additionalData(direction) }, key, compressed)
  );
  const sealed = new Uint8Array(IV_BYTES + cipher.length);
  sealed.set(iv, 0);
  sealed.set(cipher, IV_BYTES);
  return bytesToBase64(sealed);
}

export async function openTransferPayload(sealedBase64: string, keyBase64Url: string, direction: TransferDirection): Promise<string> {
  const key = await importKey(keyBase64Url);
  let sealed: Uint8Array<ArrayBuffer>;
  try {
    sealed = base64ToBytes(sealedBase64.trim());
  } catch {
    throw new TransferCryptoError('Los datos recibidos están incompletos.');
  }
  if (sealed.length <= IV_BYTES) throw new TransferCryptoError('Los datos recibidos están incompletos.');

  let compressed: Uint8Array<ArrayBuffer>;
  try {
    compressed = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: sealed.slice(0, IV_BYTES), additionalData: additionalData(direction) },
        key,
        sealed.slice(IV_BYTES)
      )
    );
  } catch {
    throw new TransferCryptoError('Los datos recibidos no se pudieron abrir (llegaron dañados o con otra clave).');
  }
  const plain = await pipeThrough(compressed, new DecompressionStream('gzip'));
  return new TextDecoder().decode(plain);
}

/* --------------------------------- base64 por bloques --------------------------------- */
// Los respaldos con fotos y audios pesan decenas de MB: se convierte por partes para no
// desbordar la pila con String.fromCharCode(...bytes).

function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK);
    let binary = '';
    for (let i = 0; i < chunk.length; i += 1) binary += String.fromCharCode(chunk[i]);
    parts.push(btoa(binary));
  }
  return parts.join('');
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const clean = base64.replace(/\s+/g, '');
  const step = (BASE64_CHUNK / 3) * 4;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (let offset = 0; offset < clean.length; offset += step) {
    const binary = atob(clean.slice(offset, offset + step));
    const chunk = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) chunk[i] = binary.charCodeAt(i);
    chunks.push(chunk);
    total += chunk.length;
  }
  const out = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
}
