import React, { useId, useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, Clock, Coffee, FileEdit, FolderOpen, Laptop, MapPin, UserRound } from 'lucide-react';
import { Button } from '../../../shared/components/atoms';
import type { Subject } from '../../subjects/types';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { useTimeFormatter } from '../../settings/hooks/useTimeFormatter';
import { DAY_NAMES } from '../types';
import type { CampusPulse, NextClassPulse, PulseClass } from '../hooks/useCampusPulse';
import { formatDuration } from '../utils/duration';

interface CampusPulseBentoProps {
  pulse: CampusPulse;
  onTakeNote?: (subjectId: string) => void;
  onOpenFiles?: (subject: Subject) => void;
}

const COLLAPSED_STORAGE_KEY = 'agenda_campus_pulse_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function nextClassWhen(next: NextClassPulse, formatTime: (time: string) => string): string {
  if (next.daysAhead === 0) return `Empieza en ${formatDuration(next.minutesUntilStart)}`;
  if (next.daysAhead === 1) return `Mañana ${formatTime(next.slot.startTime)}`;
  return `${DAY_NAMES[next.dayOfWeek]} ${formatTime(next.slot.startTime)}`;
}

/** Hora, lugar y docente como texto con íconos sutiles: son datos, no botones. */
function ClassDetails({ info }: { info: PulseClass }) {
  const formatter = useTimeFormatter();
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
      <li className="inline-flex items-center gap-1 tabular-nums">
        <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
        {formatter.range(info.slot.startTime, info.slot.endTime)}
      </li>
      {(info.isVirtual || info.location) && (
        <li className="inline-flex min-w-0 items-center gap-1">
          {info.isVirtual ? (
            <Laptop className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          ) : (
            <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          )}
          <span className="max-w-[200px] truncate">
            {info.isVirtual ? `Virtual${info.location ? ` · ${info.location}` : ''}` : info.location}
          </span>
        </li>
      )}
      {info.professor && (
        <li className="inline-flex min-w-0 items-center gap-1">
          <UserRound className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          <span className="max-w-[180px] truncate">{info.professor.name}</span>
        </li>
      )}
    </ul>
  );
}

