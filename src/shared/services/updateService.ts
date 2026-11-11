import { Capacitor } from '@capacitor/core';
import { APP_INFO } from '../constants/appInfo';
import { WidgetBridge } from '../plugins/widgetBridge';

/**
 * Comprobación de actualizaciones. El manifiesto public/version.json se lee desde la rama main de
 * GitHub (raw), así basta con publicarlo para avisar a todas las instalaciones.
 *
 * Flujo de publicación: primero se sube el APK nuevo a GitHub Releases y DESPUÉS se actualiza
 * latestVersion en version.json; si no, se avisaría de una versión que todavía no se puede descargar.
 */
export const REMOTE_VERSION_URL =
  'https://raw.githubusercontent.com/JorgeBarrera117/Agenda-Universitaria/main/public/version.json';
const CHECK_TIMEOUT_MS = 4000;
const DISMISSED_STORAGE_KEY = 'agenda_dismissed_update';

const MAX_HIGHLIGHTS = 10;
const MAX_HIGHLIGHT_LENGTH = 200;
const VERSION_PATTERN = /^v?\d+(\.\d+){0,4}$/;

/**
 * Solo se abren enlaces del repositorio y de la web del proyecto: si alguien alterara
 * version.json, no podría mandar a los estudiantes a una descarga falsa en otro sitio.
 */
function isTrustedUpdateUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (url.hostname === 'jorgebarrera117.github.io') return true;
    return url.hostname === 'github.com' && url.pathname.toLowerCase().startsWith('/jorgebarrera117/agenda-universitaria');
  } catch {
    return false;
  }
}

export interface UpdateInfo {
  latestVersion: string;
  releaseDate?: string;
  apkUrl?: string;
  webUrl?: string;
  highlights: string[];
}

export type UpdateCheckResult =
  | { status: 'available'; info: UpdateInfo; currentVersion: string }
  | { status: 'up-to-date'; info: UpdateInfo; currentVersion: string }
  | { status: 'error'; message: string; currentVersion: string };

/**
 * ¿remoteVer es posterior a currentVer? Compara numéricamente cada segmento (1.7.10.39 > 1.7.10.38,
 * 1.7.10 < 1.7.10.1, 1.10 > 1.9) e ignora una "v" inicial y sufijos como "-beta".
 */
export function isNewerVersion(remoteVer: string, currentVer: string): boolean {
  const parse = (version: string) =>
    version
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const remote = parse(remoteVer);
  const current = parse(currentVer);
  for (let i = 0; i < Math.max(remote.length, current.length); i++) {
    const diff = (remote[i] ?? 0) - (current[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** Valida el manifiesto descargado: formato de versión, enlaces de confianza y novedades acotadas. */
export function parseVersionManifest(raw: unknown): UpdateInfo {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('El manifiesto de versión no es válido.');
  }
  const data = raw as Record<string, unknown>;
  const latestVersion = typeof data.latestVersion === 'string' ? data.latestVersion.trim() : '';
  if (!VERSION_PATTERN.test(latestVersion)) {
    throw new Error('El manifiesto de versión no indica una versión válida.');
  }
  const url = (value: unknown) => (typeof value === 'string' && isTrustedUpdateUrl(value) ? value : undefined);
  const releaseDate =
    typeof data.releaseDate === 'string' && !Number.isNaN(Date.parse(data.releaseDate)) ? data.releaseDate : undefined;
  const highlights = Array.isArray(data.highlights)
    ? data.highlights
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.replace(/\s+/g, ' ').trim().slice(0, MAX_HIGHLIGHT_LENGTH))
        .filter(Boolean)
        .slice(0, MAX_HIGHLIGHTS)
    : [];
  return {
    latestVersion: latestVersion.replace(/^v/i, ''),
    releaseDate,
    apkUrl: url(data.apkUrl),
    webUrl: url(data.webUrl),
    highlights,
  };
}

async function fetchManifest(url: string): Promise<UpdateInfo> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    // no-store: siempre la versión publicada, nunca una copia en caché del navegador
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseVersionManifest(await response.json());
  } finally {
    window.clearTimeout(timer);
  }
}

/** Último resultado en esta sesión (el aviso de inicio y Ajustes comparten la consulta). */
let lastCheckResult: UpdateCheckResult | null = null;

export function getLastUpdateCheck(): UpdateCheckResult | null {
  return lastCheckResult;
}

/**
 * Consulta si hay una versión más nueva (tiempo límite de 4 s por intento). Nunca lanza: devuelve
 * status 'error' sin conexión o si el manifiesto no se pudo leer.
 * - Android: solo el manifiesto remoto. El version.json incluido en el APK es el de la propia
 *   versión instalada, así que compararse con él nunca encontraría nada.
 * - Web: si GitHub falla, se prueba el version.json del propio servidor (puede ser más nuevo que
 *   la copia de la PWA que tiene el navegador).
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = APP_INFO.version;
  const sources = Capacitor.isNativePlatform()
    ? [REMOTE_VERSION_URL]
    : [REMOTE_VERSION_URL, `${import.meta.env.BASE_URL}version.json`];

  for (const source of sources) {
    try {
      const info = await fetchManifest(source);
      const result: UpdateCheckResult = {
        status: isNewerVersion(info.latestVersion, currentVersion) ? 'available' : 'up-to-date',
        info,
        currentVersion,
      };
      lastCheckResult = result;
      return result;
    } catch (err) {
      console.warn(`No se pudo consultar ${source}:`, err);
    }
  }
  const result: UpdateCheckResult = {
    status: 'error',
    message: 'No se pudo comprobar la conexión. La app funciona en modo sin conexión.',
    currentVersion,
  };
  lastCheckResult = result;
  return result;
}

/** Fecha "12 nov 2026" a partir de "2026-11-12" sin desfases de zona horaria. */
export function formatReleaseDate(isoDate?: string): string | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "Ahora no": no volver a mostrar el aviso automático de esta versión durante el día de hoy. */
export function dismissUpdateForToday(version: string): void {
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify({ version, date: todayKey() }));
  } catch {
    // Sin almacenamiento (modo privado): el aviso podrá volver a salir, no es grave
  }
}

/** ¿El usuario ya pospuso hoy el aviso de esta versión? */
export function isUpdateDismissedToday(version: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as { version?: unknown; date?: unknown };
    return saved.version === version && saved.date === todayKey();
  } catch {
    return false;
  }
}

/** Enlace de la actualización según la plataforma: el APK en Android, la web en el navegador. */
export function updateUrlFor(info: UpdateInfo): string | undefined {
  return Capacitor.isNativePlatform() ? (info.apkUrl ?? info.webUrl) : (info.webUrl ?? info.apkUrl);
}

/**
 * Abre el enlace de descarga fuera de la app. En Android lo abre el navegador del sistema con un
 * intent nativo (window.open(url, '_system') es una convención de Cordova que Capacitor no
 * garantiza); en la web, en una pestaña nueva.
 */
export async function openDownloadUrl(url: string): Promise<void> {
  if (!isTrustedUpdateUrl(url)) {
    throw new Error('El enlace de descarga no es de confianza.');
  }
  if (Capacitor.isNativePlatform()) {
    await WidgetBridge.openExternalUrl({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
