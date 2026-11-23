import { base64ToBytes, bytesToBase64 } from '../../transfer/services/transferCrypto';

/**
 * Cifrado de la Sala de Intercambio Local.
 *
 * La clave de la sala sale del PIN con PBKDF2 (SHA-256, 120 000 vueltas) y una sal aleatoria de la
 * sala. Todo lo que viaja por el wifi (solicitud de entrada, mensajes, elementos y eventos) va
 * comprimido y cifrado con AES-256-GCM, que además detecta cualquier alteración:
 * - quien no sabe el PIN no puede leer la sala ni hacerse pasar por un participante;
 * - un PIN equivocado no descifra la solicitud de entrada, así el PIN nunca viaja en claro;
 * - los servidores nativos (Java y Node) solo reenvían texto cifrado.
 *
 * Límite conocido: un PIN de 4 a 6 cifras se puede adivinar por fuerza bruta si alguien graba el
 * tráfico de la red; la sala es para compartir apuntes en clase, no para secretos. El anfitrión
 * además limita los intentos fallidos por dispositivo.
 */

const PBKDF2_ITERATIONS = 120_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const ADDITIONAL_DATA = new TextEncoder().encode('agenda-room-v1');

export class RoomCryptoError extends Error {}

export function randomToken(bytes = 16): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function createSalt(): string {
  return randomToken(SALT_BYTES);
}

/** PIN de 4 o 6 cifras, uniforme (sin sesgo de módulo). */
export function createPin(length: 4 | 6): string {
  let pin = '';
  const buffer = new Uint8Array(1);
  while (pin.length < length) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < 250) pin += String(buffer[0] % 10);
  }
  return pin;
}

export async function deriveRoomKey(pin: string, saltBase64Url: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(saltBase64Url), iterations: PBKDF2_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function pipeThrough(bytes: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** JSON → gzip → AES-GCM → base64( IV ‖ cifrado ). Una sola línea: sirve tal cual en SSE. */
export async function sealJson(key: CryptoKey, value: unknown): Promise<string> {
  const compressed = await pipeThrough(new TextEncoder().encode(JSON.stringify(value)), new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: ADDITIONAL_DATA }, key, compressed));
  const sealed = new Uint8Array(IV_BYTES + cipher.length);
  sealed.set(iv, 0);
  sealed.set(cipher, IV_BYTES);
  return bytesToBase64(sealed);
}

export async function openJson(key: CryptoKey, sealedBase64: string): Promise<unknown> {
  let sealed: Uint8Array<ArrayBuffer>;
  try {
    sealed = base64ToBytes(sealedBase64.trim());
  } catch {
    throw new RoomCryptoError('Datos incompletos.');
  }
  if (sealed.length <= IV_BYTES) throw new RoomCryptoError('Datos incompletos.');
  let compressed: Uint8Array<ArrayBuffer>;
  try {
    compressed = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(0, IV_BYTES), additionalData: ADDITIONAL_DATA }, key, sealed.slice(IV_BYTES))
    );
  } catch {
    throw new RoomCryptoError('No se pudo descifrar (PIN distinto o datos dañados).');
  }
  const plain = await pipeThrough(compressed, new DecompressionStream('gzip'));
  try {
    return JSON.parse(new TextDecoder().decode(plain)) as unknown;
  } catch {
    throw new RoomCryptoError('Datos dañados.');
  }
}

/** Bytes → base64 (archivos de la Biblioteca dentro del elemento). */
export function bytesToBase64String(bytes: Uint8Array): string {
  return bytesToBase64(bytes);
}

export function base64StringToBytes(value: string): Uint8Array<ArrayBuffer> {
  return base64ToBytes(value);
}

function toBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
}
