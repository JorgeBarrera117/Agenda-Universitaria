import React, { useEffect, useState } from 'react';
import { BarChart3, ChevronRight, Coffee, Pause, Play, RotateCcw, SkipForward, Timer, Volume2, VolumeX } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { SoundsSheet } from '../../settings/components/SoundsSheet';
import { M3Select } from '../../../shared/components/M3Select';
import { DetailSection } from '../../../shared/components/detail/DetailKit';
import { HEADER_SCRIM_CLASS } from '../../../shared/styles/surfaces';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { isLongBreakAfter } from '../types';
import { getStudyTimerState, remainingNow, studyTimer, useStudyTimer } from '../state/studyTimerStore';
import { StudyRhythmPanel } from './StudyRhythmPanel';
import { studyRepository } from '../repositories/studyRepository';
import { formatSessions, formatStudyMinutes, useStudyWeekStats } from '../hooks/useStudyStats';

/** Sin materia, el Estudio toma el color principal del tema que eligió el estudiante. */
const THEME_COLOR = 'var(--color-md-primary)';
const THEME_ON_COLOR = 'var(--color-md-on-primary)';
const BREAK_COLOR = '#2E7D32';
/** Un poco más chico que antes: la tarjeta entera (con el aviso) cabe en la pantalla del teléfono. */
const RING_SIZE = 236;
const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAY_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const RING_STROKE = 14;

const formatClock = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Guarda lo estudiado al cortar una sesión a mitad (reiniciar o terminarla antes). */
function saveInterrupted(minutes: number, startedAt: string | null): void {
  if (minutes < 1 || !startedAt) return;
  void studyRepository.add({ subjectId: getStudyTimerState().subjectId, startedAt, minutes });
}

interface StudyViewProps {
  isActive?: boolean;
}

/**
 * Pestaña Estudio (modo Pomodoro): aro con el tiempo que queda (del color de la materia),
 * iniciar/pausar, reiniciar y saltar, el ritmo (25/5, 50/10, 15/3) y lo estudiado esta semana.
 * Cambiar de pestaña o salir de la app no detiene el temporizador: StudyTimerHost avisa al terminar.
 */
