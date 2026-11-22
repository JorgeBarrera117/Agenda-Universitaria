import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck, Check, ChevronRight } from 'lucide-react';
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
/** Tiempo que se ve el check antes de que la tarea salga de la lista. */
const COMPLETE_FEEDBACK_MS = 350;
/** Rojo de error M3 (claro / oscuro), el mismo que usa la Agenda para lo vencido. */
const ERROR_TEXT = 'text-[#BA1A1A] dark:text-[#FFB4AB]';

/**
 * "Próximos en tu agenda" en Horario: lo urgente sin abrir la Agenda (tareas vencidas primero y
 * luego lo que viene). Las tareas se pueden completar aquí mismo con su casilla; tocar el resto
 * de la fila abre la Agenda en ese día.
 */
export const AgendaUpcomingStrip: React.FC<AgendaUpcomingStripProps> = ({ onOpenDay, onOpenAgenda }) => {
  const { events, setDone } = useAgenda();
  const { subjects } = useSubjects();
  const todayKey = useTodayKey();
  const [completing, setCompleting] = useState<ReadonlySet<string>>(() => new Set());

  const items = useMemo(() => {
    const overdue = events.filter((e) => e.type === 'task' && !e.done && e.date < todayKey);
    const coming = events.filter((e) => !e.done && (e.endDate ?? e.date) >= todayKey && !(e.type === 'task' && e.date < todayKey));
    return [...overdue, ...coming].slice(0, MAX_ITEMS);
  }, [events, todayKey]);

  // Marca la tarea como hecha: primero se ve el check y enseguida se guarda (sale de la lista)
  const complete = (id: string) => {
    if (completing.has(id)) return;
    setCompleting((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      void setDone(id, true).finally(() =>
        setCompleting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        })
      );
    }, COMPLETE_FEEDBACK_MS);
  };

  return (
    <section className="md-card rounded-[24px] border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] px-3.5 pb-1.5 pt-3">
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-4.5 w-4.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
        <h3 className="min-w-0 flex-1 text-sm font-bold text-[var(--color-md-on-surface)]">Próximos en tu agenda</h3>
        {/* Botón tonal (no un enlace suelto): misma jerarquía que el resto de acciones */}
        <button
          type="button"
          onClick={onOpenAgenda}
          className="group inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[var(--color-md-secondary-container)] pl-3.5 pr-3 text-xs font-bold text-[var(--color-md-on-secondary-container)] transition-[filter,transform,box-shadow] duration-150 ease-out hover:shadow-2xs hover:brightness-[0.97] active:scale-95"
        >
          Ver agenda
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
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
            const isTask = event.type === 'task';
            const isCompleting = completing.has(event.id);
            return (
              <li key={event.id} className="flex items-center gap-1 border-t border-[var(--color-md-outline-variant)]/60 first:border-t-0">
                {/* Tareas: casilla táctil de 40 px para completarla sin abrir la Agenda */}
                {isTask ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isCompleting}
                    aria-label={`Marcar «${event.title}» como completada`}
                    onClick={() => complete(event.id)}
                    className="-ml-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--color-md-on-surface)]/[0.06] active:scale-90"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors duration-150 ${
                        isCompleting
                          ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                          : overdue
                            ? 'border-[#BA1A1A] dark:border-[#FFB4AB]'
                            : 'border-[var(--color-md-outline)]'
                      }`}
                    >
                      {isCompleting && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </span>
                  </button>
                ) : (
                  <span className="flex h-10 w-7 shrink-0 items-center justify-center" aria-hidden="true">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: agendaEventColor(event, subjects) }} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenDay(event.date < todayKey ? todayKey : event.date)}
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-2 text-left transition-colors hover:bg-[var(--color-md-on-surface)]/5 active:bg-[var(--color-md-on-surface)]/[0.08]"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-bold text-[var(--color-md-on-surface)] ${
                        isCompleting ? 'line-through opacity-60' : ''
                      }`}
                    >
                      {event.title}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-md-on-surface-variant)]">
                      {/* Estado vencido: etiqueta en rojo de error, además del borde rojo de la casilla */}
                      {overdue && (
                        <span className={`shrink-0 rounded bg-[#BA1A1A]/10 px-1 py-px text-10px font-bold uppercase tracking-wide dark:bg-[#FFB4AB]/15 ${ERROR_TEXT}`}>
                          Vencida
                        </span>
                      )}
                      <span className={`truncate ${overdue ? `font-semibold ${ERROR_TEXT}` : ''}`}>
                        {AGENDA_TYPE_LABEL[event.type]} · {relativeDayLabel(event.date, todayKey)}
                        {event.time ? ` · ${event.time}` : ''}
                      </span>
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
