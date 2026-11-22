import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Coffee, Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react';
import { PageHeader } from '../../../shared/components/PageHeader';
import { M3Select } from '../../../shared/components/M3Select';
import { SegmentedControl } from '../../../shared/components/form';
import { DetailSection } from '../../../shared/components/detail/DetailKit';
import { BACK_PRIORITY, useBackButton } from '../../../shared/hooks/useBackButton';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { STUDY_LONG_BREAK_EVERY, STUDY_PRESETS, type StudyPresetId } from '../types';
import { phaseDurationMs, remainingNow, studyTimer, useStudyTimer } from '../state/studyTimerStore';
import { formatStudyMinutes, useStudyWeekStats } from '../hooks/useStudyStats';

const FALLBACK_COLOR = '#00639B';
const RING_SIZE = 260;
const RING_STROKE = 14;

const formatClock = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

interface StudyTimerScreenProps {
  /** Guarda lo estudiado al cortar una sesión (reiniciar o saltar a mitad). */
  onFocusInterrupted: (minutes: number, startedAt: string | null) => void;
}

/**
 * Modo estudio a pantalla completa: aro con el tiempo que queda (del color de la materia),
 * iniciar/pausar, reiniciar y saltar, el ritmo (25/5, 50/10, 15/3) y lo estudiado esta semana.
 * Cerrarla no detiene el temporizador: sigue y avisa al terminar.
 */
