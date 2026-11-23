import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import type { NotesIntent } from '../../notes/types/notesRequest';
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
  MonitorSmartphone,
  Share2,
  UserRound,
  Video,
  FolderOpen,
} from 'lucide-react';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { useSharedFilePicker } from '../../../shared/hooks/useSharedFilePicker';
import { AGSCHEDULE_EXTENSION, AGSCHEDULE_MIME_TYPE } from '../services/agscheduleFormat';
import type { ScheduleSharePackage } from '../services/scheduleShareService';
import { scheduleImportedMessage } from '../utils/importMessages';
import { useSchedule } from '../hooks/useSchedule';
import { useCampusPulse } from '../hooks/useCampusPulse';
import { CampusPulseBento } from './CampusPulseBento';
import { ClassProgressBar } from './ClassProgressBar';
import { SeasonalGreeting } from '../../../shared/seasons/SeasonalGreeting';
import { transferShortcutLabel } from '../../transfer/services/transferAvailability';
import { isSlotVirtual, meetingPlatform } from '../utils/slotModality';
import { isWebUrl, openExternalUrl } from '../../../shared/utils/openExternalUrl';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { getDisplayedDays, resolveVisibleDay } from '../utils/visibleDays';
import type { Subject } from '../../subjects/types';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectBadge, SubjectIcon } from '../../subjects/components/SubjectIcon';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { ScheduleSlotForm } from './ScheduleSlotForm';
import { DeleteSlotDialog } from './DeleteSlotDialog';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { FloatingMenuButton, type FloatingMenuItem } from '../../../shared/components/FloatingMenuButton';
import { AREA_COLOR } from '../../../shared/components/floatingStyles';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { useTimeFormatter } from '../../settings/hooks/useTimeFormatter';
import { Button, Card, Badge } from '../../../shared/components/atoms';
import {
  DAY_NAMES,
  SHORT_DAY_NAMES,
  type DayOfWeek,
  type ScheduleSlot,
  type CreateScheduleSlotDTO,
} from '../types';
import {
  ABOVE_STRETCHED_CLASS,
  CARD_INTERACTIVE_CLASS,
  CARD_SURFACE_CLASS,
  HEADER_SCRIM_CLASS,
  LIST_HEADER_CLASS,
  STRETCHED_CARD_BUTTON_CLASS,
} from '../../../shared/styles/surfaces';
import { AgendaUpcomingStrip } from '../../agenda/components/AgendaUpcomingStrip';

type ScheduleViewMode = 'weekly' | 'daily';

/** Vista elegida a mano en esta sesión (se olvida al cerrar la app). */
const SESSION_VIEW_KEY = 'agenda_schedule_view_session';
/** Desde aquí es «PC / pantalla ancha» (md de Tailwind). */
const WIDE_QUERY = '(min-width: 768px)';

function initialScheduleView(preference: 'auto' | 'weekly' | 'daily'): ScheduleViewMode {
  try {
    const chosen = sessionStorage.getItem(SESSION_VIEW_KEY);
    if (chosen === 'weekly' || chosen === 'daily') return chosen;
  } catch {
    // Sin almacenamiento de sesión: se usa la preferencia
  }
  if (preference !== 'auto') return preference;
  return typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches ? 'weekly' : 'daily';
}

function rememberSessionView(mode: ScheduleViewMode): void {
  try {
    sessionStorage.setItem(SESSION_VIEW_KEY, mode);
  } catch {
    // Solo dura la sesión: si no se puede guardar, no pasa nada
  }
}

