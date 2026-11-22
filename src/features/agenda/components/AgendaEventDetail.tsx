import React from 'react';
import { Bell, BellOff, CalendarDays, Check, Clock, Edit2, Info, MapPin, Share2, StickyNote, Trash2, Undo2 } from 'lucide-react';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { PAGE_HEADER_PRIMARY_BUTTON } from '../../../shared/components/PageHeader';
import {
  DetailAction,
  DetailActions,
  DetailHero,
  DetailIconTile,
  DetailRow,
  DetailRows,
  DetailScreen,
  DetailSection,
} from '../../../shared/components/detail/DetailKit';
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

const ROW_ICON = 'h-[18px] w-[18px]';

/**
 * Ficha de un evento de la agenda (mismo patrón que materia, catedrático y archivo): identidad con
 * el color de su materia y su estado; en las tareas, «Marcar como hecha» es la acción principal.
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
    <DetailScreen
      title={AGENDA_TYPE_LABEL[event.type]}
      subtitle="Agenda"
      onBack={onBack}
      backLabel="Volver a la agenda"
      actions={
        <>
          <button type="button" onClick={onEdit} className={PAGE_HEADER_PRIMARY_BUTTON}>
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Editar</span>
          </button>
          <M3KebabMenu
            ariaLabel="Más opciones"
            items={[
              {
                id: 'share',
                label: 'Compartir',
                icon: <Share2 className="h-3.5 w-3.5 text-[var(--color-md-primary)]" />,
                onClick: onShare,
              },
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
    >
      <DetailHero
        color={color}
        titleId="agenda-detail-title"
        leading={
          <DetailIconTile color={color}>
            <AgendaTypeIcon type={event.type} className="h-7 w-7" />
          </DetailIconTile>
        }
        kicker={`${AGENDA_TYPE_LABEL[event.type]} · ${isHoliday ? 'Sin avisos de clase' : subject?.name ?? 'Personal'}`}
        title={event.title}
        strike={event.done}
        chips={<span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${AGENDA_STATUS_CLASS[status.tone]}`}>{status.label}</span>}
        actions={
          <DetailActions>
            {isTask && (
              <DetailAction
                variant={event.done ? 'outlined' : 'primary'}
                icon={event.done ? <Undo2 className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                label={event.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
                onClick={onToggleDone}
              />
            )}
            {/* En las tareas, «Marcar como hecha» va sola a todo el ancho; Compartir queda en ⋮ */}
            {!isTask && <DetailAction icon={<Share2 className="h-4 w-4" aria-hidden="true" />} label="Compartir" onClick={onShare} />}
          </DetailActions>
        }
      />

      <DetailSection icon={<Info className="h-4 w-4" />} title="Cuándo y dónde">
        <DetailRows>
          <DetailRow icon={<CalendarDays className={ROW_ICON} />} label={multiDay ? 'Días' : 'Fecha'} value={dateValue} />
          {!isHoliday && (
            <DetailRow
              icon={<Clock className={ROW_ICON} />}
              label="Hora"
              value={event.time ? formatClockTime(event.time, timeFormat) : 'Sin hora'}
            />
          )}
          {event.place && <DetailRow icon={<MapPin className={ROW_ICON} />} label="Lugar" value={event.place} />}
          {!isHoliday && (
            <DetailRow
              icon={event.remind === 'none' ? <BellOff className={ROW_ICON} /> : <Bell className={ROW_ICON} />}
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
          {isHoliday && <DetailRow icon={<BellOff className={ROW_ICON} />} label="Clases" value="Esos días la app no te avisa de tus clases." />}
          {subject && (
            <DetailRow
              icon={null}
              leading={<SubjectBadge icon={subject.icon} color={subject.color} size="md" />}
              label="Materia"
              value={
                <>
                  <span className="font-bold">{subject.name}</span>
                  {subject.code && <span className="whitespace-nowrap text-[var(--color-md-on-surface-variant)]"> · {subject.code}</span>}
                </>
              }
              onClick={onOpenSubject ? () => onOpenSubject(subject.id) : undefined}
            />
          )}
        </DetailRows>
      </DetailSection>

      {event.notes && (
        <DetailSection icon={<StickyNote className="h-4 w-4" />} title="Notas">
          <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-md-on-surface)]">{event.notes}</p>
        </DetailSection>
      )}
    </DetailScreen>
  );
};
