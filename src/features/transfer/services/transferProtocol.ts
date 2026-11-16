/**
 * Formato del código QR para pasar datos entre el teléfono y la PC por la red local.
 *
 * El QR no lleva los datos (no caben): lleva la "invitación" para conectarse a la PC.
 * - Hacia dónde van los datos.
 * - Las direcciones IPv4 privadas de la PC y su puerto.
 * - Un token de un solo uso.
 * - La clave AES-256 con la que se cifran los datos.
 * Ejemplo: agenda-transfer://v1?d=up&h=192.168.1.20&p=51234&t=…&k=…
 */

/** to-pc: el teléfono envía sus datos a la PC. to-phone: la PC envía sus datos al teléfono. */
export type TransferDirection = 'to-pc' | 'to-phone';

export interface TransferInvite {
  direction: TransferDirection;
  hosts: string[];
  port: number;
  /** Token de un solo uso (base64url) que el servidor de la PC exige en cada petición. */
  token: string;
  /** Clave AES-256 en base64url: solo viaja dentro del QR, nunca por la red. */
  key: string;
}

/** Ruta base del servidor temporal de la PC (debe coincidir con electron/transferServer.cjs). */
export const TRANSFER_BASE_PATH = '/agenda-transfer/v1';

const INVITE_PREFIX = 'agenda-transfer://v1?';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_HOSTS = 4;

/**
 * Solo se aceptan direcciones de redes locales (10.x, 172.16-31.x, 192.168.x): así un QR malicioso
 * no puede hacer que el teléfono envíe los datos a un servidor de internet.
 */
export function isPrivateIPv4(address: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return false;
  const parts = address.split('.').map(Number);
  if (parts.some((n) => n > 255)) return false;
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function buildInviteText(invite: TransferInvite): string {
  const params = new URLSearchParams({
    d: invite.direction === 'to-pc' ? 'up' : 'down',
    h: invite.hosts.join(','),
    p: String(invite.port),
    t: invite.token,
    k: invite.key,
  });
  return INVITE_PREFIX + params.toString();
}

/** Lee el texto de un QR; devuelve null si no es una invitación válida de la agenda. */
export function parseInviteText(text: string): TransferInvite | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(INVITE_PREFIX)) return null;
  const params = new URLSearchParams(trimmed.slice(INVITE_PREFIX.length));

  const direction = params.get('d');
  const hosts = (params.get('h') ?? '').split(',').filter(Boolean);
  const port = Number(params.get('p'));
  const token = params.get('t') ?? '';
  const key = params.get('k') ?? '';

  if (direction !== 'up' && direction !== 'down') return null;
  if (hosts.length === 0 || hosts.length > MAX_HOSTS || !hosts.every(isPrivateIPv4)) return null;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return null;
  if (!TOKEN_PATTERN.test(token) || !KEY_PATTERN.test(key)) return null;

  return { direction: direction === 'up' ? 'to-pc' : 'to-phone', hosts, port, token, key };
}

/** Lo que trae un respaldo, para confirmarlo antes de reemplazar los datos. */
export interface BackupSummary {
  subjects: number;
  professors: number;
  scheduleSlots: number;
  notes: number;
}

export function summarizeBackupJson(jsonText: string): BackupSummary | null {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const data = (parsed as { data?: unknown }).data;
    if (typeof data !== 'object' || data === null) return null;
    const count = (key: string): number => {
      const value = (data as Record<string, unknown>)[key];
      return Array.isArray(value) ? value.length : 0;
    };
    return {
      subjects: count('subjects'),
      professors: count('professors'),
      scheduleSlots: count('scheduleSlots'),
      notes: count('notes'),
    };
  } catch {
    return null;
  }
}

export function describeBackupSummary(summary: BackupSummary): string {
  const part = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    part(summary.subjects, 'materia', 'materias'),
    part(summary.scheduleSlots, 'clase en el horario', 'clases en el horario'),
    part(summary.notes, 'apunte', 'apuntes'),
    part(summary.professors, 'docente', 'docentes'),
  ].join(' · ');
}
