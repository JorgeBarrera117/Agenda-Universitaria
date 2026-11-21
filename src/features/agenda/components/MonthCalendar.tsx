import React, { useMemo } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AgendaEvent } from '../types';
import type { Subject } from '../../subjects/types';
import { MONTHS_LONG, eventCoversDay, longDayLabel, monthGrid } from '../utils/agendaDates';
import { agendaEventColor } from './agendaVisuals';

interface MonthCalendarProps {
  year: number;
  month: number;
  todayKey: string;
  selectedKey: string | null;
  events: readonly AgendaEvent[];
  subjects: readonly Subject[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onChangeMonth: (delta: number) => void;
  onGoToday: () => void;
  onSelectDay: (key: string) => void;
}

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/**
 * Calendario del mes (empieza en lunes) con puntitos del color de cada materia en los días que
 * tienen algo; los días libres van en rojo. Plegable: plegado deja más espacio a la lista.
 */
export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  year,
  month,
  todayKey,
  selectedKey,
  events,
  subjects,
  isOpen,
  onToggleOpen,
  onChangeMonth,
  onGoToday,
  onSelectDay,
}) => {
  const cells = useMemo(() => {
    const grid = monthGrid(year, month);
    return grid.map((cell) => {
      const dayEvents = events.filter((event) => eventCoversDay(event, cell.key));
      const isHoliday = dayEvents.some((event) => event.type === 'holiday');
      const dots = dayEvents
        .filter((event) => event.type !== 'holiday')
        .slice(0, 3)
        .map((event) => ({ id: event.id, color: agendaEventColor(event, subjects), faded: Boolean(event.done) }));
      return { ...cell, isHoliday, dots, pending: dayEvents.filter((e) => e.type !== 'holiday').length };
    });
  }, [year, month, events, subjects]);

  const title = `${MONTHS_LONG[month]} ${year}`;

  return (
    <section className="md-card rounded-[24px] border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-2.5 sm:p-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-2xl px-1.5 text-left transition-colors hover:bg-[var(--color-md-on-surface)]/5"
        >
          <CalendarDays className="hidden h-5 w-5 shrink-0 text-[var(--color-md-primary)] min-[400px]:block" aria-hidden="true" />
          <span className="truncate text-base font-bold text-[var(--color-md-on-surface)]">{title}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
          <span className="sr-only">{isOpen ? 'Ocultar calendario' : 'Mostrar calendario'}</span>
        </button>
        {isOpen && (
          <>
            <button
              type="button"
              onClick={onGoToday}
              className="h-9 shrink-0 rounded-full border border-[var(--color-md-outline-variant)] px-2.5 text-xs font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => onChangeMonth(-1)}
              aria-label="Mes anterior"
              className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-on-surface)]/5"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onChangeMonth(1)}
              aria-label="Mes siguiente"
              className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-on-surface)]/5"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {isOpen && (
        <>
          <div className="mt-1 grid grid-cols-7" aria-hidden="true">
            {WEEKDAY_HEADERS.map((label, index) => (
              <span key={WEEKDAY_NAMES[index]} className="py-1 text-center text-xs font-bold text-[var(--color-md-on-surface-variant)]">
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7" role="group" aria-label={title}>
            {cells.map((cell) => {
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedKey;
              const numberClass = isSelected
                ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] font-bold'
                : isToday
                  ? 'text-[var(--color-md-primary)] font-bold ring-[1.5px] ring-inset ring-[var(--color-md-primary)]'
                  : cell.isHoliday
                    ? 'text-[#BA1A1A] dark:text-[#FFB4AB] font-bold'
                    : cell.inMonth
                      ? 'text-[var(--color-md-on-surface)]'
                      : 'text-[var(--color-md-on-surface-variant)] opacity-45';
              const label = `${longDayLabel(cell.key)}${cell.isHoliday ? ', día libre' : ''}${
                cell.pending ? `, ${cell.pending} en la agenda` : ''
              }`;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => onSelectDay(cell.key)}
                  aria-label={label}
                  aria-pressed={isSelected}
                  className="flex h-12 flex-col items-center gap-0.5 rounded-xl pt-0.5 transition-colors hover:bg-[var(--color-md-on-surface)]/5"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-13px ${numberClass}`}>{cell.day}</span>
                  <span className="flex h-1.5 items-center gap-[3px]" aria-hidden="true">
                    {cell.dots.map((dot) => (
                      <span
                        key={dot.id}
                        className={`h-1.5 w-1.5 rounded-full ${dot.faded ? 'opacity-35' : ''}`}
                        style={{ backgroundColor: dot.color }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