interface ScheduleViewProps {
  onNavigateToNotes?: (subjectId?: string, intent?: NotesIntent) => void;
  /** Tocar una clase abre la ficha técnica de su materia (App cambia a la pestaña Materias). */
  onOpenSubjectDetail?: (subjectId: string) => void;
  onEditorActiveChange?: (isActive: boolean) => void;
  /** "Próximos en tu agenda": abre la Agenda en un día o la Agenda sin más. */
  onOpenAgendaDay?: (day: string) => void;
  onOpenAgenda?: () => void;
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
// Y con la transferencia por QR entre el teléfono y la PC (menú ⋮)
const TransferLauncher = lazy(() =>
  import('../../transfer/components/TransferLauncher').then((m) => ({ default: m.TransferLauncher }))
);

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onNavigateToNotes,
  onOpenSubjectDetail,
  onEditorActiveChange,
  onOpenAgendaDay,
  onOpenAgenda,
  isActive = true,
}) => {
  const { slots, addSlots, updateSlot, removeSlot } = useSchedule();
  const { subjects, getSubjectById } = useSubjects();
  const { professors, getProfessorById } = useProfessors();
  const { settings } = useAppSettings();
  const timeFormatter = useTimeFormatter();

  // Reloj del campus: se actualiza cada minuto, así "EN CURSO" y el día actual no se quedan
  // congelados en la hora en que se montó la vista (ni al cruzar la medianoche).
  const pulse = useCampusPulse(slots, subjects, professors);
  const currentDayOfWeek = pulse.todayDayOfWeek;
  const nowTimeString = pulse.nowTimeString;
  const [subjectForFiles, setSubjectForFiles] = useState<Subject | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferLabel] = useState(transferShortcutLabel);

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(currentDayOfWeek);
  // Vista al abrir: la que el estudiante eligió en esta sesión; si no, la de Ajustes
  // ('auto' = Día en el celular y Semana en la PC, ver initialScheduleView)
  const [viewMode, setViewModeState] = useState<ScheduleViewMode>(() => initialScheduleView(settings.defaultScheduleView));
  const setViewMode = useCallback((mode: ScheduleViewMode) => {
    setViewModeState(mode);
    rememberSessionView(mode);
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | undefined>(undefined);
  const [slotToDelete, setSlotToDelete] = useState<ScheduleSlot | null>(null);
  // PC: «Próximos en tu agenda» sube junto al resumen del día (en el teléfono queda al final)
  const isWide = useMediaQuery('(min-width: 1024px)');


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

  const handleSubmit = async (dtos: CreateScheduleSlotDTO[]) => {
    if (editingSlot) {
      await updateSlot(editingSlot.id, dtos[0]);
    } else {
      await addSlots(dtos);
      if (dtos.length > 1) showToast(`Se agregaron ${dtos.length} clases al horario.`);
    }
    setIsModalOpen(false);
  };

  const confirmDelete = async (slot: ScheduleSlot) => {
    await removeSlot(slot.id);
    setSlotToDelete(null);
    // Si se borró desde su propio formulario de edición, se vuelve al horario
    if (editingSlot?.id === slot.id) setIsModalOpen(false);
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

  // Días a mostrar: el rango de Ajustes más los días con clases (ver utils/visibleDays.ts)
  const displayedDays = useMemo(
    () => getDisplayedDays(settings.visibleDays, slots.map((slot) => slot.dayOfWeek)),
    [slots, settings.visibleDays]
  );
  // Día activo de la vista por día: si el elegido (hoy, al abrir) no se muestra, el siguiente visible
  const activeDay = resolveVisibleDay(selectedDay, displayedDays);

  const daySlots = useMemo(() => {
    return slots
      .filter((s) => s.dayOfWeek === activeDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots, activeDay]);

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

  useEffect(() => {
    if (viewMode !== 'weekly') return;
    const el = weeklyScrollRef.current;
    const today = el?.querySelector<HTMLElement>('[data-today]');
    if (!el || !today || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, today.offsetLeft - el.offsetLeft - 8);
  }, [viewMode]);

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

  // Confirmación para quitar una clase (desde el menú ⋮ de una tarjeta o desde «Editar clase»)
  const deleteSlotDialog = (
    <DeleteSlotDialog
      slot={slotToDelete}
      subjectName={slotToDelete ? getSubjectById(slotToDelete.subjectId)?.name : undefined}
      onCancel={() => setSlotToDelete(null)}
      onConfirm={confirmDelete}
    />
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
            defaultDay={activeDay}
            onSubmit={handleSubmit}
            onCancel={() => setIsModalOpen(false)}
            onDelete={editingSlot ? () => setSlotToDelete(editingSlot) : undefined}
          />
        </ErrorBoundary>
        {deleteSlotDialog}
      </div>
    );
  }


  // Opciones de Compartir: las usa el menú de arriba (PC y tableta) y el flotante (teléfono)
  const shareItems: FloatingMenuItem[] = [
    {
      id: 'share-agschedule',
      label: 'Compartir horario',
      description: 'Envía tu horario completo (.agschedule) por WhatsApp, correo…',
      icon: <Share2 className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
      onClick: () => void handleShareSchedule(),
    },
    {
      id: 'import-agschedule',
      label: 'Importar horario',
      description: 'Abre un horario que te compartieron.',
      icon: <Import className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
      onClick: agschedulePicker.open,
    },
    // Acceso directo a pasar los datos por QR (solo en las apps de Android y Windows)
    ...(transferLabel
      ? [
          {
            id: 'device-transfer',
            label: transferLabel,
            description: 'Pasa todos tus datos a tu otro dispositivo con un código QR.',
            icon: <MonitorSmartphone className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
            onClick: () => setTransferOpen(true),
          },
        ]
      : []),
  ];

  return (
    <div className="glass-legible flex flex-col gap-3 sm:gap-3.5">
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
          <p className="text-11px sm:text-xs text-[var(--color-md-on-surface-variant)] font-medium mt-0.5">
            Planificación de bloques lectivos, aulas y cátedras universitarias.
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 self-end sm:self-auto">
          {/* Alternar vista diaria / semanal */}
          <div className="flex items-center bg-[var(--color-md-surface-container-high)] p-1 rounded-full border border-[var(--color-md-outline-variant)]/60 shadow-2xs">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'weekly'
                  ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] shadow-xs'
                  : 'text-[var(--color-md-on-surface-variant)] hover:text-[var(--color-md-on-surface)]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Semana</span>
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'daily'
                  ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] shadow-xs'
                  : 'text-[var(--color-md-on-surface-variant)] hover:text-[var(--color-md-on-surface)]'
              }`}
            >
              <List className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Día</span>
            </button>
          </div>

          {/* Flechas de desplazamiento semanal en pantallas medianas */}
          {viewMode === 'weekly' && (canScrollLeft || canScrollRight) && (
            <div className="hidden sm:flex items-center gap-1 bg-[var(--color-md-surface-container-high)] p-1 rounded-full border border-[var(--color-md-outline-variant)]/60 shadow-2xs">
              <button
                onClick={() => scrollWeekly('left')}
                disabled={!canScrollLeft}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  canScrollLeft
                    ? 'hover:bg-[var(--color-md-card-bg)] text-[var(--color-md-primary)] cursor-pointer active:scale-90'
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
                    ? 'hover:bg-[var(--color-md-card-bg)] text-[var(--color-md-primary)] cursor-pointer active:scale-90'
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
            onClick={() => handleOpenCreate(activeDay)}
            className={`hidden md:inline-flex h-9 px-4 text-xs font-bold shadow-xs ring-2 ring-[var(--color-md-primary)]/20 hover:scale-[1.02] whitespace-nowrap transition-all scale-100 opacity-100 scrolled:scale-75 scrolled:opacity-0 scrolled:pointer-events-none`}
          >
            Nueva Clase
          </Button>

          {/* Compartir o importar el horario completo (.agschedule) */}
          <input {...agschedulePicker.inputProps} />
          {/* En PC y tableta, aquí arriba; en el teléfono va flotando bajo el botón de agregar */}
          <div className="hidden md:block">
            <M3KebabMenu ariaLabel="Compartir, importar o pasar datos" label="Compartir" icon={<Share2 />} items={shareItems} />
          </div>
          {isActive && (
            <FloatingMenuButton
              label="Compartir"
              sheetTitle="Compartir o importar"
              icon={<Share2 />}
              color={AREA_COLOR.schedule}
              items={shareItems}
            />
          )}
          {transferOpen && (
            <Suspense fallback={null}>
              <TransferLauncher onClose={() => setTransferOpen(false)} onShowToast={showToast} />
            </Suspense>
          )}
        </div>
      </div>

      {/* Saludo de temporada: Navidad (1–30 dic) y Año Nuevo (31 dic–31 ene) */}
      <SeasonalGreeting />

      {/* 2. CAMPUS PULSE: clase en curso, próxima clase y resumen de la jornada en tiempo real.
          En PC (>= 1024 px) va junto a «Próximos en tu agenda», que en el teléfono queda al final */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start">
        <CampusPulseBento
          pulse={pulse}
          onTakeNote={onNavigateToNotes ? (subjectId) => onNavigateToNotes(subjectId, 'compose') : undefined}
          onOpenFiles={setSubjectForFiles}
        />
        {isWide && onOpenAgendaDay && onOpenAgenda && <AgendaUpcomingStrip onOpenDay={onOpenAgendaDay} onOpenAgenda={onOpenAgenda} />}
      </div>

      {/* 3. SELECTOR DE DÍAS (solo en la vista Día: en Semana se ve toda la semana a la vez) */}
      <div className={viewMode === 'weekly' ? 'hidden' : 'block'}>
        <div className="md-card bg-[var(--color-md-surface-container)] p-1 rounded-2xl border border-[var(--color-md-outline-variant)]/40 shadow-2xs">
          <div className="flex items-stretch gap-1 sm:gap-2 overflow-x-auto custom-scrollbar p-0.5">
            {displayedDays.map((day) => {
              const isSelected = activeDay === day;
              const isToday = currentDayOfWeek === day;
              const count = slots.filter((s) => s.dayOfWeek === day).length;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day as DayOfWeek)}
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
                    className={`text-11px sm:text-xs font-black uppercase tracking-wider block leading-tight text-center ${
                      isSelected ? 'text-[var(--color-md-on-primary)]' : 'text-[var(--color-md-on-surface)]'
                    }`}
                  >
                    {SHORT_DAY_NAMES[day as DayOfWeek]}
                  </span>
                  <span
                    className={`text-9px sm:text-10px block mt-0.5 leading-none ${
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
        <div className="w-full bg-[var(--color-md-surface-container)] rounded-2xl sm:rounded-3xl border border-[var(--color-md-outline-variant)] shadow-2xs overflow-hidden">
          {/* En el celular: las mismas columnas de la PC, de 240 px, que se deslizan con el dedo y
              encajan día por día (snap); en la PC (>= 768 px), la cuadrícula de siempre */}
          <div
            ref={weeklyScrollRef}
            className="overflow-x-auto p-2 sm:p-2.5 xl:p-3 custom-scrollbar w-full snap-x snap-mandatory scroll-px-2 md:snap-none"
          >
            <div
              className={`flex w-full gap-2 md:grid md:gap-2.5 ${
                displayedDays.length === 7
                  ? 'md:min-w-[1200px] xl:min-w-0 md:grid-cols-7'
                  : displayedDays.length === 6
                  ? 'md:min-w-[1080px] xl:min-w-0 md:grid-cols-6'
                  : 'md:min-w-[900px] lg:min-w-0 md:grid-cols-5'
              }`}
            >
              {displayedDays.map((day) => {
                const daySlotsList = slots
                  .filter((s) => s.dayOfWeek === day)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                const isToday = currentDayOfWeek === day;

                return (
                  <section
                    key={day}
                    data-today={isToday || undefined}
                    aria-label={`${DAY_NAMES[day]}${isToday ? ', hoy' : ''}: ${daySlotsList.length} ${daySlotsList.length === 1 ? 'clase' : 'clases'}`}
                    className={`flex w-[240px] min-w-[240px] shrink-0 snap-start flex-col gap-2 rounded-[20px] p-2 transition-colors md:w-auto md:min-w-0 md:shrink ${
                      isToday
                        ? 'bg-[var(--color-md-primary-container)]/50 ring-1 ring-inset ring-[var(--color-md-primary)]/35'
                        : 'bg-[var(--color-md-card-bg)]'
                    }`}
                  >
                    {/* Encabezado del día: nombre (título pequeño M3), «Hoy» y botón de icono para agregar */}
                    <header className="flex items-center justify-between gap-1 pl-1.5 pt-0.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <h3
                          className={`truncate text-sm font-medium tracking-[0.1px] ${
                            isToday ? 'text-[var(--color-md-primary)]' : 'text-[var(--color-md-on-surface)]'
                          }`}
                        >
                          {DAY_NAMES[day]}
                        </h3>
                        {isToday && (
                          <span className="shrink-0 rounded-full bg-[var(--color-md-primary)] px-2 py-px text-10px font-semibold leading-4 text-[var(--color-md-on-primary)]">
                            Hoy
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenCreate(day)}
                        aria-label={`Agregar clase el ${DAY_NAMES[day]}`}
                        title={`Agregar clase el ${DAY_NAMES[day]}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-md-primary)] transition-colors duration-150 hover:bg-[var(--color-md-primary)]/10 active:bg-[var(--color-md-primary)]/15"
                      >
                        <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                    </header>

                    {/* Clases del día */}
                    <div className="flex min-h-[160px] flex-1 flex-col gap-2">
                      {daySlotsList.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCreate(day)}
                          className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--color-md-outline-variant)] px-2 py-8 text-xs font-medium text-[var(--color-md-on-surface-variant)] transition-colors duration-150 hover:bg-[var(--color-md-on-surface)]/[0.04]"
                        >
                          Sin clases
                        </button>
                      ) : (
                        daySlotsList.map((slot) => {
                          const subject = getSubjectById(slot.subjectId);
                          const professor = getProfessorById(slot.professorId);
                          const color = subject?.color || '#006BBB';
                          const isNow =
                            isToday &&
                            nowTimeString >= slot.startTime &&
                            nowTimeString < slot.endTime;
                          const progress = isNow && pulse.currentClass?.slot.id === slot.id ? pulse.currentClass : null;

                          return (
                            /* Misma tarjeta que el resto de la app (superficie común, acabado elegido y
                               variante tonal del color de la materia, ver .card-tinted en index.css): icono
                               y título arriba; debajo hora · aula · docente. Las acciones viven en el menú ⋮;
                               tocar la tarjeta abre la ficha de la materia. */
                            <article
                              key={slot.id}
                              style={
                                isNow
                                  ? {
                                      // Clase en curso (M3): relleno tonal y contorno en el color primario del tema
                                      backgroundColor: 'color-mix(in srgb, var(--color-md-primary-container) 75%, var(--color-md-card-bg))',
                                      borderColor: 'var(--color-md-primary)',
                                    }
                                  : ({ '--card-tint': color } as React.CSSProperties)
                              }
                              className={`${CARD_SURFACE_CLASS} ${CARD_INTERACTIVE_CLASS} content-auto group overflow-hidden p-2.5 pr-1 ${
                                isNow ? 'ring-1 ring-inset ring-[var(--color-md-primary)]' : 'card-tinted'
                              }`}
                            >
                              {/* Encabezado: icono elegido para la materia (con su color) y menú. El nombre va
                                  debajo, a todo el ancho: en columnas estrechas no compite con el icono */}
                              <div className="flex items-center justify-between gap-2">
                                <SubjectBadge icon={subject?.icon} color={color} size="md" />
                                <M3KebabMenu
                                  size="sm"
                                  className={ABOVE_STRETCHED_CLASS}
                                  ariaLabel={`Opciones de ${subject?.name || 'la clase'}`}
                                  items={[
                                    ...(onNavigateToNotes
                                      ? [
                                          {
                                            id: 'notes',
                                            label: 'Tomar apunte',
                                            icon: <FileEdit className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                                            onClick: () => onNavigateToNotes(slot.subjectId, 'compose'),
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

                              <h4 className="mt-1.5 pr-1.5 text-13px font-medium leading-snug text-[var(--color-md-on-surface)] line-clamp-2 [overflow-wrap:anywhere]">
                                {renderSubjectTitle(slot.subjectId, subject?.name || 'Materia')}
                              </h4>

                              <div className="mt-1.5 space-y-1 pr-2">
                                {isNow && (
                                  <span className="inline-flex items-center rounded-full bg-[var(--color-md-primary)] px-2 py-0.5 text-10px font-semibold text-[var(--color-md-on-primary)]">
                                    En curso
                                  </span>
                                )}
                                <p className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-[var(--color-md-on-surface)]">
                                  <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
                                  {timeFormatter.range(slot.startTime, slot.endTime)}
                                </p>
                                <p className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-md-on-surface-variant)]">
                                  {isSlotVirtual(slot) ? (
                                    <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  ) : (
                                    <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                  )}
                                  <span className="truncate">
                                    {isSlotVirtual(slot) ? 'Virtual' : slot.classroom || 'Sin aula'}
                                  </span>
                                </p>
                                {professor && (
                                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-md-on-surface-variant)]">
                                    <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{professor.name}</span>
                                  </p>
                                )}
                                {progress && (
                                  <div className="pt-1">
                                    <ClassProgressBar percent={progress.progressPercent} minutesRemaining={progress.minutesRemaining} compact />
                                  </div>
                                )}
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. VISTA DIARIA (Compacta y Fluida) */}
      <div className={viewMode === 'weekly' ? 'hidden' : 'space-y-2.5'}>
        {/* Encabezado de la lista completa del día (distinto del resumen rápido de arriba) */}
        <div className={LIST_HEADER_CLASS}>
          <h3 className="text-sm font-black text-[var(--color-md-on-surface)] sm:text-base">
            {activeDay === currentDayOfWeek ? `Hoy, ${DAY_NAMES[activeDay].toLowerCase()}` : DAY_NAMES[activeDay]}
          </h3>
          <span className="text-xs font-medium text-[var(--color-md-on-surface-variant)]">
            {daySlots.length} {daySlots.length === 1 ? 'clase' : 'clases'}
          </span>
        </div>

        {daySlots.length === 0 ? (
          <div className="text-center py-10 bg-[var(--color-md-card-bg)] rounded-2xl border border-dashed border-[var(--color-md-outline-variant)] p-6 shadow-2xs">
            <Calendar className="w-10 h-10 text-[var(--color-md-outline)] mx-auto mb-1.5 opacity-50" />
            <p className="text-xs sm:text-sm font-bold text-[var(--color-md-on-surface)]">
              Sin clases agendadas para el {DAY_NAMES[activeDay]}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenCreate(activeDay)}
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
                activeDay === currentDayOfWeek &&
                nowTimeString >= slot.startTime &&
                nowTimeString < slot.endTime;
              const progress = isNow && pulse.currentClass?.slot.id === slot.id ? pulse.currentClass : null;
              // La misma clase que el resumen muestra como «Próxima»: se marca para relacionarlas
              const isNext = !isNow && pulse.nextClass?.slot.id === slot.id;
              const isVirtual = isSlotVirtual(slot);
              const platform = isVirtual ? meetingPlatform(slot.virtualLink) : null;
              const joinUrl = isVirtual && isWebUrl(slot.virtualLink) ? slot.virtualLink : null;
              const place = isVirtual
                ? `Virtual${platform ? ` · ${platform}` : ''}`
                : slot.classroom
                  ? `${slot.classroom}${slot.building ? ` (${slot.building})` : ''}`
                  : null;

              return (
                <Card
                  key={slot.id}
                  padding="compact"
                  tint={isNow ? undefined : subject?.color}
                  interactive
                  style={
                    isNow
                      ? {
                          // Clase en curso (M3): relleno tonal y contorno en el color primario del tema
                          background: 'color-mix(in srgb, var(--color-md-primary-container) 70%, var(--md-card-surface))',
                          borderColor: 'var(--color-md-primary)',
                        }
                      : undefined
                  }
                  className={`content-auto flex flex-col gap-2.5 ${isNow ? 'ring-1 ring-inset ring-[var(--color-md-primary)]' : ''}`}
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
                      {/* Código como texto; la única cápsula es el estado (En curso / Próxima) */}
                      {(subject?.code || isNow || isNext) && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {subject?.code && (
                            <span className="font-mono text-11px font-medium text-[var(--color-md-on-surface-variant)]">
                              <span className="sr-only">Código: </span>
                              {subject.code}
                            </span>
                          )}
                          {isNow && (
                            <span className="inline-flex items-center rounded-md bg-[var(--color-md-primary)] px-1.5 py-px text-10px font-bold uppercase tracking-wide text-[var(--color-md-on-primary)]">
                              En curso
                            </span>
                          )}
                          {isNext && (
                            <span className="inline-flex items-center rounded-md bg-[var(--color-md-primary)]/12 px-1.5 py-px text-10px font-bold uppercase tracking-wide text-[var(--color-md-primary)]">
                              Próxima
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Gestión en el menú ⋮ (40×40); las acciones visibles van en el pie */}
                    <M3KebabMenu
                      size="md"
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

                  {/* Datos de la clase: texto limpio con íconos sutiles (no parecen botones) */}
                  <ul className="space-y-1 text-xs text-[var(--color-md-on-surface-variant)]">
                    <li className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                      <span className="font-semibold tabular-nums text-[var(--color-md-on-surface)]">
                        {timeFormatter.range(slot.startTime, slot.endTime)}
                      </span>
                    </li>
                    {place && (
                      <li className="flex min-w-0 items-center gap-1.5">
                        {isVirtual ? (
                          <Laptop className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                        ) : (
                          <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                        )}
                        {!isVirtual && <span className="sr-only">Aula: </span>}
                        <span className="truncate">{place}</span>
                      </li>
                    )}
                    {professor && (
                      <li className="flex min-w-0 items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                        <span className="sr-only">Docente: </span>
                        <span className="truncate">{professor.name}</span>
                      </li>
                    )}
                  </ul>

                  {progress && <ClassProgressBar percent={progress.progressPercent} minutesRemaining={progress.minutesRemaining} />}

                  {/* Pie: solo los botones reales, en la zona del pulgar */}
                  {(onNavigateToNotes || joinUrl || subject) && (
                    <div className="mt-auto space-y-2 border-t border-[var(--color-md-outline-variant)] pt-2.5">
                      {/* Clase virtual con enlace: unirse es lo principal, a todo el ancho y arriba */}
                      {joinUrl && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => void openExternalUrl(joinUrl)}
                          aria-label={`Unirse a la clase de ${subject?.name || 'la materia'}${platform ? ` en ${platform}` : ''}`}
                          icon={<Video className="h-4 w-4" />}
                          className={`${ABOVE_STRETCHED_CLASS} min-h-10 w-full whitespace-nowrap`}
                        >
                          {platform ? `Unirse a ${platform}` : 'Unirse a la clase'}
                        </Button>
                      )}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                      {/* Archivos de la materia: tonal (secundaria) */}
                      {subject && (
                        <Button
                          variant="action-indigo"
                          size="xs"
                          onClick={() => setSubjectForFiles(subject)}
                          aria-label={`Ver archivos de ${subject.name}`}
                          icon={<FolderOpen className="h-4 w-4" />}
                          className={`${ABOVE_STRETCHED_CLASS} min-h-10 shrink-0 whitespace-nowrap`}
                        >
                          Archivos
                        </Button>
                      )}
                      {/* Tomar apunte es la acción principal (rellena), salvo si hay que unirse a la clase */}
                      {onNavigateToNotes && (
                        <Button
                          variant={joinUrl ? 'action-indigo' : 'primary'}
                          size="xs"
                          onClick={() => onNavigateToNotes(slot.subjectId, 'compose')}
                          aria-label={`Tomar apunte de ${subject?.name || 'la clase'}`}
                          icon={<FileEdit className="h-4 w-4" />}
                          className={`${ABOVE_STRETCHED_CLASS} min-h-10 shrink-0 whitespace-nowrap`}
                        >
                          Tomar apunte
                        </Button>
                      )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Próximos en tu agenda: debajo del horario, que es lo principal de esta pestaña */}
      {!isWide && onOpenAgendaDay && onOpenAgenda && <AgendaUpcomingStrip onOpenDay={onOpenAgendaDay} onOpenAgenda={onOpenAgenda} />}

      {deleteSlotDialog}

      {/* Archivos de una materia: desde el resumen o desde el pie de cada tarjeta */}
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
          onClick={() => handleOpenCreate(activeDay)}
          label="Programar Nueva Cátedra"
          icon={<CalendarPlus className="w-6 h-6 stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