export const StudyView: React.FC<StudyViewProps> = ({ isActive = true }) => {
  const timer = useStudyTimer();
  const { subjects } = useSubjects();
  const stats = useStudyWeekStats();
  const { settings, updateSettings } = useAppSettings();
  const [now, setNow] = useState(() => Date.now());
  const [soundsOpen, setSoundsOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const soundOn = settings.notificationSound;
  const maxDay = Math.max(1, ...stats.byDay);
  const todayIndex = (new Date(now).getDay() + 6) % 7;

  // Redibuja cada medio segundo mientras corre y la pestaña se ve (el tiempo sale de la hora de fin)
  useEffect(() => {
    if (!timer.running || !isActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [timer.running, isActive]);

  const subject = subjects.find((s) => s.id === timer.subjectId);
  const color = subject?.color ?? THEME_COLOR;
  // Texto sobre ese color: blanco sobre el de la materia; el «sobre primario» del tema si no hay materia
  const onColor = subject ? '#FFFFFF' : THEME_ON_COLOR;
  const remaining = remainingNow(timer, timer.running ? now : undefined);
  // Duración de la fase tal como empezó (un cambio de ritmo a mitad no hace saltar el aro)
  const total = timer.phaseTotalMs;
  const { config } = timer;
  const every = config.longBreakEvery;
  const progress = total > 0 ? 1 - remaining / total : 0;
  const isBreak = timer.phase === 'break';
  const isLongBreak = isBreak && isLongBreakAfter(timer.focusCount, every);
  const sessionStarted = timer.running || timer.focusStartedAt !== null;
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const doneInCycle = timer.focusCount % every;
  const ringColor = isBreak ? BREAK_COLOR : color;
  // Pausa terminada: esperando que empiece la siguiente sesión del ciclo
  const waitingNext = !isBreak && !timer.running && timer.focusCount > 0 && timer.focusStartedAt === null;
  // Ciclo: «cada N» sesiones con su pausa (la última, larga). Durante la pausa, focusCount ya
  // cuenta la sesión que acaba de terminar
  const cycleIndex = timer.focusCount % every;
  const sessionsDone = isBreak && cycleIndex === 0 ? every : cycleIndex;
  const cycleSteps = Array.from({ length: every }, (_, i) => ({
    i,
    isLast: i === every - 1,
    sessionDone: i < sessionsDone,
    sessionCurrent: !isBreak && i === cycleIndex,
    breakCurrent: isBreak && i === sessionsDone - 1,
    breakDone: i < (isBreak ? sessionsDone - 1 : cycleIndex),
  }));

  const activeSubjects = subjects.filter((s) => !s.isArchived || s.id === timer.subjectId);
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? 'Sin materia';
  const maxMinutes = stats.bySubject[0]?.minutes ?? 1;

  const reset = () => {
    const { focusMinutes, startedAt } = studyTimer.reset();
    saveInterrupted(focusMinutes, startedAt);
  };
  const skip = () => {
    const { finished, focusMinutes, startedAt } = studyTimer.advance(false);
    if (finished === 'focus') saveInterrupted(focusMinutes, startedAt);
  };

  return (
    <div className="glass-legible w-full space-y-3.5">
      {/* Cabecera, como las demás pestañas */}
      <div className={HEADER_SCRIM_CLASS}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-black tracking-tight text-[var(--color-md-on-surface)] sm:text-xl">Estudio</h2>
          {stats.totalMinutes > 0 && (
            <span className="rounded-full bg-[var(--color-md-secondary-container)] px-2 py-0.5 text-xs font-bold text-[var(--color-md-on-secondary-container)]">
              {formatStudyMinutes(stats.totalMinutes)} esta semana
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-md-on-surface-variant)] sm:text-13px">
          Estudia por bloques de concentración con descansos, y mira cuánto le dedicas a cada materia.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        {/* Temporizador */}
        <section
          className="md-card card-tinted space-y-3 rounded-3xl p-4 shadow-xs sm:p-6"
          style={{ '--card-tint': ringColor } as React.CSSProperties}
          aria-label="Temporizador"
        >
          <div className="flex items-end gap-2">
            <M3Select<string>
              value={timer.subjectId ?? ''}
              onChange={(value) => studyTimer.setSubject(value || undefined)}
              label="Materia"
              placeholder="Sin materia"
              className="min-w-0 flex-1"
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
            {/* Sonidos del Estudio sin salir a Ajustes (el ícono dice si el sonido está activo) */}
            <button
              type="button"
              onClick={() => setSoundsOpen(true)}
              aria-label={soundOn ? 'Sonidos del Estudio (activados)' : 'Sonidos del Estudio (en silencio)'}
              title="Sonidos del Estudio"
              className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] shadow-2xs transition-[transform,filter] duration-150 hover:brightness-95 active:scale-95"
            >
              {soundOn ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
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
                  stroke={ringColor}
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
                <span className="flex gap-1.5" aria-label={`${doneInCycle} de ${every} sesiones antes del descanso largo`}>
                  {Array.from({ length: every }, (_, i) => (
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
                className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-md-outline)]/60 bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] shadow-2xs transition-[transform,filter] duration-150 hover:brightness-95 active:scale-95"
              >
                <RotateCcw className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => (timer.running ? studyTimer.pause() : studyTimer.start())}
                aria-label={timer.running ? 'Pausar' : sessionStarted ? 'Continuar' : 'Iniciar'}
                className="flex h-20 w-20 items-center justify-center rounded-[28px] shadow-[0_6px_16px_rgba(0,0,0,0.25)] transition-transform active:scale-95"
                style={{ backgroundColor: ringColor, color: isBreak ? '#FFFFFF' : onColor }}
              >
                {timer.running ? <Pause className="h-9 w-9" aria-hidden="true" /> : <Play className="ml-1 h-9 w-9" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={skip}
                aria-label={isBreak ? 'Saltar el descanso' : 'Terminar esta sesión'}
                title={isBreak ? 'Saltar el descanso' : 'Terminar esta sesión'}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-md-outline)]/60 bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] shadow-2xs transition-[transform,filter] duration-150 hover:brightness-95 active:scale-95"
              >
                <SkipForward className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            {/* Pausa: mensaje grande con lo que queda para volver */}
            {isBreak && (
              <div className="flex w-full items-start gap-3 rounded-2xl bg-[#C8E6C9] px-3.5 py-2.5 text-[#1B5E20] dark:bg-[#1B5E20]/60 dark:text-[#C8E6C9]" role="status">
                <Coffee className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-base font-black">{isLongBreak ? '¡Descanso largo, te lo ganaste!' : '¡Hora de una pausa!'}</p>
                  <p className="text-sm">
                    Levántate, estírate y toma agua.{' '}
                    {timer.running ? (
                      <>
                        Vuelves a estudiar en <strong className="font-mono tabular-nums">{formatClock(remaining)}</strong>.
                      </>
                    ) : (
                      'Toca ▶ para empezar la pausa.'
                    )}
                  </p>
                </div>
              </div>
            )}
            {waitingNext && (
              <div className="flex w-full items-start gap-3 rounded-2xl bg-[var(--color-md-primary-container)] px-3.5 py-2.5 text-[var(--color-md-on-primary-container)]" role="status">
                <Timer className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-base font-black">¡Pausa terminada!</p>
                  <p className="text-sm">
                    Toca ▶ para empezar la sesión {cycleIndex + 1} de {every}.
                  </p>
                </div>
              </div>
            )}

            {/* Tu ciclo: sesiones y pausas (la cuarta pausa es larga) */}
            <div className="w-full space-y-1.5">
              <p className="text-11px font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">Tu ciclo</p>
              <ol className="flex items-stretch gap-1" aria-label="Sesiones y pausas del ciclo">
                {cycleSteps.map((step) => (
                  <React.Fragment key={step.i}>
                    <li
                      className={`flex h-9 flex-[5] items-center justify-center rounded-lg text-10px font-bold ${
                        step.sessionCurrent || step.sessionDone
                          ? ''
                          : 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)]'
                      } ${step.sessionCurrent ? 'ring-2 ring-[var(--color-md-on-surface)]/40' : ''}`}
                      style={step.sessionCurrent || step.sessionDone ? { backgroundColor: color, color: onColor, opacity: step.sessionCurrent ? 1 : 0.55 } : undefined}
                      aria-label={`Sesión ${step.i + 1}: ${config.focusMin} min${step.sessionCurrent ? ', ahora' : step.sessionDone ? ', hecha' : ''}`}
                    >
                      {config.focusMin}′
                    </li>
                    <li
                      className={`flex h-9 items-center justify-center rounded-lg ${step.isLast ? 'flex-[3]' : 'flex-[2]'} ${
                        step.breakCurrent
                          ? 'bg-[#2E7D32] text-white ring-2 ring-[var(--color-md-on-surface)]/40'
                          : step.breakDone
                            ? 'bg-[#2E7D32]/55 text-white'
                            : 'bg-[#C8E6C9]/70 text-[#1B5E20] dark:bg-[#1B5E20]/40 dark:text-[#C8E6C9]'
                      }`}
                      aria-label={`${step.isLast ? 'Pausa larga' : 'Pausa'}: ${step.isLast ? config.longBreakMin : config.shortBreakMin} min${
                        step.breakCurrent ? ', ahora' : step.breakDone ? ', hecha' : ''
                      }`}
                    >
                      <Coffee className="h-3 w-3" aria-hidden="true" />
                    </li>
                  </React.Fragment>
                ))}
              </ol>
              <p className="text-11px text-[var(--color-md-on-surface-variant)]">
                {config.focusMin} min de estudio y {config.shortBreakMin} de pausa; cada {every} sesiones, una pausa larga de {config.longBreakMin} min.
              </p>
            </div>

            <p className="text-center text-xs text-[var(--color-md-on-surface-variant)]">
              {timer.running
                ? 'Puedes cambiar de pestaña o salir de la app: te avisamos al terminar.'
                : isBreak
                  ? 'Toca ▶ para empezar el descanso, o salta a la siguiente sesión.'
                  : `Toca ▶ para empezar. Cada ${every} sesiones toca un descanso largo.`}
            </p>
          </div>
        </section>

        <div className="space-y-3.5">
          <StudyRhythmPanel />

          <DetailSection
            icon={<BarChart3 className="h-4 w-4" />}
            title="Esta semana"
            trailing={
              <button
                type="button"
                onClick={() => setWeekOpen(true)}
                aria-label={`Ver el desglose de la semana: ${formatStudyMinutes(stats.totalMinutes)}`}
                className="-mr-1 inline-flex h-9 items-center gap-1 rounded-full pl-3 pr-2 text-sm font-black text-[var(--color-md-on-surface)] transition-[background-color,transform] duration-150 hover:bg-[var(--color-md-on-surface)]/[0.06] active:scale-95"
              >
                {formatStudyMinutes(stats.totalMinutes)}
                <ChevronRight className="h-4 w-4 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
              </button>
            }
          >
            {stats.bySubject.length === 0 ? (
              <p className="text-xs text-[var(--color-md-on-surface-variant)]">Aún no estudiaste esta semana. ¡Empieza tu primera sesión!</p>
            ) : (
              <ul className="space-y-2.5">
                {stats.bySubject.slice(0, 8).map((row) => {
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
                        <span className="shrink-0 text-xs font-bold text-[var(--color-md-on-surface-variant)]">
                          {formatStudyMinutes(row.minutes)} · {formatSessions(row.sessions)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-md-surface-container-high)]" aria-hidden="true">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(4, (row.minutes / maxMinutes) * 100)}%`, backgroundColor: rowSubject?.color ?? THEME_COLOR }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {stats.totalMinutes > 0 && (
              <button
                type="button"
                onClick={() => setWeekOpen(true)}
                className="mt-1 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-md-secondary-container)] text-xs font-bold text-[var(--color-md-on-secondary-container)] transition-[filter,transform] duration-150 hover:brightness-95 active:scale-[0.98]"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Ver la semana día por día
              </button>
            )}
          </DetailSection>
        </div>
      </div>

      <SoundsSheet isOpen={soundsOpen} onClose={() => setSoundsOpen(false)} settings={settings} onUpdate={updateSettings} />

      <Modal isOpen={weekOpen} onClose={() => setWeekOpen(false)} title="Tu semana de estudio" maxWidth="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-md-on-surface-variant)]">
            {formatStudyMinutes(stats.totalMinutes)} en {formatSessions(stats.sessions)}, de lunes a hoy.
          </p>
          {/* Minutos por día: barra más alta el día que más estudiaste */}
          <ol className="flex h-36 items-end gap-2" aria-label="Minutos por día">
            {stats.byDay.map((minutes, i) => (
              <li key={WEEKDAY_LONG[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-10px font-bold tabular-nums text-[var(--color-md-on-surface-variant)]">{minutes > 0 ? minutes : ''}</span>
                <span
                  className="w-full rounded-t-lg"
                  style={{
                    height: `${Math.max(minutes > 0 ? 6 : 2, (minutes / maxDay) * 100)}%`,
                    backgroundColor: minutes > 0 ? THEME_COLOR : 'var(--color-md-outline-variant)',
                    opacity: i > todayIndex ? 0.35 : 1,
                  }}
                  aria-label={`${WEEKDAY_LONG[i]}: ${formatStudyMinutes(minutes)}`}
                />
                <span className={`text-xs font-bold ${i === todayIndex ? 'text-[var(--color-md-primary)]' : 'text-[var(--color-md-on-surface-variant)]'}`}>
                  {WEEKDAY_SHORT[i]}
                </span>
              </li>
            ))}
          </ol>
          {stats.bySubject.length > 0 && (
            <ul className="divide-y divide-[var(--color-md-outline-variant)]/60">
              {stats.bySubject.map((row) => {
                const rowSubject = subjects.find((s) => s.id === row.subjectId);
                const share = stats.totalMinutes > 0 ? Math.round((row.minutes / stats.totalMinutes) * 100) : 0;
                return (
                  <li key={row.subjectId || 'none'} className="flex items-center gap-2.5 py-2.5 text-sm">
                    {rowSubject ? (
                      <SubjectBadge icon={rowSubject.icon} color={rowSubject.color} size="sm" />
                    ) : (
                      <Timer className="h-4 w-4 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[var(--color-md-on-surface)]">{subjectName(row.subjectId)}</span>
                      <span className="block text-xs text-[var(--color-md-on-surface-variant)]">
                        {formatStudyMinutes(row.minutes)} · {formatSessions(row.sessions)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-black tabular-nums text-[var(--color-md-on-surface)]">{share}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
};
