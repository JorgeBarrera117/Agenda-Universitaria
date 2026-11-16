import { useEffect, useState } from 'react';
import { useAppSettings } from '../../features/settings/hooks/useAppSettings';
import { getSeason, type Season } from './seasonService';

/** Cada cuánto se vuelve a mirar la fecha (la app puede quedar abierta al cambiar de mes). */
const RECHECK_MS = 60 * 60_000;

/**
 * Temporada activa, o null si no hay ninguna o el usuario apagó la decoración.
 * Se actualiza sola al cambiar el día, y también cuando la app vuelve a primer plano.
 */
export function useSeason(): Season | null {
  const { settings } = useAppSettings();
  const [season, setSeason] = useState<Season | null>(() => getSeason());

  useEffect(() => {
    const refresh = () => setSeason(getSeason());
    const timer = window.setInterval(refresh, RECHECK_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return settings.seasonalDecorations === false ? null : season;
}