export const StudyTimerScreen: React.FC<StudyTimerScreenProps> = ({ onFocusInterrupted }) => {
  const timer = useStudyTimer();
  const { subjects } = useSubjects();
  const stats = useStudyWeekStats();
  const [now, setNow] = useState(() => Date.now());

  useBackButton(() => {
    studyTimer.close();
    return true;
  }, BACK_PRIORITY.MODAL);

  // Redibuja cada medio segundo mientras corre (el tiempo sale de la hora de fin, no de este reloj)
  useEffect(() => {
    if (!timer.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [timer.running]);

  const subject = subjects.find((s) => s.id === timer.subjectId);
  const color = subject?.color ?? FALLBACK_COLOR;
  const remaining = remainingNow(timer, timer.running ? now : undefined);
  const total = phaseDurationMs(timer.phase, timer.presetId, timer.focusCount);
  const progress = total > 0 ? 1 - remaining / total : 0;
  const isBreak = timer.phase === 'break';
  const isLongBreak = isBreak && timer.focusCount > 0 && timer.focusCount % STUDY_LONG_BREAK_EVERY === 0;
  const sessionStarted = timer.running || timer.focusStartedAt !== null;
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const doneInCycle = timer.focusCount % STUDY_LONG_BREAK_EVERY;

  const activeSubjects = subjects.filter((s) => !s.isArchived || s.id === timer.subjectId);
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? 'Sin materia';
  const maxMinutes = stats.bySubject[0]?.minutes ?? 1;

  const reset = () => {
    const { focusMinutes, startedAt } = studyTimer.reset();
    onFocusInterrupted(focusMinutes, startedAt);
  };
  const skip = () => {
    const { finished, focusMinutes, startedAt } = studyTimer.advance(false);
    if (finished === 'focus') onFocusInterrupted(focusMinutes, startedAt);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo estudio"
      className="m3-sheet-enter fixed inset-0 z-[70] overflow-y-auto bg-[var(--color-md-surface)] px-4 pb-10"
    >
      <div className="mx-auto w-full max-w-xl space-y-4">
        <PageHeader
          title="Modo estudio"
          subtitle={subject ? subject.name : 'Concentración por bloques'}
          onBack={() => studyTimer.close()}
          backLabel="Cerrar el modo estudio (el temporizador sigue)"
        />

        <M3Select<string>
          value={timer.subjectId ?? ''}
          onChange={(value) => studyTimer.setSubject(value || undefined)}
          label="Materia"
          placeholder="Sin materia"
          options={[
            { value: '', label: 'Sin materia' },
            ...activeSubjects.map((s) => ({
              value: s.id,
              label: s.name,
              sublabel: s.code,
              icon: <SubjectBadge icon={s.icon} color={s.color} size="sm" />,
            })),
          ]}
        />

        {/* Aro con el tiempo que queda */}
        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
            <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90" aria-hidden="true">
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={radius}
                fill="none"
                strokeWidth={RING_STROKE}
                className="stroke-[var(--color-md-surface-container-high)]"
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={radius}
                fill="none"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                stroke={isBreak ? '#2E7D32' : color}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, progress)))}
                style={{ transition: 'stroke-dashoffset 0.5s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  isBreak ? 'bg-[#C8E6C9] text-[#1B5E20]' : 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                }`}
              >
                {isBreak ? <Coffee className="h-3.5 w-3.5" aria-hidden="true" /> : <Timer className="h-3.5 w-3.5" aria-hidden="true" />}
                {isBreak ? (isLongBreak ? 'Descanso largo' : 'Descanso') : 'Concentración'}
              </span>
              <span className="font-mono text-6xl font-black tabular-nums text-[var(--color-md-on-surface)]" role="timer" aria-live="off">
                {formatClock(remaining)}
              </span>
              {/* Sesiones del ciclo: cada 4, descanso largo */}
              <span className="flex gap-1.5" aria-label={`${doneInCycle} de ${STUDY_LONG_BREAK_EVERY} sesiones antes del descanso largo`}>
                {Array.from({ length: STUDY_LONG_BREAK_EVERY }, (_, i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: i < doneInCycle ? color : 'var(--color-md-outline-variant)' }}
                  />
                ))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={reset}
              aria-label="Reiniciar"
              title="Reiniciar"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] transition-transform active:scale-95"
            >
              <RotateCcw className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => (timer.running ? studyTimer.pause() : studyTimer.start())}
              aria-label={timer.running ? 'Pausar' : sessionStarted ? 'Continuar' : 'Iniciar'}
              className="flex h-20 w-20 items-center justify-center rounded-[28px] text-white shadow-[0_6px_16px_rgba(0,0,0,0.25)] transition-transform active:scale-95"
              style={{ backgroundColor: isBreak ? '#2E7D32' : color }}
            >
              {timer.running ? <Pause className="h-9 w-9" aria-hidden="true" /> : <Play className="ml-1 h-9 w-9" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={skip}
              aria-label={isBreak ? 'Saltar el descanso' : 'Terminar esta sesión'}
              title={isBreak ? 'Saltar el descanso' : 'Terminar esta sesión'}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] transition-transform active:scale-95"
            >
              <SkipForward className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <p className="text-center text-xs text-[var(--color-md-on-surface-variant)]">
            {timer.running
              ? 'Puedes cerrar esta pantalla o salir de la app: te avisamos al terminar.'
              : isBreak
                ? 'Toca ▶ para empezar el descanso, o salta a la siguiente sesión.'
                : 'Toca ▶ para empezar. Cada 4 sesiones toca un descanso largo.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--color-md-on-surface)]">Ritmo (concentración / descanso, en minutos)</p>
          <SegmentedControl<StudyPresetId>
            value={timer.presetId}
            onChange={(value) => studyTimer.setPreset(value)}
            ariaLabel="Ritmo"
            options={Object.values(STUDY_PRESETS).map((preset) => ({ value: preset.id, label: preset.label }))}
          />
          {sessionStarted && (
            <p className="text-11px text-[var(--color-md-on-surface-variant)]">Para cambiar el ritmo, reinicia la sesión.</p>
          )}
        </div>

        <DetailSection
          icon={<BarChart3 className="h-4 w-4" />}
          title="Esta semana"
          trailing={<span className="text-sm font-black text-[var(--color-md-on-surface)]">{formatStudyMinutes(stats.totalMinutes)}</span>}
        >
          {stats.bySubject.length === 0 ? (
            <p className="text-xs text-[var(--color-md-on-surface-variant)]">Aún no estudiaste esta semana. ¡Empieza tu primera sesión!</p>
          ) : (
            <ul className="space-y-2.5">
              {stats.bySubject.slice(0, 6).map((row) => {
                const rowSubject = subjects.find((s) => s.id === row.subjectId);
                return (
                  <li key={row.subjectId || 'none'} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      {rowSubject ? (
                        <SubjectBadge icon={rowSubject.icon} color={rowSubject.color} size="sm" />
                      ) : (
                        <Timer className="h-4 w-4 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-semibold text-[var(--color-md-on-surface)]">{subjectName(row.subjectId)}</span>
                      <span className="text-xs font-bold text-[var(--color-md-on-surface-variant)]">{formatStudyMinutes(row.minutes)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-md-surface-container-high)]" aria-hidden="true">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(4, (row.minutes / maxMinutes) * 100)}%`, backgroundColor: rowSubject?.color ?? FALLBACK_COLOR }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DetailSection>
      </div>
    </div>,
    document.body
  );
};
