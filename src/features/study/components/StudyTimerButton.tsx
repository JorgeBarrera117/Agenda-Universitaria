import React, { useEffect, useState } from 'react';
import { Coffee, Timer } from 'lucide-react';
import { remainingNow, studyTimer, useStudyTimer } from '../state/studyTimerStore';

interface StudyTimerButtonProps {
  /** Materia que se propone al abrir (si no hay una sesión en marcha). */
  subjectId?: string;
  className?: string;
}

const clock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Acceso al modo estudio. Con el temporizador en marcha muestra el tiempo que queda, así se ve
 * desde la agenda aunque la pantalla del temporizador esté cerrada.
 */
export const StudyTimerButton: React.FC<StudyTimerButtonProps> = ({ subjectId, className = '' }) => {
  const timer = useStudyTimer();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!timer.running) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [timer.running]);

  const active = timer.running || timer.focusStartedAt !== null;
  const isBreak = timer.phase === 'break';

  return (
    <button
      type="button"
      onClick={() => studyTimer.open(subjectId)}
      aria-label={active ? `Modo estudio: quedan ${clock(remainingNow(timer))}` : 'Abrir el modo estudio'}
      className={`flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-xs transition-transform active:scale-[0.98] ${
        active
          ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
          : 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]'
      } ${className}`}
    >
      {isBreak && active ? <Coffee className="h-4 w-4" aria-hidden="true" /> : <Timer className="h-4 w-4" aria-hidden="true" />}
      <span className={active ? 'font-mono tabular-nums' : ''}>{active ? clock(remainingNow(timer)) : 'Estudiar'}</span>
    </button>
  );
};
