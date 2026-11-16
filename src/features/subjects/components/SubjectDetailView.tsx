import React, { useCallback } from 'react';
import {
  Archive,
  Award,
  CalendarDays,
  ChevronRight,
  Clock,
  Edit2,
  FileText,
  FolderOpen,
  GraduationCap,
  Laptop,
  MapPin,
  Pencil,
  Plus,
  Share2,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { PAGE_HEADER_ICON_BUTTON, PAGE_HEADER_PRIMARY_BUTTON, PageHeader } from '../../../shared/components/PageHeader';
import { BACK_PRIORITY, useBackButton } from '../../../shared/hooks/useBackButton';
import { MOTION_EXIT_MS, useExitTransition } from '../../../shared/hooks/useExitTransition';
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

/** Tarjeta de sección de la ficha: misma superficie que los formularios (FormSheet). */
const SECTION_CLASS =
  'md-card rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-4 shadow-xs sm:p-5';

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode; trailing?: React.ReactNode }> = ({
  icon,
  children,
  trailing,
}) => (
  <div className="mb-3 flex items-center justify-between gap-2">
    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
      <span className="text-[var(--color-md-primary)]" aria-hidden="true">
        {icon}
      </span>
      {children}
    </h3>
    {trailing}
  </div>
);

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
  // Salida animada (la misma de los formularios): con la flecha y con el botón atrás de Android
  const { isClosing, runExit } = useExitTransition(MOTION_EXIT_MS.sheet);
  const exit = useCallback(() => runExit(onBack), [runExit, onBack]);

  useBackButton(() => {
    exit();
    return true;
  }, BACK_PRIORITY.SUBVIEW);

  const sortedSlots = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  const weeklyMinutes = sortedSlots.reduce((sum, slot) => sum + Math.max(0, minutesOf(slot.endTime) - minutesOf(slot.startTime)), 0);
  const hasCredits = subject.credits !== undefined && subject.credits > 0;

  return (
    <div className={`${isClosing ? 'm3-sheet-exit' : 'm3-sheet-enter'} mx-auto w-full max-w-3xl space-y-3 pb-10`}>
      <PageHeader
        title="Asignatura"
        subtitle="Ficha técnica"
        onBack={exit}
        backLabel="Volver a materias"
        actions={
          <>
            <button
              type="button"
              onClick={onShareAgclass}
              aria-label="Compartir materia (.agclass)"
              title="Compartir materia (.agclass)"
              className={PAGE_HEADER_ICON_BUTTON}
            >
              <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button type="button" onClick={onEdit} className={`ml-1 ${PAGE_HEADER_PRIMARY_BUTTON}`}>
              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Editar</span>
            </button>
            <M3KebabMenu
              ariaLabel="Más opciones de la asignatura"
              items={[
                {
                  id: 'delete',
                  label: 'Eliminar asignatura',
                  icon: <Trash2 className="h-3.5 w-3.5" />,
                  variant: 'destructive',
                  onClick: onDelete,
                },
              ]}
            />
          </>
        }
      />

      {/* Identidad: ícono, nombre y datos curriculares */}
      <section className={`${SECTION_CLASS} relative`} aria-labelledby="subject-detail-name">
        {/* Cada tarjeta lleva a su propia edición: esta, a los datos de la asignatura */}
        <button
          type="button"
          onClick={onEdit}
          aria-label="Editar datos de la asignatura"
          title="Editar datos de la asignatura"
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-on-surface)]/[0.08] hover:text-[var(--color-md-on-surface)]"
        >
          <Pencil className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <div className="flex items-start gap-4 pr-8">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ring-1 ring-white/20"
            style={{ backgroundColor: subject.color }}
            aria-hidden="true"
          >
            <SubjectIcon icon={subject.icon} className="h-8 w-8 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="subject-detail-name"
              className="break-words text-xl font-black leading-tight text-[var(--color-md-on-surface)] sm:text-2xl"
            >
              {subject.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-11px">
              {subject.isArchived && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-md-secondary-container)] px-2 py-1 font-semibold text-[var(--color-md-on-secondary-container)]">
                  <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                  Archivada{subject.semester ? ` · ${subject.semester}` : ''}
                </span>
              )}
              {subject.code && (
                <span className="inline-flex items-center rounded-md bg-[var(--color-md-surface-container-high)] px-2 py-1 font-mono font-medium text-[var(--color-md-on-surface-variant)]">
                  <span className="sr-only">Código: </span>
                  {subject.code}
                </span>
              )}
              {hasCredits && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-md-secondary-container)] px-2 py-1 font-semibold text-[var(--color-md-on-secondary-container)]">
                  <Award className="h-3.5 w-3.5" aria-hidden="true" />
                  {subject.credits} {subject.credits === 1 ? 'crédito' : 'créditos'}
                </span>
              )}
              {subject.classroomDefault && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-[var(--color-md-surface-container)] px-2 py-1 font-medium text-[var(--color-md-on-surface-variant)]">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                  <span className="sr-only">Aula habitual: </span>
                  <span className="truncate">{subject.classroomDefault}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Accesos rápidos al contenido de la materia */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            key: 'notes',
            icon: <FileText className="h-5 w-5" aria-hidden="true" />,
            label: 'Apuntes',
            count: noteCount,
            onClick: () => onNavigateToNotes(subject.id),
          },
          {
            key: 'docs',
            icon: <FolderOpen className="h-5 w-5" aria-hidden="true" />,
            label: 'Archivos',
            count: docCount,
            onClick: () => onNavigateToDocs(subject),
          },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className="md-card flex items-center gap-3 rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-3.5 text-left shadow-xs transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--color-md-surface-container)] active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">{item.label}</span>
              <span className="block text-11px text-[var(--color-md-on-surface-variant)]">
                {item.count} {item.key === 'notes' ? (item.count === 1 ? 'apunte' : 'apuntes') : item.count === 1 ? 'archivo' : 'archivos'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* Horario semanal */}
      <section className={SECTION_CLASS}>
        <SectionTitle
          icon={<CalendarDays className="h-4 w-4" />}
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
          Horario semanal
        </SectionTitle>

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
      </section>

      {/* Catedrático titular */}
      <section className={SECTION_CLASS}>
        <SectionTitle icon={<GraduationCap className="h-4 w-4" />}>Catedrático titular</SectionTitle>
        {professor ? (
          <button
            type="button"
            onClick={() => onSelectProfessor?.(professor)}
            disabled={!onSelectProfessor}
            className="-m-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-[var(--color-md-surface-container)] disabled:pointer-events-none"
          >
            <ProfessorAvatar name={professor.name} icon={professor.icon} color={professor.color} size="contact" shape="circle" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{professor.name}</span>
              <span className="block truncate text-11px text-[var(--color-md-on-surface-variant)]">
                {professor.email || professor.phone || professor.office || 'Ver ficha de contacto'}
              </span>
            </span>
            {onSelectProfessor && <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />}
          </button>
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
      </section>
    </div>
  );
};
