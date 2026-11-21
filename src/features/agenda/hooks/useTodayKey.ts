import { useEffect, useState } from 'react';
import { toDateKey } from '../utils/agendaDates';

/**
 * Fecha de hoy ("YYYY-MM-DD") que se actualiza sola al pasar la medianoche, así "Hoy", "Mañana" y
 * "Vencidas" no se quedan desfasados si la app sigue abierta. Se lee en un estado (no en el render).
 */
export function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const check = () => setTodayKey(toDateKey(new Date()));
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return todayKey;
}
