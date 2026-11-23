import React, { memo } from 'react';
import { Check, Edit2, ListChecks, MapPin, Repeat, Trash2 } from 'lucide-react';
import { Card } from '../../../shared/components/atoms';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { ABOVE_STRETCHED_CLASS, STRETCHED_CARD_BUTTON_CLASS } from '../../../shared/styles/surfaces';
import type { Subject } from '../../subjects/types';
import { AGENDA_LEAD_LABEL, AGENDA_TYPE_LABEL, type AgendaEvent } from '../types';
import { longDayLabel, relativeDayLabel } from '../utils/agendaDates';
import { agendaEventColor } from './agendaVisuals';
import { AGENDA_STATUS_CLASS, agendaStatus } from '../utils/agendaStatus';
import { AgendaTypeIcon } from './AgendaTypeIcon';

interface AgendaEventCardProps {
  event: AgendaEvent;
  subjects: readonly Subject[];
  todayKey: string;
  /** Tocar la tarjeta abre su ficha. */
  onOpen: (event: AgendaEvent) => void;
  onEdit: (event: AgendaEvent) => void;
  onDelete: (event: AgendaEvent) => void;
  onToggleDone: (event: AgendaEvent) => void;
}

/**
 * Tarjeta de un evento: el color de su materia (variante tonal, como en Materias), ícono del tipo,
 * cuándo y, en las tareas, la casilla para marcarla como hecha. Tocarla abre la edición.
 */
const AgendaEventCardComponent: React.FC<AgendaEventCardProps> = ({ event, subjects, todayKey, onOpen, onEdit, onDelete, onToggleDone }) => {
  const subject = event.subjectId ? subjects.find((s) => s.id === event.subjectId) : undefined;
  const color = agendaEventColor(event, subjects);
  const isTask = event.type === 'task';
  const overdue = isTask && !event.done && event.date < todayKey;
  const status = agendaStatus(event, todayKey);
  // El estado se marca solo cuando no es obvio por el grupo: hecha, vencida o ya pasó
  const showStatus = status.tone === 'done' || status.tone === 'danger' || status.tone === 'past';

  const range =
    event.type === 'holiday' && event.endDate && event.endDate > event.date
      ? `${relativeDayLabel(event.date, todayKey)} – ${relativeDayLabel(event.endDate, todayKey)}`
      : relativeDayLabel(event.date, todayKey);
  const when = `${range}${event.time ? ` · ${event.time}` : ''}`;
  const kicker = `${AGENDA_TYPE_LABEL[event.type]} · ${
    event.type === 'holiday' ? 'Sin avisos de clase' : subject?.name ?? 'Personal'
  }`;

  return (
    <Card padding="compact" interactive tint={color} className={`flex items-start gap-3 ${event.done ? 'opacity-70' : ''}`}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-2xs"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        <AgendaTypeIcon type={event.type} />
      </div>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-11px font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">{kicker}</p>
        <h3
          className={`text-sm font-bold leading-snug sm:text-15px ${
            event.done ? 'text-[var(--color-md-on-surface-variant)] line-through' : 'text-[var(--color-md-on-surface)]'
          }`}
        >
          {/* Toda la tarjeta abre su ficha (ver, editar, marcar, compartir, eliminar) */}
          <button type="button" onClick={() => onOpen(event)} className={STRETCHED_CARD_BUTTON_CLASS}>
            {event.title}
            <span className="sr-only"> · {longDayLabel(event.date)} · {status.label} · ver ficha</span>
          </button>
        </h3>
        {(showStatus || (event.checklist?.length ?? 0) > 0 || event.seriesId) && (
          <span className="flex flex-wrap items-center gap-1">
            {showStatus && (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-11px font-bold ${AGENDA_STATUS_CLASS[status.tone]}`}>{status.label}</span>
            )}
            {event.checklist && event.checklist.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-0.5 text-11px font-bold text-[var(--color-md-on-surface-variant)] dark:bg-black/20">
                <ListChecks className="h-3 w-3" aria-hidden="true" />
                {event.checklist.filter((item) => item.done).length}/{event.checklist.length}
              </span>
            )}
            {event.seriesId && (
              <span className="inline-flex items-center rounded-full bg-white/60 px-1.5 py-0.5 text-[var(--color-md-on-surface-variant)] dark:bg-black/20" title="Se repite">
                <Repeat className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Se repite</span>
              </span>
            )}
          </span>
        )}
        <p
          className={`text-xs ${
            overdue ? 'font-bold text-[#BA1A1A] dark:text-[#FFB4AB]' : 'text-[var(--color-md-on-surface-variant)]'
          }`}
        >
          {when}
          {event.remind !== 'none' && !event.done && event.type !== 'holiday' && event.date >= todayKey && (
            <span className="text-[var(--color-md-on-surface-variant)]"> · aviso {AGENDA_LEAD_LABEL[event.remind].toLowerCase()}</span>
          )}
        </p>
        {event.place && (
          <p className="flex items-center gap-1 text-xs text-[var(--color-md-on-surface-variant)]">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.place}</span>
          </p>
        )}
      </div>

      <div className={`-mr-1 -mt-0.5 flex shrink-0 items-center gap-0.5 ${ABOVE_STRETCHED_CLASS}`}>
        {isTask && (
          <button
            type="button"
            onClick={() => onToggleDone(event)}
            aria-pressed={Boolean(event.done)}
            aria-label={event.done ? `Marcar «${event.title}» como pendiente` : `Marcar «${event.title}» como hecha`}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-[background-color,transform] duration-150 hover:bg-[var(--color-md-on-surface)]/5 active:scale-90"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                event.done
                  ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                  : 'border-[var(--color-md-on-surface-variant)] text-transparent'
              }`}
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
            </span>
          </button>
        )}
        <M3KebabMenu
          size="md"
          ariaLabel={`Opciones de «${event.title}»`}
          items={[
            {
              id: 'edit',
              label: 'Editar',
              icon: <Edit2 className="h-3.5 w-3.5 text-[var(--color-md-primary)]" />,
              onClick: () => onEdit(event),
            },
            {
              id: 'delete',
              label: 'Eliminar',
              icon: <Trash2 className="h-3.5 w-3.5" />,
              variant: 'destructive',
              onClick: () => onDelete(event),
            },
          ]}
        />
      </div>
    </Card>
  );
};

export const AgendaEventCard = memo(AgendaEventCardComponent);
