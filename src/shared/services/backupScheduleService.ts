import { Capacitor } from '@capacitor/core';
import { db } from '../db/AppDatabase';
import { WidgetBridge } from '../plugins/widgetBridge';
import { generateBackupData } from '../utils/backup';
import type { AppSettings } from '../../features/settings/types';

/**
 * Copias de seguridad programadas. Todo vive solo en el dispositivo: si el teléfono se pierde o se
 * borra la app, sin una copia se pierde todo. Por eso:
 * - Se recuerda cuándo fue el último respaldo (manual o automático).
 * - Copia automática semanal donde se puede guardar un archivo sin preguntar: Android (Descargas)
 *   y Windows (Documentos › Agenda Universitaria › Respaldos). En la web el navegador siempre
 *   pregunta antes de descargar, así que ahí solo hay recordatorio.
 * - Recordatorio si pasan 14 días sin respaldo (como mucho cada 3 días).
 */
const LAST_BACKUP_KEY = 'agenda_last_backup_at';
const FIRST_SEEN_KEY = 'agenda_backup_first_seen';
const REMINDER_SHOWN_KEY = 'agenda_backup_reminder_shown_at';

const DAY_MS = 24 * 60 * 60 * 1000;
export const AUTO_BACKUP_INTERVAL_DAYS = 7;
export const BACKUP_REMINDER_AFTER_DAYS = 14;
const REMINDER_REPEAT_DAYS = 3;

function readDate(key: string): Date | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function writeDate(key: string, date: Date): void {
  try {
    localStorage.setItem(key, date.toISOString());
  } catch {
    // Sin almacenamiento: no se recuerda, no es grave
  }
}

/** Días completos desde una fecha (0 si fue hoy). */
export function daysSince(date: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

/** «hoy», «ayer», «hace 5 días». */
export function describeDaysAgo(date: Date): string {
  const days = daysSince(date);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

export function getLastBackupAt(): Date | null {
  return readDate(LAST_BACKUP_KEY);
}

/** Registra una copia hecha (la llaman todas las formas de exportar). */
export function markBackupDone(at = new Date()): void {
  writeDate(LAST_BACKUP_KEY, at);
  window.dispatchEvent(new CustomEvent('agenda-backup-done'));
}

/** ¿Este dispositivo puede guardar la copia sola, sin preguntar? */
export function canAutoBackup(): boolean {
  return Capacitor.isNativePlatform() || Boolean(typeof window !== 'undefined' && window.electronAPI?.saveBackupFile);
}

/** Dónde quedan las copias automáticas, para decírselo al estudiante. */
export function autoBackupLocation(): string {
  return Capacitor.isNativePlatform() ? 'Descargas' : 'Documentos › Agenda Universitaria › Respaldos';
}

async function hasUserData(): Promise<boolean> {
  const counts = await Promise.all([db.subjects.count(), db.scheduleSlots.count(), db.notes.count()]);
  return counts.some((count) => count > 0);
}

/**
 * Copia automática si toca (activada, pasó una semana desde la última y hay algo que guardar).
 * Devuelve el archivo y dónde quedó, o null si no hizo falta o no se pudo.
 */
export async function runAutoBackupIfDue(settings: Pick<AppSettings, 'autoBackupEnabled'>): Promise<{ fileName: string; location: string } | null> {
  if (!settings.autoBackupEnabled || !canAutoBackup()) return null;
  const last = getLastBackupAt();
  if (last && daysSince(last) < AUTO_BACKUP_INTERVAL_DAYS) return null;
  if (!(await hasUserData())) return null;

  const { jsonString, fileName } = await generateBackupData();
  if (Capacitor.isNativePlatform()) {
    const result = await WidgetBridge.saveToDownloads({ content: jsonString, fileName });
    markBackupDone();
    return { fileName: result.fileName || fileName, location: autoBackupLocation() };
  }
  const desktop = window.electronAPI;
  if (!desktop?.saveBackupFile) return null;
  await desktop.saveBackupFile({ fileName, content: jsonString });
  markBackupDone();
  return { fileName, location: autoBackupLocation() };
}

/**
 * ¿Toca recordar que se haga una copia? Solo si el recordatorio está activo, no hay copia
 * automática que lo resuelva sola, hay datos y pasaron 14 días (contando desde la primera vez que
 * la app lo comprobó, si nunca se hizo una copia). Devuelve los días sin copia (null = nunca).
 */
export async function getBackupReminder(
  settings: Pick<AppSettings, 'backupReminderEnabled' | 'autoBackupEnabled'>
): Promise<{ daysWithoutBackup: number | null } | null> {
  if (settings.backupReminderEnabled === false) return null;
  if (settings.autoBackupEnabled && canAutoBackup()) return null;

  const now = new Date();
  let firstSeen = readDate(FIRST_SEEN_KEY);
  if (!firstSeen) {
    firstSeen = now;
    writeDate(FIRST_SEEN_KEY, now);
  }
  const last = getLastBackupAt();
  const since = last ?? firstSeen;
  if (daysSince(since, now) < BACKUP_REMINDER_AFTER_DAYS) return null;

  const shown = readDate(REMINDER_SHOWN_KEY);
  if (shown && daysSince(shown, now) < REMINDER_REPEAT_DAYS) return null;
  if (!(await hasUserData())) return null;
  return { daysWithoutBackup: last ? daysSince(last, now) : null };
}

/** El aviso se mostró: no repetirlo en unos días. */
export function markBackupReminderShown(): void {
  writeDate(REMINDER_SHOWN_KEY, new Date());
}
