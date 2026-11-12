import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  Calendar,
  CalendarPlus,
  LayoutGrid,
  List,
  FileEdit,
  Building2,
  Laptop,
  ChevronLeft,
  ChevronRight,
  Import,
  Share2,
} from 'lucide-react';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { useSharedFilePicker } from '../../../shared/hooks/useSharedFilePicker';
import { AGSCHEDULE_EXTENSION, AGSCHEDULE_MIME_TYPE } from '../services/agscheduleFormat';
import type { ScheduleSharePackage } from '../services/scheduleShareService';
import { scheduleImportedMessage } from '../utils/importMessages';
import { useSchedule } from '../hooks/useSchedule';
import { useCampusPulse } from '../hooks/useCampusPulse';
import { CampusPulseBento } from './CampusPulseBento';
import { isSlotVirtual } from '../utils/slotModality';
import type { Subject } from '../../subjects/types';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import { ScheduleSlotForm } from './ScheduleSlotForm';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { Modal } from '../../../shared/components/Modal';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { useScrollCollapse } from '../../../shared/hooks/useScrollCollapse';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { Button, Card, Badge } from '../../../shared/components/atoms';
import {
  DAY_NAMES,
  SHORT_DAY_NAMES,
  type DayOfWeek,
  type ScheduleSlot,
  type CreateScheduleSlotDTO,
} from '../types';
import { ABOVE_STRETCHED_CLASS, HEADER_SCRIM_CLASS, STRETCHED_CARD_BUTTON_CLASS } from '../../../shared/styles/surfaces';

interface ScheduleViewProps {
  onNavigateToNotes?: (subjectId?: string) => void;
  /** Tocar una clase abre la ficha técnica de su materia (App cambia a la pestaña Materias). */
  onOpenSubjectDetail?: (subjectId: string) => void;
  onEditorActiveChange?: (isActive: boolean) => void;
  isActive?: boolean;
}

