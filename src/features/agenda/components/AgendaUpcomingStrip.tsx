import React, { useMemo } from 'react';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { useAgenda } from '../hooks/useAgenda';
import { useTodayKey } from '../hooks/useTodayKey';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { AGENDA_TYPE_LABEL } from '../types';
import { relativeDayLabel } from '../utils/agendaDates';
import { agendaEventColor } from './agendaVisuals';

interface AgendaUpcomingStripProps {
  onOpenDay: (day: string) => void;
  onOpenAgenda: () => void;
}

const MAX_ITEMS = 3;

/**
 * "Próximos en tu agenda" en Horario: lo urgente sin abrir la Agenda (tareas vencidas primero y
 * luego lo que viene). Tocar un elemento abre la Agenda en ese día.
 */
export const AgendaUpcomingStrip: React.FC<AgendaUpcomingStripProps> = ({ onOpenDay, onOpenAgenda }) => {
  const { events } = useAgenda();
  const { subjects } = useSubjects();
  const todayKey = useTodayKey();

  const items = useMemo(() => {
    const overdue = events.filter((e) => e.type === 'task' && !e.done && e.date < todayKey);
    const coming = events.filter((e) => !e.done && (e.endDate ?? e.date) >= todayKey && !(e.type === 'task' && e.date < todayKey));
    return [...overdue, ...coming].slice(0, MAX_ITEMS);
  }, [events, todayKey]);

  return (
    <section className="md-card rounded-[24px] border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] px-3.5 pb-1.5 pt-3">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-4.5 w-4.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
        <h3 className="min-w-0 flex-1 text-sm font-bold text-[var(--color-md-on-surface)]">Próximos en tu agenda</h3>
        <button
          type="button"
          onClick={onOpenAgenda}
          className="h-9 shrink-0 rounded-full px-3 text-13px font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10"
        >
          Ver agenda
        </button>
      </div>
      {items.length === 0 ? (
        <p className="py-2.5 text-13px text-[var(--color-md-on-surface-variant)]">
          Nada pendiente. Anota tareas, exámenes o recordatorios en la Agenda y te avisamos a tiempo.
        </p>
      ) : (
        <ul className="mt-1">
          {items.map((event) => {
            const overdue = event.type === 'task' && event.date < todayKey;
            return (
              <li key={event.id} className="border-t border-[var(--color-md-outline-variant)]/60 first:border-t-0">
                <button
                  type="button"
                  onClick={() => onOpenDay(event.date < todayKey ? todayKey : event.date)}
                  className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors hover:bg-[var(--color-md-on-surface)]/5"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: agendaEventColor(event, subjects) }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{event.title}</span>
                    <span
                      className={`block text-xs ${overdue ? 'font-bold text-[#BA1A1A] dark:text-[#FFB4AB]' : 'text-[var(--color-md-on-surface-variant)]'}`}
                    >
                      {AGENDA_TYPE_LABEL[event.type]} · {overdue ? 'Vencida · ' : ''}
                      {relativeDayLabel(event.date, todayKey)}
                      {event.time ? ` · ${event.time}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