/** Ícono de la materia (con su color), nombre y código en texto (sin cápsula). */
function SubjectTitle({ info }: { info: PulseClass }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <SubjectBadge icon={info.subject?.icon} color={info.subject?.color} size="md" />
      <div className="min-w-0">
        <h3 className="truncate text-base font-bold leading-tight tracking-tight">{info.subject?.name || 'Clase universitaria'}</h3>
        {info.subject?.code && (
          <p className="truncate font-mono text-11px font-medium opacity-75">
            <span className="sr-only">Código: </span>
            {info.subject.code}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Resumen de la jornada: una sola tarjeta compacta y plegable. Arriba, en una línea, cómo va el
 * día (libre, hora libre, en curso o completado, con su avance); debajo, destacada, la clase en
 * curso o la próxima con su acción. Antes eran tres bloques apilados que repetían lo mismo.
 */
export const CampusPulseBento: React.FC<CampusPulseBentoProps> = ({ pulse, onTakeNote, onOpenFiles }) => {
  const formatter = useTimeFormatter();
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const contentId = useId();
  const { currentClass, nextClass, daySummary, isDayFinished, todayDayOfWeek } = pulse;

  // Sin ninguna clase en la semana no hay nada que resumir: el horario muestra su estado vacío.
  if (!currentClass && !nextClass && daySummary.totalToday === 0) return null;

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Preferencia solo visual: si el almacenamiento no está disponible se ignora.
      }
      return next;
    });
  };

  const { totalToday, completedToday, virtualToday } = daySummary;
  const virtualNote = virtualToday > 0 ? ` · ${plural(virtualToday, 'virtual', 'virtuales')}` : '';

  // Una sola línea con el estado del día (reemplaza «Sin clases hoy» + «Tu jornada: Día libre»)
  const status: { icon: React.ReactNode; text: string } = currentClass
    ? {
        icon: (
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-md-primary)] opacity-60 motion-safe:animate-ping" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--color-md-primary)]" />
          </span>
        ),
        text: `Clase en curso · ${completedToday} de ${totalToday} completadas${virtualNote}`,
      }
    : totalToday === 0
      ? {
          icon: <Coffee className="h-4 w-4" aria-hidden="true" />,
          text: `${DAY_NAMES[todayDayOfWeek]} libre · Sin clases hoy`,
        }
      : isDayFinished
        ? {
            icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
            text: `Jornada completada · ${plural(totalToday, 'clase', 'clases')}`,
          }
        : {
            icon: <Coffee className="h-4 w-4" aria-hidden="true" />,
            text: `Hora libre · ${completedToday} de ${plural(totalToday, 'clase', 'clases')} hoy${virtualNote}`,
          };

  const collapsedSummary = currentClass
    ? `${currentClass.subject?.name || 'Clase'} · faltan ${formatDuration(currentClass.minutesRemaining)}`
    : nextClass
      ? `Próxima: ${nextClass.subject?.name || 'Clase'} · ${nextClassWhen(nextClass, formatter.time)}`
      : null;

  return (
    <section
      aria-label="Resumen de la jornada"
      className="md-card rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-2 text-[var(--color-md-on-surface)] shadow-2xs sm:rounded-3xl sm:p-2.5"
    >
      {/* Línea de estado + plegar/desplegar */}
      <div className="flex items-center gap-2 pl-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--color-md-primary)]">{status.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-13px font-bold">{status.text}</p>
          {isCollapsed && collapsedSummary && (
            <p className="truncate text-11px font-medium text-[var(--color-md-on-surface-variant)]">{collapsedSummary}</p>
          )}
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          aria-label={isCollapsed ? 'Mostrar resumen de la jornada' : 'Ocultar resumen de la jornada'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--color-md-on-surface)]/[0.06] active:scale-95"
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`} aria-hidden="true" />
        </button>
      </div>

      {/* Avance del día: un segmento por clase */}
      {totalToday > 0 && (
        <div className="flex gap-1 px-2 pb-1.5 pt-0.5" aria-hidden="true">
          {Array.from({ length: totalToday }, (_unused, index) => {
            const isDone = index < completedToday;
            const isNow = !isDone && currentClass !== null && index === completedToday;
            return (
              <span
                key={index}
                className={`h-1 flex-1 rounded-full ${
                  isDone
                    ? 'bg-[var(--color-md-primary)]'
                    : isNow
                      ? 'bg-[var(--color-md-primary)] opacity-50 motion-safe:animate-pulse'
                      : 'bg-[var(--color-md-outline-variant)]'
                }`}
              />
            );
          })}
        </div>
      )}

      {!isCollapsed && (currentClass || nextClass) && (
        <div
          id={contentId}
          className="mt-1 flex min-w-0 flex-col gap-3 rounded-xl bg-[var(--color-md-primary-container)] p-3 text-[var(--color-md-on-primary-container)] sm:rounded-2xl sm:p-3.5"
        >
          {currentClass ? (
            <>
              <div className="min-w-0 space-y-2">
                <p className="text-11px font-bold uppercase tracking-wider opacity-80">En curso ahora</p>
                <SubjectTitle info={currentClass} />
                <ClassDetails info={currentClass} />
              </div>
              <div className="space-y-2">
                <div
                  role="progressbar"
                  aria-label="Progreso de la clase"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={currentClass.progressPercent}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-md-card-bg)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--color-md-primary)] transition-[width] duration-700 ease-out"
                    style={{ width: `${currentClass.progressPercent}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {currentClass.progressPercent}% · faltan {formatDuration(currentClass.minutesRemaining)}
                  </span>
                  {onTakeNote && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onTakeNote(currentClass.slot.subjectId)}
                      icon={<FileEdit className="h-4 w-4" />}
                      aria-label={`Tomar apunte de ${currentClass.subject?.name || 'la clase en curso'}`}
                      className="min-h-10"
                    >
                      Tomar apunte
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : nextClass ? (
            <>
              <div className="min-w-0 space-y-2">
                <p className="text-11px font-bold uppercase tracking-wider opacity-80">Próxima clase</p>
                <SubjectTitle info={nextClass} />
                <ClassDetails info={nextClass} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  {nextClassWhen(nextClass, formatter.time)}
                </span>
                {onOpenFiles && nextClass.subject && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => nextClass.subject && onOpenFiles(nextClass.subject)}
                    icon={<FolderOpen className="h-4 w-4" />}
                    aria-label={`Ver archivos de ${nextClass.subject.name}`}
                    className="min-h-10"
                  >
                    Ver archivos
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
};
