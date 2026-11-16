/**
 * Bloqueo de la app con PIN (y huella en Android). Es una pantalla de privacidad: evita que otra
 * persona abra la agenda en este dispositivo, pero los datos no se cifran (siguen en IndexedDB).
 *
 * - El PIN nunca se guarda: se guarda su derivación PBKDF2-SHA-256 (150 000 iteraciones) con una sal
 *   aleatoria, y se compara en tiempo constante.
 * - Al activarlo se genera un código de recuperación (se muestra una sola vez) por si se olvida el PIN.
 * - Tras 5 intentos fallidos hay que esperar 30 s (crece con cada nueva tanda de fallos).
 * - Se guarda aparte de los ajustes (no viaja en las copias de seguridad ni a otro dispositivo).
 */
const STORAGE_KEY = 'agenda_app_lock';
const ATTEMPTS_KEY = 'agenda_app_lock_attempts';
const ITERATIONS = 150_000;
const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30_000;

export const LOCK_AFTER_OPTIONS = [0, 1, 5, 15] as const;
export type LockAfterMinutes = (typeof LOCK_AFTER_OPTIONS)[number];

export interface AppLockConfig {
  pinHash: string;
  pinSalt: string;
  /** Cantidad de dígitos: el teclado desbloquea al completar el último. */
  pinLength: number;
  recoveryHash: string;
  recoverySalt: string;
  /** Desbloquear también con la huella o el bloqueo del teléfono (Android). */
  biometric: boolean;
  /** Minutos fuera de la app tras los que se vuelve a pedir (0 = siempre). */
  lockAfterMinutes: LockAfterMinutes;
}

interface AttemptsState {
  failures: number;
  lockedUntil: number;
  rounds: number;
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function derive(secret: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toBase64(new Uint8Array(bits));
}

function randomSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(16));
}

/** Comparación que no se corta en el primer carácter distinto (no filtra cuánto coincide). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/** Código de recuperación legible: 3 grupos de 4 (sin letras que se confundan). */
function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((group) => group.join('')).join('-');
}

const normalizeRecovery = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function getLockConfig(): AppLockConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppLockConfig>;
    if (!parsed.pinHash || !parsed.pinSalt || !parsed.recoveryHash || !parsed.recoverySalt) return null;
    return {
      pinHash: parsed.pinHash,
      pinSalt: parsed.pinSalt,
      pinLength: parsed.pinLength && parsed.pinLength >= 4 && parsed.pinLength <= 6 ? parsed.pinLength : 4,
      recoveryHash: parsed.recoveryHash,
      recoverySalt: parsed.recoverySalt,
      biometric: Boolean(parsed.biometric),
      lockAfterMinutes: (LOCK_AFTER_OPTIONS as readonly number[]).includes(parsed.lockAfterMinutes ?? -1)
        ? (parsed.lockAfterMinutes as LockAfterMinutes)
        : 0,
    };
  } catch {
    return null;
  }
}

export function isLockEnabled(): boolean {
  return getLockConfig() !== null;
}

function saveConfig(config: AppLockConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('agenda-app-lock-changed'));
}

/** Activa el bloqueo con este PIN. Devuelve el código de recuperación (mostrarlo una sola vez). */
export async function enableLock(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error('El PIN debe tener de 4 a 6 números.');
  const recoveryCode = generateRecoveryCode();
  const pinSalt = randomSalt();
  const recoverySalt = randomSalt();
  saveConfig({
    pinHash: await derive(pin, pinSalt),
    pinSalt: toBase64(pinSalt),
    pinLength: pin.length,
    recoveryHash: await derive(normalizeRecovery(recoveryCode), recoverySalt),
    recoverySalt: toBase64(recoverySalt),
    biometric: false,
    // 1 minuto: tomar una foto o compartir un archivo sale un momento de la app y no debería bloquearla
    lockAfterMinutes: 1,
  });
  clearAttempts();
  return recoveryCode;
}

export async function changePin(newPin: string): Promise<void> {
  const config = getLockConfig();
  if (!config) throw new Error('El bloqueo no está activo.');
  if (!isValidPin(newPin)) throw new Error('El PIN debe tener de 4 a 6 números.');
  const pinSalt = randomSalt();
  saveConfig({ ...config, pinHash: await derive(newPin, pinSalt), pinSalt: toBase64(pinSalt), pinLength: newPin.length });
}

export function disableLock(): void {
  localStorage.removeItem(STORAGE_KEY);
  clearAttempts();
  window.dispatchEvent(new CustomEvent('agenda-app-lock-changed'));
}

export function updateLockOptions(options: Partial<Pick<AppLockConfig, 'biometric' | 'lockAfterMinutes'>>): void {
  const config = getLockConfig();
  if (config) saveConfig({ ...config, ...options });
}

function readAttempts(): AttemptsState {
  try {
    const parsed = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}') as Partial<AttemptsState>;
    return { failures: parsed.failures ?? 0, lockedUntil: parsed.lockedUntil ?? 0, rounds: parsed.rounds ?? 0 };
  } catch {
    return { failures: 0, lockedUntil: 0, rounds: 0 };
  }
}

function writeAttempts(state: AttemptsState): void {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento: el límite de intentos solo dura esta sesión
  }
}

function clearAttempts(): void {
  try {
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    // Nada que limpiar
  }
}

/** Milisegundos que faltan para poder volver a intentarlo (0 = ya se puede). */
export function getLockoutRemainingMs(): number {
  return Math.max(0, readAttempts().lockedUntil - Date.now());
}

function registerFailure(): void {
  const state = readAttempts();
  const failures = state.failures + 1;
  if (failures >= MAX_ATTEMPTS) {
    const rounds = state.rounds + 1;
    writeAttempts({ failures: 0, rounds, lockedUntil: Date.now() + BASE_LOCKOUT_MS * rounds });
  } else {
    writeAttempts({ ...state, failures });
  }
}

/** Comprueba el PIN. Respeta la espera tras varios fallos. */
export async function verifyPin(pin: string): Promise<boolean> {
  const config = getLockConfig();
  if (!config || getLockoutRemainingMs() > 0) return false;
  const ok = safeEqual(await derive(pin, fromBase64(config.pinSalt)), config.pinHash);
  if (ok) clearAttempts();
  else registerFailure();
  return ok;
}

/** Comprueba el código de recuperación (permite desbloquear y elegir un PIN nuevo). */
export async function verifyRecoveryCode(code: string): Promise<boolean> {
  const config = getLockConfig();
  if (!config || getLockoutRemainingMs() > 0) return false;
  const ok = safeEqual(await derive(normalizeRecovery(code), fromBase64(config.recoverySalt)), config.recoveryHash);
  if (ok) clearAttempts();
  else registerFailure();
  return ok;
}
