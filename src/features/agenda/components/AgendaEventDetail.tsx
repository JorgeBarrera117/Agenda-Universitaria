import React, { useCallback } from 'react';
import {
  Bell,
  BellOff,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Edit2,
  MapPin,
  Share2,
  StickyNote,
  Trash2,
  Undo2,
} from 'lucide-react';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { PAGE_HEADER_ICON_BUTTON, PAGE_HEADER_PRIMARY_BUTTON, PageHeader } from '../../../shared/components/PageHeader';
import { BACK_PRIORITY, useBackButton } from '../../../shared/hooks/useBackButton';
import { MOTION_EXIT_MS, useExitTransition } from '../../../shared/hooks/useExitTransition';
import { formatClockTime } from '../../../shared/utils/timeFormat';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import type { Subject } from '../../subjects/types';
import type { TimeFormat } from '../../settings/types';
import { AGENDA_LEAD_LABEL, AGENDA_TYPE_LABEL, type AgendaEvent } from '../types';
import { longDayLabel, relativeDayLabel } from '../utils/agendaDates';
import { AGENDA_STATUS_CLASS, agendaStatus } from '../utils/agendaStatus';
import { agendaEventColor } from './agendaVisuals';
import { AgendaTypeIcon } from './AgendaTypeIcon';

interface AgendaEventDetailProps {
  event: AgendaEvent;
  subjects: readonly Subject[];
  todayKey: string;
  timeFormat: TimeFormat | undefined;
  notificationsEnabled: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
  onShare: () => void;
  onOpenSubject?: (subjectId: string) => void;
}

const SECTION_CLASS =
  'md-card rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-4 shadow-xs sm:p-5';

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5">
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]"
      aria-hidden="true"
    >
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">{label}</span>
      <span className="block break-words text-sm text-[var(--color-md-on-surface)]">{value}</span>
    </span>
  </div>
);

/**
 * Ficha de un evento de la agenda a pantalla completa (como las de materia y catedrático): estado,
 * fecha, hora, lugar, materia, aviso y notas, con Editar, Marcar como hecha, Compartir y Eliminar.
 */
