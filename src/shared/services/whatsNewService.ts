import { APP_INFO } from '../constants/appInfo';
import { changelogSince, changelogUpTo, type ChangelogEntry } from '../constants/changelog';

/** Última versión cuyo aviso "Lo nuevo" ya vio el estudiante. */
const LAST_SEEN_KEY = 'agenda_last_seen_version';

/**
 * Novedades pendientes de mostrar tras actualizar. Si no hay registro (primera vez con esta
 * función, o instalación nueva) se muestran solo las de la versión instalada, una vez.
 * Devuelve [] si ya se vieron o si la versión instalada no tiene entrada en el historial.
 */
export function getUnseenChangelog(): ChangelogEntry[] {
  let lastSeen: string | null = null;
  try {
    lastSeen = localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return [];
  }
  if (lastSeen) return changelogSince(lastSeen);
  const current = changelogUpTo()[0];
  return current && current.version === APP_INFO.version ? [current] : [];
}

/** Marca como vistas las novedades de la versión instalada (no se vuelve a mostrar el aviso). */
export function markChangelogSeen(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, APP_INFO.version);
  } catch {
    // Sin almacenamiento: el aviso podría repetirse, pero no rompe nada
  }
}
