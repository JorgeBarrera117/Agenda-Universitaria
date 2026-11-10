import React, { useId, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  FileEdit,
  FolderOpen,
  Laptop,
  MapPin,
  UserRound,
} from 'lucide-react';
import { Button } from '../../../shared/components/atoms';
import type { Subject } from '../../subjects/types';
import { DAY_NAMES } from '../types';
import type { CampusPulse, NextClassPulse, PulseClass } from '../hooks/useCampusPulse';

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

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 1) return 'menos de 1 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function nextClassWhen(next: NextClassPulse): string {
  if (next.daysAhead === 0) return `Empieza en ${formatDuration(next.minutesUntilStart)}`;
  if (next.daysAhead === 1) return `Mañana a las ${next.slot.startTime}`;
  return `${DAY_NAMES[next.dayOfWeek]} a las ${next.slot.startTime}`;
}

function ClassDetails({ info }: { info: PulseClass }) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
      <li className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-md-card-bg)] px-2 py-0.5 font-mono">
        <Clock className="h-3 w-3" aria-hidden="true" />
        {info.slot.startTime} - {info.slot.endTime}
      </li>
      {(info.isVirtual || info.location) && (
        <li className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-[var(--color-md-card-bg)] px-2 py-0.5">
          {info.isVirtual ? (
            <Laptop className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate max-w-[180px]">
            {info.isVirtual ? `Virtual${info.location ? ` · ${info.location}` : ''}` : info.location}
          </span>
        </li>
      )}
      {info.professor && (
        <li className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-[var(--color-md-card-bg)] px-2 py-0.5">
          <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-[160px]">{info.professor.name}</span>
        </li>
      )}
    </ul>
  );
}

function SubjectTitle({ info }: { info: PulseClass }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <h3 className="truncate text-base font-bold tracking-tight sm:text-lg">
        {info.subject?.name || 'Clase universitaria'}
      </h3>
      {info.subject?.code && (
        <span className="shrink-0 rounded-md bg-[var(--color-md-on-surface)] px-2 py-0.5 font-mono text-[10px] font-black tracking-wider text-[var(--color-md-surface)]">
          {info.subject.code}
        </span>
      )}
    </div>
  );
}

/**
 * "Campus Pulse": encabezado tipo Bento del horario que muestra en tiempo real la clase en curso
 * (con progreso), la próxima clase y el resumen de la jornada. Se puede plegar a una sola línea.
 */
export const CampusPulseBento: React.FC<CampusPulseBentoProps> = ({ pulse, onTakeNote, onOpenFiles }) => {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const contentId = useId();
  const { currentClass, nextClass, daySummary, isDayFinished } = pulse;

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

  const status = currentClass
    ? { label: 'Clase en curso', icon: <span className="h-2 w-2 rounded-full bg-[var(--color-md-primary)]" /> }
    : isDayFinished
      ? { label: 'Jornada completada', icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> }
      : daySummary.totalToday === 0
        ? { label: 'Sin clases hoy', icon: <Coffee className="h-3.5 w-3.5" aria-hidden="true" /> }
        : { label: 'Hora libre', icon: <Coffee className="h-3.5 w-3.5" aria-hidden="true" /> };

  const collapsedSummary = currentClass
    ? `${currentClass.subject?.name || 'Clase'} · faltan ${formatDuration(currentClass.minutesRemaining)}`
    : nextClass
      ? `Próxima: ${nextClass.subject?.name || 'Clase'} · ${nextClassWhen(nextClass).toLowerCase()}`
      : '¡Jornada de hoy completada!';

  const dayPill = [
    daySummary.totalToday > 0 ? `${plural(daySummary.totalToday, 'clase', 'clases')} hoy` : 'Sin clases hoy',
    daySummary.hasVirtual ? plural(daySummary.virtualToday, 'virtual', 'virtuales') : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <section
      aria-label="Resumen de la jornada"
      className="rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-2 shadow-2xs sm:rounded-3xl sm:p-2.5"
    >
      {/* Cabecera: estado + píldora del día + plegar/desplegar */}
      <div className="flex items-center gap-2 px-1.5 pb-1">
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--color-md-primary-container)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-md-on-primary-container)]">
          {currentClass ? (
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-md-primary)] opacity-60 motion-safe:animate-ping" />
              {status.icon}
            </span>
          ) : (
            status.icon
          )}
          {status.label}
        </span>
        {isCollapsed && (
          <span className="truncate text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">
            {collapsedSummary}
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          aria-label={isCollapsed ? 'Mostrar resumen de la jornada' : 'Ocultar resumen de la jornada'}
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-all duration-150 ease-out hover:bg-[var(--color-md-surface-container-high)] active:scale-[0.98]"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {!isCollapsed && (
        <div id={contentId} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {/* Tarjeta principal: clase en curso o próxima clase */}
          <div className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl bg-[var(--color-md-primary-container)] p-3.5 text-[var(--color-md-on-primary-container)] sm:col-span-2 sm:p-4">
            {currentClass ? (
              <>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">En curso ahora</p>
                  <SubjectTitle info={currentClass} />
                  <ClassDetails info={currentClass} />
                </div>

                <div className="space-y-1.5">
                  <div
                    role="progressbar"
                    aria-label="Progreso de la clase"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={currentClass.progressPercent}
                    className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-md-card-bg)]"
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
                      >
                        Tomar Apunte
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : nextClass ? (
              <>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                    {nextClass.daysAhead === 0 ? 'Próxima clase hoy' : 'Próxima clase'}
                  </p>
                  <SubjectTitle info={nextClass} />
                  <ClassDetails info={nextClass} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    {nextClassWhen(nextClass)}
                  </span>
                  {onOpenFiles && nextClass.subject && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => nextClass.subject && onOpenFiles(nextClass.subject)}
                      icon={<FolderOpen className="h-4 w-4" />}
                      aria-label={`Ver archivos de ${nextClass.subject.name}`}
                    >
                      Ver Archivos
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 shrink-0" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-bold">¡Jornada de hoy completada!</h3>
                  <p className="text-xs opacity-80">Aprovecha para repasar tus apuntes del día.</p>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta secundaria: resumen de la jornada (fila compacta en móvil, columna en escritorio) */}
          <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] p-3.5 text-[var(--color-md-on-surface)] sm:flex-col sm:items-stretch sm:justify-between sm:gap-2">
            <div className="shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-md-on-surface-variant)]">
                Tu jornada
              </p>
              {daySummary.totalToday === 0 ? (
                <p className="mt-0.5 text-xl font-black leading-tight">Día libre</p>
              ) : (
                <>
                  <p className="mt-0.5 text-2xl font-black leading-none">
                    {daySummary.completedToday}
                    <span className="text-base font-bold text-[var(--color-md-on-surface-variant)]">
                      {' '}/ {daySummary.totalToday}
                    </span>
                  </p>
                  <p className="text-xs font-medium text-[var(--color-md-on-surface-variant)]">
                    clases completadas
                  </p>
                </>
              )}
            </div>

            {daySummary.totalToday > 0 && (
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex gap-1" aria-hidden="true">
                  {Array.from({ length: daySummary.totalToday }, (_unused, index) => {
                    const isDone = index < daySummary.completedToday;
                    const isNow = !isDone && currentClass !== null && index === daySummary.completedToday;
                    return (
                      <span
                        key={index}
                        className={`h-1.5 flex-1 rounded-full ${
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

                <span className="self-start rounded-full bg-[var(--color-md-secondary-container)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-md-on-secondary-container)]">
                  {dayPill}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
