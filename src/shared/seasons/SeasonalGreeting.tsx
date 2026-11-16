import React, { useEffect, useState } from 'react';
import { Flame, PartyPopper, TreePine, X } from 'lucide-react';
import { useSeason } from './useSeason';
import { seasonGreeting } from './seasonService';

const DISMISS_KEY = 'agenda_season_greeting_hidden_on';

function todayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function isHiddenToday(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayKey();
  } catch {
    return false;
  }
}

/**
 * Saludo de temporada en el inicio, con la cuenta atrás a Navidad y a Año Nuevo.
 * Cerrarlo lo oculta solo por hoy: al día siguiente vuelve con la cuenta actualizada.
 */
export const SeasonalGreeting: React.FC = () => {
  const season = useSeason();
  const [hidden, setHidden] = useState(isHiddenToday);
  const [now, setNow] = useState(() => new Date());

  // La vista de inicio puede quedar montada varios días: la cuenta atrás se actualiza cada hora
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
      setHidden(isHiddenToday());
    }, 60 * 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!season || hidden) return null;

  const greeting = seasonGreeting(season, now);
  // 31 de diciembre: la fogata del año viejo; en enero, la fiesta; en Navidad, el árbol
  const Icon = season === 'christmas' ? TreePine : now.getMonth() === 11 ? Flame : PartyPopper;

  const hideForToday = () => {
    try {
      localStorage.setItem(DISMISS_KEY, todayKey());
    } catch {
      // Sin almacenamiento solo se oculta hasta recargar
    }
    setHidden(true);
  };

  return (
    <section
      aria-label="Saludo de temporada"
      className="flex items-center gap-3 rounded-3xl bg-[var(--color-md-primary-container)] py-2.5 pl-3 pr-1.5 text-[var(--color-md-on-primary-container)] shadow-2xs"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug">{greeting.title}</p>
        <p className="text-xs leading-snug opacity-90">{greeting.message}</p>
      </div>
      <button
        type="button"
        onClick={hideForToday}
        aria-label="Ocultar el saludo por hoy"
        title="Ocultar por hoy"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-md-on-primary-container)]/[0.08]"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </section>
  );
};