// El horario es la vista de arranque: el modal de archivos solo se descarga si se abre.
const SubjectDocumentsModal = lazy(() =>
  import('../../subjects/components/SubjectDocumentsModal').then((m) => ({
    default: m.SubjectDocumentsModal,
  }))
);
// Igual con la importación de un horario compartido (.agschedule)
const ImportScheduleModal = lazy(() =>
  import('./ImportScheduleModal').then((m) => ({ default: m.ImportScheduleModal }))
);

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onNavigateToNotes,
  onOpenSubjectDetail,
  onEditorActiveChange,
  isActive = true,
}) => {
  const { slots, addSlot, updateSlot, removeSlot } = useSchedule();
  const { subjects, getSubjectById } = useSubjects();
  const { professors, getProfessorById } = useProfessors();
  const { settings } = useAppSettings();
  const isScrolled = useScrollCollapse(48);

  // Reloj del campus: se actualiza cada minuto, así "EN CURSO" y el día actual no se quedan
  // congelados en la hora en que se montó la vista (ni al cruzar la medianoche).
  const pulse = useCampusPulse(slots, subjects, professors);
  const currentDayOfWeek = pulse.todayDayOfWeek;
  const nowTimeString = pulse.nowTimeString;
  const [subjectForFiles, setSubjectForFiles] = useState<Subject | null>(null);

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(currentDayOfWeek);
  const [viewMode, setViewMode] = useState<'weekly' | 'daily'>(
    settings.defaultScheduleView
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | undefined>(undefined);
  const [slotToDelete, setSlotToDelete] = useState<ScheduleSlot | null>(null);

  useEffect(() => {
    onEditorActiveChange?.(isModalOpen);
    return () => {
      onEditorActiveChange?.(false);
    };
  }, [isModalOpen, onEditorActiveChange]);

  const handleOpenCreate = useCallback((day?: DayOfWeek) => {
    if (day) setSelectedDay(day);
    setEditingSlot(undefined);
    setIsModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setIsModalOpen(true);
  }, []);

  const handleSubmit = async (dto: CreateScheduleSlotDTO) => {
    if (editingSlot) {
      await updateSlot(editingSlot.id, dto);
    } else {
      await addSlot(dto);
    }
    setIsModalOpen(false);
  };

  const confirmDelete = async () => {
    if (slotToDelete) {
      await removeSlot(slotToDelete.id);
      setSlotToDelete(null);
    }
  };

  // Avisos breves (descarga del .agschedule, errores, importación terminada)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const showToast = (text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text }));

  // Compartir el horario completo (.agschedule). El servicio se carga solo al usarlo: esta es la
  // vista de arranque y no debe pesar más por un botón que se toca de vez en cuando.
  const handleShareSchedule = async () => {
    if (subjects.length === 0) {
      showToast('Aún no tienes materias para compartir.');
      return;
    }
    try {
      const { exportScheduleToAgschedule } = await import('../services/scheduleShareService');
      const result = await exportScheduleToAgschedule(settings.semesterName, subjects, slots, professors);
      if (result.method === 'download') showToast(`Se descargó «${result.fileName}».`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo compartir el horario.');
    }
  };

  // Importar un .agschedule elegido desde el almacenamiento del dispositivo
  const [importPackage, setImportPackage] = useState<ScheduleSharePackage | null>(null);
  const agschedulePicker = useSharedFilePicker({
    extension: AGSCHEDULE_EXTENSION,
    mimeType: AGSCHEDULE_MIME_TYPE,
    onContent: async (content) => {
      const { parseAgscheduleContent } = await import('../services/scheduleShareService');
      setImportPackage(parseAgscheduleContent(content));
    },
    onError: showToast,
  });

  // Días a mostrar según configuración y asignaturas existentes
  const displayedDays = useMemo(() => {
    const hasSat =
      slots.some((s) => s.dayOfWeek === 6) ||
      settings.visibleDays === 'mon-sat' ||
      settings.visibleDays === 'all';
    const hasSun =
      slots.some((s) => s.dayOfWeek === 7) || settings.visibleDays === 'all';
    const days: DayOfWeek[] = [1, 2, 3, 4, 5];
    if (hasSat || selectedDay === 6) days.push(6);
    if (hasSun || selectedDay === 7) days.push(7);
    return days;
  }, [slots, settings.visibleDays, selectedDay]);

  const daySlots = useMemo(() => {
    return slots
      .filter((s) => s.dayOfWeek === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots, selectedDay]);

  // Detección y control de scroll horizontal para vista semanal
  const weeklyScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = weeklyScrollRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const hasScroll = el.scrollWidth > el.clientWidth + 6;
    setCanScrollLeft(hasScroll && el.scrollLeft > 10);
    setCanScrollRight(hasScroll && el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = weeklyScrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, displayedDays, viewMode]);

  const scrollWeekly = (direction: 'left' | 'right') => {
    const el = weeklyScrollRef.current;
    if (!el) return;
    const scrollAmount = direction === 'left' ? -250 : 250;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  /** Nombre de la materia en una tarjeta de clase: si se puede, toda la tarjeta abre su ficha. */
  const renderSubjectTitle = (subjectId: string, name: string) =>
    onOpenSubjectDetail ? (
      <button type="button" onClick={() => onOpenSubjectDetail(subjectId)} className={STRETCHED_CARD_BUTTON_CLASS}>
        {name}
        <span className="sr-only"> · ver ficha de la materia</span>
      </button>
    ) : (
      name
    );

  // Vista de Edición / Creación Dedicada a Pantalla Completa
  if (isModalOpen) {
    return (
      <div className="w-full pb-8">
        <ErrorBoundary
          fallbackTitle="Error al abrir el formulario de cátedra"
          onReset={() => setIsModalOpen(false)}
        >
          <ScheduleSlotForm
            key={editingSlot?.id || 'new-slot'}
            initialData={editingSlot}
            defaultDay={selectedDay}
            onSubmit={handleSubmit}
            onCancel={() => setIsModalOpen(false)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5">
      {/* 1. ENCABEZADO DEL APARTADO (Compacto y Predecible) */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${HEADER_SCRIM_CLASS}`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-2xl font-black text-[var(--color-md-on-surface)] tracking-tight">
              Horario Académico
            </h2>
            <Badge variant="primary" size="sm">
              {settings.semesterName}
            </Badge>
          </div>
          <p className="text-[11px] sm:text-xs text-[var(--color-md-on-surface-variant)] font-medium mt-0.5">
            Planificación de bloques lectivos, aulas y cátedras universitarias.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 self-end sm:self-auto">
          {/* Alternar vista diaria / semanal */}
          <div className="flex items-center bg-[#E2E7EF] dark:bg-[#272A2F] p-1 rounded-full border border-[#C3C7D0]/60 dark:border-[#43474E]/60 shadow-2xs">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'weekly'
                  ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] shadow-xs'
                  : 'text-[#43474E] dark:text-[#C3C7D0] hover:text-[#191C20] dark:hover:text-[#E2E2E6]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Semana</span>
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'daily'
                  ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] shadow-xs'
                  : 'text-[#43474E] dark:text-[#C3C7D0] hover:text-[#191C20] dark:hover:text-[#E2E2E6]'
              }`}
            >
              <List className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Día</span>
            </button>
          </div>

          {/* Flechas de desplazamiento semanal en pantallas medianas */}
          {viewMode === 'weekly' && (canScrollLeft || canScrollRight) && (
            <div className="hidden sm:flex items-center gap-1 bg-[#E2E7EF] dark:bg-[#272A2F] p-1 rounded-full border border-[#C3C7D0]/60 dark:border-[#43474E]/60 shadow-2xs">
              <button
                onClick={() => scrollWeekly('left')}
                disabled={!canScrollLeft}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  canScrollLeft
                    ? 'hover:bg-white dark:hover:bg-[#1D2024] text-[#00639B] dark:text-[#96CCFF] cursor-pointer active:scale-90'
                    : 'opacity-25 cursor-not-allowed text-slate-400'
                }`}
                title="Desplazar a la izquierda"
                aria-label="Desplazar a la izquierda"
              >
                <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <button
                onClick={() => scrollWeekly('right')}
                disabled={!canScrollRight}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  canScrollRight
                    ? 'hover:bg-white dark:hover:bg-[#1D2024] text-[#00639B] dark:text-[#96CCFF] cursor-pointer active:scale-90'
                    : 'opacity-25 cursor-not-allowed text-slate-400'
                }`}
                title="Desplazar a la derecha"
                aria-label="Desplazar a la derecha"
              >
                <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          )}

          {/* Botón de escritorio (oculto en móvil) */}
          <Button
            variant="primary"
            size="sm"
            icon={<CalendarPlus className="w-4 h-4 stroke-[2.4]" />}
            onClick={() => handleOpenCreate(selectedDay)}
            className={`hidden md:inline-flex h-9 px-4 text-xs font-bold shadow-xs ring-2 ring-[#00639B]/20 dark:ring-[#96CCFF]/30 hover:scale-[1.02] whitespace-nowrap transition-all ${
              isScrolled ? 'scale-75 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
            }`}
          >
            Nueva Clase
          </Button>

          {/* Compartir o importar el horario completo (.agschedule) */}
          <input {...agschedulePicker.inputProps} />
          <M3KebabMenu
            ariaLabel="Compartir o importar el horario"
            items={[
              {
                id: 'share-agschedule',
                label: 'Compartir (.agschedule)',
                icon: <Share2 className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                onClick: () => void handleShareSchedule(),
              },
              {
                id: 'import-agschedule',
                label: 'Importar (.agschedule)',
                icon: <Import className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                onClick: agschedulePicker.open,
              },
            ]}
          />
        </div>
      </div>

      {/* 2. CAMPUS PULSE: clase en curso, próxima clase y resumen de la jornada en tiempo real */}
      <CampusPulseBento
        pulse={pulse}
        onTakeNote={onNavigateToNotes}
        onOpenFiles={setSubjectForFiles}
      />

      {/* 3. SELECTOR DE DÍAS (Móvil y Vista Diaria) */}
      <div className={viewMode === 'weekly' ? 'block sm:hidden' : 'block'}>
        <div className="bg-[#F1F4FA] dark:bg-[#1D2024] p-1 rounded-2xl border border-[#C3C7D0]/40 dark:border-[#43474E]/40 shadow-2xs">
          <div className="flex items-stretch gap-1 sm:gap-2 overflow-x-auto custom-scrollbar p-0.5">
            {displayedDays.map((day) => {
              const isSelected = selectedDay === day;
              const isToday = currentDayOfWeek === day;
              const count = slots.filter((s) => s.dayOfWeek === day).length;

              return (
                <button
                  key={day}
                  onClick={() => {
                    setSelectedDay(day as DayOfWeek);
                    if (window.innerWidth < 640) setViewMode('daily');
                  }}
                  className={`relative flex-1 min-w-[48px] sm:min-w-[68px] py-1.5 sm:py-2 px-1.5 rounded-xl text-center border transition-all duration-150 cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] border-[var(--color-md-primary)] shadow-2xs ring-1 ring-[var(--color-md-primary)]/20'
                      : 'bg-[var(--color-md-card-bg)] text-[var(--color-md-on-surface-variant)] border-[var(--color-md-outline-variant)] hover:bg-[var(--color-md-surface-container-high)] shadow-2xs'
                  }`}
                >
                  {isToday && (
                    <span
                      className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-amber-300 ring-1 ring-white' : 'bg-amber-500'
                      }`}
                      title="Hoy"
                    />
                  )}
                  <span
                    className={`text-[11px] sm:text-xs font-black uppercase tracking-wider block leading-tight text-center ${
                      isSelected ? 'text-[var(--color-md-on-primary)]' : 'text-[var(--color-md-on-surface)]'
                    }`}
                  >
                    {SHORT_DAY_NAMES[day as DayOfWeek]}
                  </span>
                  <span
                    className={`text-[9px] sm:text-[10px] block mt-0.5 leading-none ${
                      isSelected ? 'text-[var(--color-md-on-primary)] font-bold' : 'text-[var(--color-md-on-surface-variant)]'
                    }`}
                  >
                    {count} {count === 1 ? 'clase' : 'clases'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. VISTA SEMANAL (Contenedor Compacto de Alta Densidad) */}
      {viewMode === 'weekly' && (
        <div className="hidden sm:block w-full bg-[var(--color-md-surface-container)] rounded-2xl sm:rounded-3xl border border-[var(--color-md-outline-variant)] shadow-2xs overflow-hidden">
          <div ref={weeklyScrollRef} className="overflow-x-auto p-2 sm:p-2.5 xl:p-3 custom-scrollbar w-full">
            <div
              className={`grid w-full gap-2 sm:gap-2.5 ${
                displayedDays.length === 7
                  ? 'min-w-[1200px] xl:min-w-0 grid-cols-7'
                  : displayedDays.length === 6
                  ? 'min-w-[1080px] xl:min-w-0 grid-cols-6'
                  : 'min-w-[900px] lg:min-w-0 grid-cols-5'
              }`}
            >
              {displayedDays.map((day) => {
                const daySlotsList = slots
                  .filter((s) => s.dayOfWeek === day)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const isToday = currentDayOfWeek === day;

                return (
                  <div
                    key={day}
                    className={`flex flex-col gap-1.5 rounded-xl sm:rounded-2xl p-2 min-w-0 transition-colors ${
                      isToday
                        ? 'bg-[var(--color-md-card-bg)] border-2 border-[var(--color-md-primary)] shadow-2xs'
                        : 'bg-[var(--color-md-card-bg)]/80 border border-[var(--color-md-outline-variant)]'
                    }`}
                  >
                    {/* Encabezado del Día */}
                    <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-[var(--color-md-outline-variant)]">
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className={`text-xs font-black uppercase tracking-wider truncate ${
                            isToday ? 'text-[var(--color-md-primary)]' : 'text-[var(--color-md-on-surface)]'
                          }`}
                        >
                          {DAY_NAMES[day]}
                        </span>
                        {isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </div>
                      <button
                        onClick={() => handleOpenCreate(day)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-[#00639B] dark:bg-[#96CCFF] text-white dark:text-[#003353] hover:opacity-90 active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0"
                        title={`Agregar clase el ${DAY_NAMES[day]}`}
                      >
                        <Plus className="w-3 h-3 stroke-[2.8]" />
                        <span>Agregar</span>
                      </button>
                    </div>

                    {/* Lista de Bloques Semanales Compactos */}
                    <div className="space-y-1.5 min-h-[160px]">
                      {daySlotsList.length === 0 ? (
                        <div className="h-full flex items-center justify-center py-8 text-center text-[11px] text-[var(--color-md-on-surface-variant)] italic">
                          Libre
                        </div>
                      ) : (
                        daySlotsList.map((slot) => {
                          const subject = getSubjectById(slot.subjectId);
                          const professor = getProfessorById(slot.professorId);
                          const isNow =
                            isToday &&
                            nowTimeString >= slot.startTime &&
                            nowTimeString < slot.endTime;

                          return (
                            <div
                              key={slot.id}
                              style={{
                                background: isNow
                                  ? undefined
                                  : `linear-gradient(155deg, ${subject?.color || '#006BBB'}15 0%, ${subject?.color || '#006BBB'}04 100%), var(--color-md-card-bg)`,
                                borderColor: isNow ? undefined : `${subject?.color || '#006BBB'}40`,
                              }}
                              className={`content-auto rounded-xl p-2 border transition-[transform,box-shadow,border-color] duration-150 ease-out active:scale-[0.98] relative overflow-hidden group shadow-2xs hover:shadow-xs flex flex-col justify-between gap-1 ${
                                isNow
                                  ? 'border-emerald-500 ring-2 ring-emerald-400/50 bg-[var(--color-md-card-bg)]'
                                  : 'hover:border-[var(--color-md-primary)]'
                              }`}
                            >
                              {/* Barra superior de acento */}
                              <div
                                className="absolute top-0 left-0 right-0 h-1 opacity-90"
                                style={{ backgroundColor: subject?.color || '#006BBB' }}
                              />

                              {/* Jerarquía: materia → hora → aula/modalidad. Las acciones viven en el menú ⋮,
                                  porque en la cuadrícula semanal no cabe un botón sin saturar el bloque. */}
                              <div className="flex items-start justify-between gap-1 pt-0.5">
                                <h4 className="min-w-0 text-xs font-black text-[var(--color-md-on-surface)] leading-tight line-clamp-2">
                                  {renderSubjectTitle(slot.subjectId, subject?.name || 'Materia')}
                                </h4>

                                <M3KebabMenu
                                  size="sm"
                                  className={ABOVE_STRETCHED_CLASS}
                                  items={[
                                    ...(onNavigateToNotes
                                      ? [
                                          {
                                            id: 'notes',
                                            label: 'Tomar apunte',
                                            icon: <FileEdit className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                                            onClick: () => onNavigateToNotes(slot.subjectId),
                                          },
                                        ]
                                      : []),
                                    {
                                      id: 'edit',
                                      label: 'Editar clase',
                                      icon: <Edit2 className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                                      onClick: () => handleOpenEdit(slot),
                                    },
                                    {
                                      id: 'delete',
                                      label: 'Eliminar clase',
                                      icon: <Trash2 className="w-3.5 h-3.5" />,
                                      variant: 'destructive',
                                      onClick: () => setSlotToDelete(slot),
                                    },
                                  ]}
                                />
                              </div>

                              <span className="font-mono font-bold text-[10px] text-[var(--color-md-primary)]">
                                {slot.startTime} - {slot.endTime}
                              </span>

                              <div className="flex items-center justify-between gap-1 text-[10px] text-[var(--color-md-on-surface-variant)] pt-1 border-t border-[var(--color-md-outline-variant)] min-w-0">
                                <span className="truncate font-medium flex items-center gap-1">
                                  {isSlotVirtual(slot) ? (
                                    <>
                                      <Laptop className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                      <span>Virtual</span>
                                    </>
                                  ) : slot.classroom ? (
                                    <>
                                      <Building2 className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                      <span className="truncate">{slot.classroom}</span>
                                    </>
                                  ) : (
                                    'Sin aula'
                                  )}
                                </span>

                                {professor && (
                                  <span className="truncate max-w-[90px] font-medium text-right text-[9.5px]">
                                    {professor.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. VISTA DIARIA (Compacta y Fluida) */}
      <div className={viewMode === 'weekly' ? 'block sm:hidden space-y-2.5' : 'space-y-2.5'}>
        <div className="flex items-center justify-between bg-[var(--color-md-card-bg)] px-3.5 py-2.5 rounded-2xl border border-[var(--color-md-outline-variant)] shadow-2xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-md-on-surface-variant)] block leading-none">
              Horario del día
            </span>
            <h3 className="text-sm sm:text-base font-black text-[var(--color-md-on-surface)] mt-0.5">
              {DAY_NAMES[selectedDay]}
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] border border-[var(--color-md-outline-variant)]">
            {daySlots.length} {daySlots.length === 1 ? 'materia' : 'materias'}
          </span>
        </div>

        {daySlots.length === 0 ? (
          <div className="text-center py-10 bg-[var(--color-md-card-bg)] rounded-2xl border border-dashed border-[var(--color-md-outline-variant)] p-6 shadow-2xs">
            <Calendar className="w-10 h-10 text-[var(--color-md-outline)] mx-auto mb-1.5 opacity-50" />
            <p className="text-xs sm:text-sm font-bold text-[var(--color-md-on-surface)]">
              Sin clases agendadas para el {DAY_NAMES[selectedDay]}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenCreate(selectedDay)}
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              className="mt-3"
            >
              Programar clase
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5">
            {daySlots.map((slot) => {
              const subject = getSubjectById(slot.subjectId);
              // La clase puede tener su propio docente; si no, se muestra el titular de la materia
              const professor = getProfessorById(slot.professorId ?? subject?.professorId);
              const isNow =
                selectedDay === currentDayOfWeek &&
                nowTimeString >= slot.startTime &&
                nowTimeString < slot.endTime;

              return (
                <Card
                  key={slot.id}
                  padding="compact"
                  accentColor={isNow ? undefined : subject?.color}
                  interactive
                  className={`content-auto flex flex-col gap-2.5 ${
                    isNow ? 'border-emerald-500 ring-2 ring-emerald-400/40' : ''
                  }`}
                >
                  {/* Cabecera: materia protagonista, código/estado debajo y docente justo después */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0"
                      style={{ backgroundColor: subject?.color || '#2481cc' }}
                      aria-hidden="true"
                    >
                      <SubjectIcon icon={subject?.icon} className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm sm:text-base font-extrabold text-[var(--color-md-on-surface)] leading-tight line-clamp-2">
                        {renderSubjectTitle(slot.subjectId, subject?.name || 'Materia')}
                      </h4>
                      {(subject?.code || isNow) && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {subject?.code && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)]">
                              <span className="sr-only">Código: </span>
                              {subject.code}
                            </span>
                          )}
                          {isNow && (
                            <Badge variant="success" size="xs" className="motion-safe:animate-pulse">
                              EN CURSO
                            </Badge>
                          )}
                        </div>
                      )}
                      {professor && (
                        <div className="flex items-center gap-1.5 text-xs text-[var(--color-md-on-surface-variant)] mt-1.5">
                          <ProfessorAvatar
                            name={professor.name}
                            icon={professor.icon}
                            color={professor.color}
                            size="select"
                            className="shrink-0"
                          />
                          <span className="font-medium truncate">
                            <span className="sr-only">Docente: </span>
                            {professor.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Gestión en el menú ⋮; "Tomar apunte" ya es la acción visible del pie */}
                    <M3KebabMenu
                      className={ABOVE_STRETCHED_CLASS}
                      items={[
                        {
                          id: 'edit',
                          label: 'Editar clase',
                          icon: <Edit2 className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                          onClick: () => handleOpenEdit(slot),
                        },
                        {
                          id: 'delete',
                          label: 'Eliminar clase',
                          icon: <Trash2 className="w-3.5 h-3.5" />,
                          variant: 'destructive',
                          onClick: () => setSlotToDelete(slot),
                        },
                      ]}
                    />
                  </div>

                  {/* Horario destacado + modalidad o aula */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] px-2.5 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      {slot.startTime} - {slot.endTime}
                    </span>

                    {isSlotVirtual(slot) ? (
                      <span className="inline-flex items-center gap-1 text-[var(--color-md-on-secondary-container)] bg-[var(--color-md-secondary-container)] px-2 py-1 rounded-lg text-[11px] font-semibold">
                        <Laptop className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Virtual</span>
                      </span>
                    ) : slot.classroom ? (
                      <span className="inline-flex items-center gap-1 text-[var(--color-md-on-surface-variant)] bg-[var(--color-md-surface-container)] px-2 py-1 rounded-lg text-[11px] font-medium min-w-0 max-w-full">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                        <span className="sr-only">Aula: </span>
                        <span className="truncate">{slot.classroom}</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Pie anclado abajo: la acción principal en la zona del pulgar */}
                  {onNavigateToNotes && (
                    <div className="mt-auto pt-2 border-t border-[var(--color-md-outline-variant)] flex items-center justify-end">
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => onNavigateToNotes(slot.subjectId)}
                        aria-label={`Tomar apunte de ${subject?.name || 'la clase'}`}
                        icon={<FileEdit className="w-3 h-3" />}
                        className={`${ABOVE_STRETCHED_CLASS} shrink-0 text-[11px] py-1 px-3 h-7 whitespace-nowrap`}
                      >
                        Tomar apunte
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={slotToDelete !== null}
        onClose={() => setSlotToDelete(null)}
        title="¿Retirar Clase del Horario?"
        maxWidth="sm"
      >
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            ¿Deseas retirar esta cátedra de tu horario semanal? La materia y tus apuntes permanecerán guardados.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setSlotToDelete(null)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              Retirar
            </button>
          </div>
        </div>
      </Modal>

      {/* Archivos de la próxima clase, abiertos desde Campus Pulse */}
      {subjectForFiles && (
        <Suspense fallback={null}>
          <SubjectDocumentsModal
            subject={subjectForFiles}
            isOpen
            onClose={() => setSubjectForFiles(null)}
          />
        </Suspense>
      )}

      {/* Vista previa de un .agschedule importado a mano */}
      {importPackage && (
        <Suspense fallback={null}>
          <ImportScheduleModal
            key={importPackage.exportedAt}
            sharePackage={importPackage}
            onClose={() => setImportPackage(null)}
            onImported={({ summary, mode }) => {
              setImportPackage(null);
              showToast(scheduleImportedMessage(summary, mode));
            }}
          />
        </Suspense>
      )}

      <ContextualToast message={toast?.text ?? null} bottomOffset="nav" onClose={() => setToast(null)} />

      {/* Botón Flotante Reubicable (FAB) */}
      {isActive && (
        <DraggableFAB
          colorScheme="schedule"
          onClick={() => handleOpenCreate(selectedDay)}
          label="Programar Nueva Cátedra"
          icon={<CalendarPlus className="w-6 h-6 stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