export const AgendaEventDetail: React.FC<AgendaEventDetailProps> = ({
  event,
  subjects,
  todayKey,
  timeFormat,
  notificationsEnabled,
  onBack,
  onEdit,
  onDelete,
  onToggleDone,
  onShare,
  onOpenSubject,
}) => {
  const { isClosing, runExit } = useExitTransition(MOTION_EXIT_MS.sheet);
  const exit = useCallback(() => runExit(onBack), [runExit, onBack]);
  useBackButton(() => {
    exit();
    return true;
  }, BACK_PRIORITY.SUBVIEW);

  const subject = event.subjectId ? subjects.find((s) => s.id === event.subjectId) : undefined;
  const color = agendaEventColor(event, subjects);
  const status = agendaStatus(event, todayKey);
  const isTask = event.type === 'task';
  const isHoliday = event.type === 'holiday';
  const multiDay = isHoliday && event.endDate && event.endDate > event.date;

  const dateValue = multiDay
    ? `Del ${longDayLabel(event.date).toLowerCase()} al ${longDayLabel(event.endDate as string).toLowerCase()}`
    : `${longDayLabel(event.date)} · ${relativeDayLabel(event.date, todayKey)}`;

  return (
    <div className={`${isClosing ? 'm3-sheet-exit' : 'm3-sheet-enter'} mx-auto w-full max-w-3xl space-y-3 pb-10`}>
      <PageHeader
        title={AGENDA_TYPE_LABEL[event.type]}
        subtitle="Agenda"
        onBack={exit}
        backLabel="Volver a la agenda"
        actions={
          <>
            <button type="button" onClick={onShare} aria-label="Compartir" title="Compartir" className={PAGE_HEADER_ICON_BUTTON}>
              <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button type="button" onClick={onEdit} className={`ml-1 ${PAGE_HEADER_PRIMARY_BUTTON}`}>
              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Editar</span>
            </button>
            <M3KebabMenu
              ariaLabel="Más opciones"
              items={[
                ...(isTask
                  ? [
                      {
                        id: 'toggle',
                        label: event.done ? 'Marcar como pendiente' : 'Marcar como hecha',
                        icon: event.done ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5 text-[var(--color-md-primary)]" />,
                        onClick: onToggleDone,
                      },
                    ]
                  : []),
                {
                  id: 'delete',
                  label: 'Eliminar',
                  icon: <Trash2 className="h-3.5 w-3.5" />,
                  variant: 'destructive' as const,
                  onClick: onDelete,
                },
              ]}
            />
          </>
        }
      />

      {/* Identidad: tipo, título y estado, con el color de su materia */}
      <section
        className="card-tinted md-card rounded-3xl p-4 shadow-xs sm:p-5"
        style={{ '--card-tint': color } as React.CSSProperties}
        aria-labelledby="agenda-detail-title"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-xs" style={{ backgroundColor: color }} aria-hidden="true">
            <AgendaTypeIcon type={event.type} className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
              {AGENDA_TYPE_LABEL[event.type]} · {isHoliday ? 'Sin avisos de clase' : subject?.name ?? 'Personal'}
            </p>
            <h2
              id="agenda-detail-title"
              className={`mt-0.5 break-words text-xl font-black leading-tight sm:text-2xl ${
                event.done ? 'text-[var(--color-md-on-surface-variant)] line-through' : 'text-[var(--color-md-on-surface)]'
              }`}
            >
              {event.title}
            </h2>
            <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${AGENDA_STATUS_CLASS[status.tone]}`}>{status.label}</span>
          </div>
        </div>
        {isTask && (
          <button
            type="button"
            onClick={onToggleDone}
            className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-transform active:scale-[0.98] ${
              event.done
                ? 'border border-[var(--color-md-outline)] text-[var(--color-md-on-surface)]'
                : 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
            }`}
          >
            {event.done ? <Undo2 className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {event.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
          </button>
        )}
      </section>

      {/* Datos */}
      <section className={`${SECTION_CLASS} divide-y divide-[var(--color-md-outline-variant)]/60`}>
        <InfoRow icon={<CalendarDays className="h-[18px] w-[18px]" />} label={multiDay ? 'Días' : 'Fecha'} value={dateValue} />
        {!isHoliday && (
          <InfoRow
            icon={<Clock className="h-[18px] w-[18px]" />}
            label="Hora"
            value={event.time ? formatClockTime(event.time, timeFormat) : 'Sin hora'}
          />
        )}
        {event.place && <InfoRow icon={<MapPin className="h-[18px] w-[18px]" />} label="Lugar" value={event.place} />}
        {!isHoliday && (
          <InfoRow
            icon={event.remind === 'none' ? <BellOff className="h-[18px] w-[18px]" /> : <Bell className="h-[18px] w-[18px]" />}
            label="Aviso"
            value={
              event.remind === 'none'
                ? 'Sin aviso'
                : `${AGENDA_LEAD_LABEL[event.remind]}${event.time ? '' : ' (desde las 08:00)'}${
                    notificationsEnabled ? '' : ' · las notificaciones están apagadas en Ajustes'
                  }`
            }
          />
        )}
        {isHoliday && (
          <InfoRow icon={<BellOff className="h-[18px] w-[18px]" />} label="Clases" value="Esos días la app no te avisa de tus clases." />
        )}
      </section>

      {subject && (
        <button
          type="button"
          onClick={() => onOpenSubject?.(subject.id)}
          disabled={!onOpenSubject}
          className={`${SECTION_CLASS} flex w-full items-center gap-3 text-left transition-transform active:scale-[0.99]`}
        >
          <SubjectBadge icon={subject.icon} color={subject.color} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">Materia</span>
            <span className="block truncate text-base font-bold text-[var(--color-md-on-surface)]">{subject.name}</span>
            {subject.code && <span className="block text-xs text-[var(--color-md-on-surface-variant)]">{subject.code}</span>}
          </span>
          {onOpenSubject && <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />}
        </button>
      )}

      {event.notes && (
        <section className={SECTION_CLASS}>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
            <StickyNote className="h-4 w-4 text-[var(--color-md-primary)]" aria-hidden="true" />
            Notas
          </h3>
          <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-md-on-surface)]">{event.notes}</p>
        </section>
      )}
    </div>
  );
};
