import React, { useMemo } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AgendaEvent } from '../types';
import { MONTHS_LONG, eventCoversDay, longDayLabel, monthGrid } from '../utils/agendaDates';

interface MonthCalendarProps {
  year: number;
  month: number;
  todayKey: string;
  selectedKey: string | null;
  events: readonly AgendaEvent[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onChangeMonth: (delta: number) => void;
  onGoToday: () => void;
  onSelectDay: (key: string) => void;
}

const WEEKDAY_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

type DotTone = 'pending' | 'overdue' | 'done';

/** Punto bajo el número: primario si hay algo pendiente, rojo si está vencido, tenue si ya pasó. */
const DOT_CLASS: Record<DotTone, string> = {
  pending: 'bg-[var(--color-md-primary)]',
  overdue: 'bg-[#BA1A1A] dark:bg-[#FFB4AB]',
  done: 'bg-[var(--color-md-outline)] opacity-45',
};

/** Botón de icono circular tonal (40×40) para cambiar de mes. */
const NAV_BUTTON_CLASS =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-on-surface)]/[0.06] text-[var(--color-md-on-surface)] transition-[background-color,transform] duration-150 hover:bg-[var(--color-md-on-surface)]/[0.12] active:scale-95';

/**
 * Calendario del mes (empieza en lunes). Bajo cada número, hasta 3 puntos según el estado de lo
 * que hay ese día (pendiente, vencido o hecho); los días libres van en rojo. Hoy lleva un anillo y
 * el día elegido, relleno sólido. Plegable: plegado deja más espacio a la lista.
 */
export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  year,
  month,
  todayKey,
  selectedKey,
  events,
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
      const items = dayEvents.filter((event) => event.type !== 'holiday');
      const toneOf = (event: AgendaEvent): DotTone => {
        if (event.type === 'task' && !event.done && event.date < todayKey) return 'overdue';
        if (event.done || (event.type !== 'task' && (event.endDate ?? event.date) < todayKey)) return 'done';
        return 'pending';
      };
      // Primero lo vencido, luego lo pendiente: con más de 3 cosas, se ve lo importante
      const order: Record<DotTone, number> = { overdue: 0, pending: 1, done: 2 };
      const dots = items
        .map((event) => ({ id: event.id, tone: toneOf(event) }))
        .sort((a, b) => order[a.tone] - order[b.tone])
        .slice(0, 3);
      const hasOverdue = dots.some((dot) => dot.tone === 'overdue');
      return { ...cell, isHoliday, dots, hasOverdue, pending: items.length };
    });
  }, [year, month, events, todayKey]);

  const title = `${MONTHS_LONG[month]} ${year}`;

  return (
    <section className="md-card rounded-[24px] border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5">
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
            {/* «Hoy» como píldora tonal; las flechas, botones de icono circulares tonales */}
            <button
              type="button"
              onClick={onGoToday}
              className="h-9 shrink-0 rounded-full bg-[var(--color-md-secondary-container)] px-3.5 text-xs font-bold text-[var(--color-md-on-secondary-container)] transition-[filter,transform] duration-150 hover:brightness-[0.97] active:scale-95"
            >
              Hoy
            </button>
            <button type="button" onClick={() => onChangeMonth(-1)} aria-label="Mes anterior" className={NAV_BUTTON_CLASS}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => onChangeMonth(1)} aria-label="Mes siguiente" className={NAV_BUTTON_CLASS}>
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
              }${cell.hasOverdue ? ', con algo vencido' : ''}`;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => onSelectDay(cell.key)}
                  aria-label={label}
                  aria-pressed={isSelected}
                  className="flex h-12 flex-col items-center gap-0.5 rounded-xl pt-0.5 transition-[background-color,transform] duration-150 hover:bg-[var(--color-md-on-surface)]/5 active:scale-95"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-13px ${numberClass}`}>{cell.day}</span>
                  <span className="flex h-1.5 items-center gap-[3px]" aria-hidden="true">
                    {cell.dots.map((dot) => (
                      <span key={dot.id} className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[dot.tone]}`} />
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
