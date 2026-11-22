import React from 'react';
import {
  Archive,
  Award,
  CalendarDays,
  Clock,
  Edit2,
  FolderOpen,
  GraduationCap,
  Laptop,
  MapPin,
  NotebookPen,
  Pencil,
  Plus,
  Share2,
  Timer,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { PAGE_HEADER_PRIMARY_BUTTON } from '../../../shared/components/PageHeader';
import {
  DetailAction,
  DetailActions,
  DetailChip,
  DetailHero,
  DetailIconTile,
  DetailRow,
  DetailScreen,
  DetailSection,
} from '../../../shared/components/detail/DetailKit';
import { studyTimer } from '../../study/state/studyTimerStore';
import { formatStudyMinutes, useStudyWeekStats } from '../../study/hooks/useStudyStats';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import type { Professor } from '../../professors/types';
import { DAY_NAMES, type ScheduleSlot } from '../../schedule/types';
import { describeSlotLocation, isSlotVirtual } from '../../schedule/utils/slotModality';
import type { Subject } from '../types';
import { SubjectIcon } from './SubjectIcon';
import { useTimeFormatter } from '../../settings/hooks/useTimeFormatter';

interface SubjectDetailViewProps {
  subject: Subject;
  professor?: Professor;
  /** Clases de esta materia (la vista las ordena por día y hora). */
  slots: ScheduleSlot[];
  noteCount: number;
  docCount: number;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShareAgclass: () => void;
  onNavigateToNotes: (subjectId: string) => void;
  onNavigateToDocs: (subject: Subject) => void;
  onSelectProfessor?: (professor: Professor) => void;
  /** Editar una clase del horario (abre el formulario de esa clase). */
  onEditSlot?: (slot: ScheduleSlot) => void;
  /** Agregar clases de esta materia al horario (con la materia ya elegida). */
  onAddSlot?: () => void;
  /** Quitar una clase del horario (el padre pide confirmación). */
  onDeleteSlot?: (slot: ScheduleSlot) => void;
}

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** "4 h", "1 h 30 min", "45 min". */
function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/**
 * Ficha técnica de una asignatura a pantalla completa (consulta): datos, horario semanal,
 * catedrático y accesos a sus apuntes y archivos. Editar abre el formulario de siempre; el botón
 * atrás de Android (o el gesto) vuelve al catálogo.
 */
export const SubjectDetailView: React.FC<SubjectDetailViewProps> = ({
  subject,
  professor,
  slots,
  noteCount,
  docCount,
  onBack,
  onEdit,
  onDelete,
  onShareAgclass,
  onNavigateToNotes,
  onNavigateToDocs,
  onSelectProfessor,
  onEditSlot,
  onAddSlot,
  onDeleteSlot,
}) => {
  const timeFormatter = useTimeFormatter();
  const sortedSlots = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  const weeklyMinutes = sortedSlots.reduce((sum, slot) => sum + Math.max(0, minutesOf(slot.endTime) - minutesOf(slot.startTime)), 0);
  const hasCredits = subject.credits !== undefined && subject.credits > 0;
  const studyStats = useStudyWeekStats();
  const studiedThisWeek = studyStats.bySubject.find((row) => row.subjectId === subject.id)?.minutes ?? 0;

  return (
    <DetailScreen
      title="Asignatura"
      subtitle={subject.isArchived ? 'Archivada' : 'Materias'}
      onBack={onBack}
      backLabel="Volver a materias"
      actions={
        <>
          <button type="button" onClick={onEdit} className={PAGE_HEADER_PRIMARY_BUTTON}>
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Editar</span>
          </button>
          <M3KebabMenu
            ariaLabel="Más opciones de la asignatura"
            items={[
              {
                id: 'share',
                label: 'Compartir materia',
                icon: <Share2 className="h-3.5 w-3.5 text-[var(--color-md-primary)]" />,
                onClick: onShareAgclass,
              },
              {
                id: 'delete',
                label: 'Eliminar asignatura',
                icon: <Trash2 className="h-3.5 w-3.5" />,
                variant: 'destructive' as const,
                onClick: onDelete,
              },
            ]}
          />
        </>
      }
    >
      {/* Identidad con su color; lo que más se hace desde aquí es ir a sus apuntes y archivos */}
      <DetailHero
        color={subject.color}
        titleId="subject-detail-name"
        leading={
          <DetailIconTile color={subject.color}>
            <SubjectIcon icon={subject.icon} className="h-8 w-8 text-white" />
          </DetailIconTile>
        }
        kicker={professor ? professor.name : 'Asignatura'}
        title={subject.name}
        chips={
          <>
            {subject.isArchived && (
              <DetailChip tone="tonal" icon={<Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}>
                Archivada{subject.semester ? ` · ${subject.semester}` : ''}
              </DetailChip>
            )}
            {subject.code && (
              <DetailChip tone="mono">
                <span className="sr-only">Código: </span>
                {subject.code}
              </DetailChip>
            )}
            {hasCredits && (
              <DetailChip tone="tonal" icon={<Award className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}>
                {subject.credits} {subject.credits === 1 ? 'crédito' : 'créditos'}
              </DetailChip>
            )}
            {studiedThisWeek > 0 && (
              <DetailChip tone="tonal" icon={<Timer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}>
                {formatStudyMinutes(studiedThisWeek)} esta semana
              </DetailChip>
            )}
            {subject.classroomDefault && (
              <DetailChip icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />}>
                <span className="sr-only">Aula habitual: </span>
                {subject.classroomDefault}
              </DetailChip>
            )}
          </>
        }
        actions={
          <DetailActions>
            <DetailAction
              variant="primary"
              icon={<NotebookPen className="h-4 w-4" aria-hidden="true" />}
              label={`Apuntes (${noteCount})`}
              ariaLabel={`Apuntes de la materia: ${noteCount}`}
              onClick={() => onNavigateToNotes(subject.id)}
            />
            <DetailAction
              icon={<FolderOpen className="h-4 w-4" aria-hidden="true" />}
              label={`Archivos (${docCount})`}
              ariaLabel={`Archivos de la materia: ${docCount}`}
              onClick={() => onNavigateToDocs(subject)}
            />
            <DetailAction
              icon={<Timer className="h-4 w-4" aria-hidden="true" />}
              label="Estudiar"
              ariaLabel={`Estudiar ${subject.name} con el modo estudio`}
              onClick={() => studyTimer.open(subject.id)}
            />
          </DetailActions>
        }
      />

      {/* Horario semanal */}
      <DetailSection
        icon={<CalendarDays className="h-4 w-4" />}
        title="Horario semanal"
        trailing={
          <span className="flex items-center gap-1">
            {sortedSlots.length > 0 && (
              <span className="text-11px font-semibold text-[var(--color-md-on-surface-variant)]">
                {sortedSlots.length} {sortedSlots.length === 1 ? 'clase' : 'clases'} · {formatDuration(weeklyMinutes)}/sem
              </span>
            )}
            {onAddSlot && sortedSlots.length > 0 && (
              <button
                type="button"
                onClick={onAddSlot}
                aria-label="Agregar clases de esta materia"
                title="Agregar clases de esta materia"
                className="-my-2 -mr-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </span>
        }
      >
        {sortedSlots.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-md-on-surface-variant)]">
              Esta materia todavía no tiene clases en el horario.
            </p>
            {onAddSlot && (
              <button
                type="button"
                onClick={onAddSlot}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--color-md-secondary-container)] px-4 text-sm font-medium text-[var(--color-md-on-secondary-container)] transition-colors hover:brightness-95"
              >
                <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
                Programar clases
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-md-outline-variant)]">
            {sortedSlots.map((slot) => {
              const virtual = isSlotVirtual(slot);
              const location = describeSlotLocation(slot);
              return (
                <li key={slot.id} className="-mx-2 flex items-center gap-1 py-1 first:pt-0 last:pb-0">
                  {/* Fila de lista M3: tocarla abre la edición de esa clase; el menú ⋮, editar o eliminar */}
                  <button
                    type="button"
                    onClick={() => onEditSlot?.(slot)}
                    disabled={!onEditSlot}
                    aria-label={`Editar la clase del ${DAY_NAMES[slot.dayOfWeek].toLowerCase()}, ${timeFormatter.range(slot.startTime, slot.endTime, ' a ')}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-[var(--color-md-surface-container)] disabled:pointer-events-none"
                  >
                  <span className="w-20 shrink-0 text-sm font-bold text-[var(--color-md-on-surface)]">{DAY_NAMES[slot.dayOfWeek]}</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-md-primary-container)] px-2 py-0.5 font-mono text-11px font-bold text-[var(--color-md-on-primary-container)]">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {timeFormatter.range(slot.startTime, slot.endTime)}
                    </span>
                    <p className="flex min-w-0 items-center gap-1 text-xs text-[var(--color-md-on-surface-variant)]">
                      {virtual ? (
                        <Laptop className="h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                      )}
                      <span className="truncate">
                        {virtual ? `Virtual${location ? ` · ${location}` : ''}` : (location ?? 'Presencial · sin aula indicada')}
                      </span>
                    </p>
                  </div>
                  {onEditSlot && !onDeleteSlot && (
                    <Pencil className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
                  )}
                  </button>
                  {onDeleteSlot && (
                    <M3KebabMenu
                      size="sm"
                      ariaLabel={`Opciones de la clase del ${DAY_NAMES[slot.dayOfWeek].toLowerCase()}`}
                      items={[
                        ...(onEditSlot
                          ? [
                              {
                                id: 'edit',
                                label: 'Editar clase',
                                icon: <Pencil className="h-3.5 w-3.5 text-[var(--color-md-primary)]" />,
                                onClick: () => onEditSlot(slot),
                              },
                            ]
                          : []),
                        {
                          id: 'delete',
                          label: 'Eliminar clase',
                          icon: <Trash2 className="h-3.5 w-3.5" />,
                          variant: 'destructive' as const,
                          onClick: () => onDeleteSlot(slot),
                        },
                      ]}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>

      {/* Catedrático titular */}
      <DetailSection icon={<GraduationCap className="h-4 w-4" />} title="Catedrático titular">
        {professor ? (
          <DetailRow
            icon={null}
            leading={<ProfessorAvatar name={professor.name} icon={professor.icon} color={professor.color} size="contact" shape="circle" />}
            label="Imparte la materia"
            value={
              <>
                <span className="block truncate font-bold">{professor.name}</span>
                <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">
                  {professor.email || professor.phone || professor.office || 'Ver ficha de contacto'}
                </span>
              </>
            }
            onClick={onSelectProfessor ? () => onSelectProfessor(professor) : undefined}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-md-on-surface-variant)]">Sin catedrático asignado.</p>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-md-outline)] px-4 text-sm font-medium text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/[0.08]"
            >
              <UserPlus className="h-[18px] w-[18px]" aria-hidden="true" />
              Asignar catedrático
            </button>
          </div>
        )}
      </DetailSection>
    </DetailScreen>
  );
};
