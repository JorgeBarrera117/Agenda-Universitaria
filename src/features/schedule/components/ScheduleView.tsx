import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Sparkles,
  FileEdit,
  Building2,
  CheckCircle2,
  Laptop,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import { ScheduleSlotForm } from './ScheduleSlotForm';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { Modal } from '../../../shared/components/Modal';
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

interface ScheduleViewProps {
  onNavigateToNotes?: (subjectId?: string) => void;
  onEditorActiveChange?: (isActive: boolean) => void;
  isActive?: boolean;
}

const isSlotVirtual = (slot?: {
  modality?: string;
  classroom?: string;
  building?: string;
}): boolean => {
  if (!slot) return false;
  if (slot.modality === 'virtual') return true;
  if (slot.modality === 'presencial') return false;
  const c = (slot.classroom || '').toLowerCase();
  const b = (slot.building || '').toLowerCase();
  return (
    c.includes('virtual') ||
    c.includes('zoom') ||
    c.includes('teams') ||
    c.includes('meet') ||
    c.includes('online') ||
    b.includes('virtual') ||
    b.includes('online')
  );
};

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onNavigateToNotes,
  onEditorActiveChange,
  isActive = true,
}) => {
  const { slots, addSlot, updateSlot, removeSlot } = useSchedule();
  const { getSubjectById } = useSubjects();
  const { getProfessorById } = useProfessors();
  const { settings } = useAppSettings();
  const isScrolled = useScrollCollapse(48);

  // Día actual del sistema (1 = Lunes, ..., 7 = Domingo)
  const currentDayOfWeek = (() => {
    const day = new Date().getDay();
    return (day === 0 ? 7 : day) as DayOfWeek;
  })();

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

  // Hora actual en formato "HH:mm" para calcular el estado en vivo de las clases
  const now = new Date();
  const nowTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  // Clases del día de hoy
  const todaySlots = slots
    .filter((s) => s.dayOfWeek === currentDayOfWeek)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Clase en curso ahora mismo (si coincide el día y rango horario)
  const activeClassNow = todaySlots.find(
    (s) => nowTimeString >= s.startTime && nowTimeString < s.endTime
  );

  // Próxima clase hoy
  const nextClassToday = todaySlots.find((s) => s.startTime > nowTimeString);

  const handleOpenCreate = (day?: DayOfWeek) => {
    if (day) setSelectedDay(day);
    setEditingSlot(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setIsModalOpen(true);
  };

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

  // Días a mostrar según configuración y asignaturas existentes
  const hasSaturday =
    slots.some((s) => s.dayOfWeek === 6) ||
    settings.visibleDays === 'mon-sat' ||
    settings.visibleDays === 'all';
  const hasSunday =
    slots.some((s) => s.dayOfWeek === 7) || settings.visibleDays === 'all';
  const displayedDays: DayOfWeek[] = [1, 2, 3, 4, 5];
  if (hasSaturday || selectedDay === 6) displayedDays.push(6);
  if (hasSunday || selectedDay === 7) displayedDays.push(7);

  const daySlots = slots
    .filter((s) => s.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Detección y control de scroll horizontal para la vista semanal en pantallas intermedias
  // IMPORTANTE (Reglas de Hooks): Declarar SIEMPRE antes de cualquier retorno condicional
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

  // Vista de Edición / Creación Dedicada a Pantalla Completa (Aprovechando todo el espacio en PC)
  if (isModalOpen) {
    return (
      <div className="w-full pb-12">
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
    <div className="flex flex-col gap-4">
      {/* 1. ENCABEZADO DEL APARTADO (JERARQUÍA NIVEL 1 EN EL BODY) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Horario Académico
            </h2>
            <Badge variant="primary" size="sm">
              {settings.semesterName}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Planificación de bloques lectivos, aulas y cátedras universitarias.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 lg:gap-3 shrink-0">
          {/* Alternar vista diaria / semanal (Material Design 3 Segmented Button Set con Accesibilidad Visual) */}
          <div className="flex items-center bg-[#E2E7EF] dark:bg-[#272A2F] p-1 lg:p-1.5 rounded-full border border-[#C3C7D0]/60 dark:border-[#43474E]/60 shadow-2xs">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1.5 lg:gap-2 px-3.5 lg:px-5 py-1.5 lg:py-2.5 text-xs lg:text-sm font-extrabold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'weekly'
                  ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] shadow-xs'
                  : 'text-[#43474E] dark:text-[#C3C7D0] hover:text-[#191C20] dark:hover:text-[#E2E2E6]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 lg:w-4 lg:h-4 stroke-[2.3]" />
              Semana
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 lg:gap-2 px-3.5 lg:px-5 py-1.5 lg:py-2.5 text-xs lg:text-sm font-extrabold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'daily'
                  ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] shadow-xs'
                  : 'text-[#43474E] dark:text-[#C3C7D0] hover:text-[#191C20] dark:hover:text-[#E2E2E6]'
              }`}
            >
              <List className="w-3.5 h-3.5 lg:w-4 lg:h-4 stroke-[2.3]" />
              Por Día
            </button>
          </div>

          {/* Controles de desplazamiento horizontal cuando la cuadrícula semanal sobrepasa el ancho de pantalla */}
          {viewMode === 'weekly' && (canScrollLeft || canScrollRight) && (
            <div className="flex items-center gap-1 bg-[#E2E7EF] dark:bg-[#272A2F] p-1 rounded-full border border-[#C3C7D0]/60 dark:border-[#43474E]/60 shadow-2xs">
              <button
                onClick={() => scrollWeekly('left')}
                disabled={!canScrollLeft}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  canScrollLeft
                    ? 'hover:bg-white dark:hover:bg-[#1D2024] text-[#00639B] dark:text-[#96CCFF] cursor-pointer active:scale-90'
                    : 'opacity-25 cursor-not-allowed text-slate-400'
                }`}
                title="Desplazar días a la izquierda"
                aria-label="Desplazar días a la izquierda"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              </button>
              <button
                onClick={() => scrollWeekly('right')}
                disabled={!canScrollRight}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  canScrollRight
                    ? 'hover:bg-white dark:hover:bg-[#1D2024] text-[#00639B] dark:text-[#96CCFF] cursor-pointer active:scale-90'
                    : 'opacity-25 cursor-not-allowed text-slate-400'
                }`}
                title="Desplazar días a la derecha"
                aria-label="Desplazar días a la derecha"
              >
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          )}

          <Button
            variant="primary"
            size="md"
            icon={<CalendarPlus className="w-4 h-4 lg:w-5 lg:h-5 stroke-[2.4]" />}
            onClick={() => handleOpenCreate(selectedDay)}
            className={`lg:min-h-[48px] lg:px-6 lg:py-3 lg:text-sm shadow-md hover:shadow-lg ring-2 ring-[#00639B]/25 dark:ring-[#96CCFF]/35 hover:scale-[1.02] whitespace-nowrap origin-right transition-all duration-200 ${
              isScrolled ? 'scale-75 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
            }`}
          >
            Nueva Clase
          </Button>
        </div>
      </div>

      {/* 2. TARJETA INFORMATIVA DE EVENTOS DE HOY / CLASE EN CURSO (JERARQUÍA NIVEL 2) */}
      {(activeClassNow || nextClassToday || todaySlots.length > 0) && (
        <section className="relative overflow-hidden rounded-[28px] bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] p-4 sm:p-5 shadow-xs border border-[#00639B]/20 dark:border-white/10">
          {activeClassNow ? (
            // A. ESTADO: EN CLASE AHORA (M3 Hero Card)
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#C4EED0] dark:bg-[#0A532C] text-[#00210E] dark:text-[#C4EED0] border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                  EN CLASE AHORA MISMO
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#001D32] dark:text-[#D0E4FF]">
                    {getSubjectById(activeClassNow.subjectId)?.name || 'Clase Universitaria'}
                  </h3>
                  {getSubjectById(activeClassNow.subjectId)?.code && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-mono font-black bg-black text-white dark:bg-white dark:text-black tracking-wider shadow-2xs">
                      {getSubjectById(activeClassNow.subjectId)?.code}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-medium pt-0.5">
                  <span className="inline-flex items-center gap-1 font-mono font-bold bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg text-xs">
                    <Clock className="w-3.5 h-3.5 text-[#00639B] dark:text-[#96CCFF]" />
                    {activeClassNow.startTime} - {activeClassNow.endTime}
                  </span>
                  {isSlotVirtual(activeClassNow) ? (
                    <span className="inline-flex items-center gap-1 bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                      <Laptop className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Virtual {activeClassNow.classroom && activeClassNow.classroom.toLowerCase() !== 'virtual' ? `• ${activeClassNow.classroom}` : ''}</span>
                    </span>
                  ) : (
                    activeClassNow.classroom && (
                      <span className="inline-flex items-center gap-1 bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg text-[11px] font-medium">
                        <Building2 className="w-3.5 h-3.5 text-[#00639B] dark:text-[#96CCFF]" />
                        <span>
                          {activeClassNow.classroom}
                          {activeClassNow.building && ` (${activeClassNow.building})`}
                        </span>
                      </span>
                    )
                  )}
                  {getProfessorById(activeClassNow.professorId) && (
                    <span className="inline-flex items-center gap-1.5 bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg text-xs">
                      <ProfessorAvatar
                        name={getProfessorById(activeClassNow.professorId)!.name}
                        icon={getProfessorById(activeClassNow.professorId)?.icon}
                        color={getProfessorById(activeClassNow.professorId)?.color}
                        size="xs"
                      />
                      <span className="font-medium">{getProfessorById(activeClassNow.professorId)?.name}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Atajo 1-tap UX: Tomar apunte de la clase actual */}
              {onNavigateToNotes && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => onNavigateToNotes(activeClassNow.subjectId)}
                  icon={<FileEdit className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.3]" />}
                  className="shrink-0 self-start md:self-center sm:px-6 sm:py-3 sm:text-base font-extrabold shadow-md ring-2 ring-white/25 dark:ring-black/20 hover:scale-[1.02]"
                >
                  Tomar Apunte
                </Button>
              )}
            </div>
          ) : nextClassToday ? (
            // B. ESTADO: SIGUIENTE CLASE HOY (M3 Tonal Banner)
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFDCC1] dark:bg-[#683D00] text-[#2E1500] dark:text-[#FFDCC1] border border-amber-500/20 shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                  PRÓXIMA CLASE HOY
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-[#001D32] dark:text-[#D0E4FF]">
                    {getSubjectById(nextClassToday.subjectId)?.name}
                  </h3>
                  {getSubjectById(nextClassToday.subjectId)?.code && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-mono font-black bg-black text-white dark:bg-white dark:text-black tracking-wider shadow-2xs">
                      {getSubjectById(nextClassToday.subjectId)?.code}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold">
                    Inicia a las {nextClassToday.startTime}
                  </span>
                  {nextClassToday.classroom && (
                    <span className="flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3 h-3" />
                      {nextClassToday.classroom}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-left sm:text-right text-xs shrink-0 font-medium">
                <span>Total hoy: </span>
                <span className="font-mono font-bold">
                  {todaySlots.length} {todaySlots.length === 1 ? 'clase' : 'clases'}
                </span>
              </div>
            </div>
          ) : (
            // C. ESTADO: CLASES COMPLETADAS HOY
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#C4EED0] dark:bg-[#0A532C] text-[#00210E] dark:text-[#C4EED0] flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold">¡Jornada de hoy completada!</h4>
                  <p className="text-[11px] sm:text-xs opacity-80 hidden sm:block">
                    Has terminado todas tus clases del día. Aprovecha para repasar tus apuntes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. SELECTOR DE DÍAS (M3 Filter Chips - Visible solo en vista diaria en desktop, o en móvil) */}
      <div className={viewMode === 'weekly' ? 'block sm:hidden' : 'block'}>
        <div className="bg-[#F1F4FA] dark:bg-[#1D2024] p-1.5 rounded-[28px] border border-[#C3C7D0]/50 dark:border-[#43474E]/50 shadow-2xs">
          <div className="flex items-stretch gap-1.5 sm:gap-2.5 overflow-x-auto custom-scrollbar p-1">
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
                  className={`relative flex-1 min-w-[52px] sm:min-w-[76px] py-2 sm:py-2.5 px-2 rounded-2xl text-center border transition-all duration-200 cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] border-[var(--color-md-primary)] shadow-xs ring-2 ring-[var(--color-md-primary)]/25'
                      : 'bg-[var(--color-md-card-bg)] text-[var(--color-md-on-surface-variant)] border-[var(--color-md-outline-variant)] hover:bg-[var(--color-md-surface-container-high)] shadow-2xs'
                  }`}
                >
                  {/* Indicador de "Hoy": Micro-badge absoluto en esquina */}
                  {isToday && (
                    <span
                      className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 rounded-full ${
                        isSelected
                          ? 'bg-cove-gold ring-2 ring-white animate-pulse'
                          : 'bg-amber-500 ring-2 ring-[var(--color-md-card-bg)]'
                      }`}
                      title="Hoy"
                    />
                  )}

                  {/* Día de la semana perfectamente centrado */}
                  <span
                    className={`text-xs sm:text-sm font-black uppercase tracking-wider block leading-tight text-center ${
                      isSelected ? 'text-[var(--color-md-on-primary)]' : 'text-[var(--color-md-on-surface)]'
                    }`}
                  >
                    {SHORT_DAY_NAMES[day as DayOfWeek]}
                  </span>

                  {/* Conteo de bloques con contraste M3 */}
                  <div
                    className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate ${
                      isSelected
                        ? 'text-[var(--color-md-on-primary)] opacity-95 font-extrabold'
                        : 'text-[var(--color-md-on-surface-variant)] font-semibold'
                    }`}
                  >
                    <span className="sm:hidden">{count} {count === 1 ? 'blq' : 'blqs'}</span>
                    <span className="hidden sm:inline">{count} {count === 1 ? 'bloque' : 'bloques'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. VISTA SEMANAL (Contenedor Redondeado Fijo con Adaptabilidad 100% en Laptops y Escritorio) */}
      {viewMode === 'weekly' && (
        <div className="hidden sm:block w-full bg-[var(--color-md-surface-container)] rounded-3xl border border-[var(--color-md-outline-variant)] shadow-2xs overflow-hidden">
          <div ref={weeklyScrollRef} className="overflow-x-auto p-2.5 sm:p-3 xl:p-3.5 custom-scrollbar w-full">
            <div
              className={`grid w-full gap-2.5 sm:gap-3 ${
                displayedDays.length === 7
                  ? 'min-w-[1260px] xl:min-w-0 grid-cols-7'
                  : displayedDays.length === 6
                  ? 'min-w-[1140px] xl:min-w-0 grid-cols-6'
                  : 'min-w-[950px] lg:min-w-0 grid-cols-5'
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
                  className={`flex flex-col gap-2 xl:gap-2.5 rounded-2xl p-2 sm:p-2.5 xl:p-3 min-w-0 transition-colors ${
                    isToday
                      ? 'bg-[var(--color-md-card-bg)] border-2 border-[var(--color-md-primary)] shadow-sm'
                      : 'bg-[var(--color-md-card-bg)]/80 border border-[var(--color-md-outline-variant)]'
                  }`}
                >
                  {/* Encabezado del Día */}
                  <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-[var(--color-md-outline-variant)]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-xs sm:text-sm font-black uppercase tracking-wider whitespace-nowrap ${
                          isToday ? 'text-[var(--color-md-primary)]' : 'text-[var(--color-md-on-surface)]'
                        }`}
                      >
                        {DAY_NAMES[day]}
                      </span>
                      {isToday && (
                        <span className="w-2.5 h-2.5 rounded-full bg-cove-gold ring-1 ring-white shrink-0" />
                      )}
                    </div>
                    <button
                      onClick={() => handleOpenCreate(day)}
                      className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-extrabold bg-[#00639B] dark:bg-[#96CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#B3D9FF] active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
                      title={`Agregar clase el ${DAY_NAMES[day]}`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.8] shrink-0" />
                      <span className={displayedDays.length >= 7 ? 'hidden 2xl:inline' : 'inline'}>Agregar</span>
                    </button>
                  </div>

                  {/* Lista de Bloques del Día */}
                  <div className="space-y-2 xl:space-y-2.5 min-h-[220px]">
                    {daySlotsList.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-12 text-center text-xs text-slate-400 dark:text-slate-500 font-medium italic">
                        Día libre de clases
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
                                : `linear-gradient(155deg, ${subject?.color || '#006BBB'}18 0%, ${subject?.color || '#006BBB'}06 100%), var(--card-bg, #ffffff)`,
                              borderColor: isNow ? undefined : `${subject?.color || '#006BBB'}45`,
                            }}
                            className={`rounded-2xl p-2 sm:p-2.5 xl:p-3 border transition-all relative overflow-hidden group shadow-2xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-1.5 xl:gap-2 ${
                              isNow
                                ? 'border-emerald-500 ring-2 ring-emerald-400/50 bg-emerald-50/20'
                                : 'hover:border-cove-sky/80'
                            }`}
                          >
                            {/* Banda superior con el color de la materia */}
                            <div
                              className="absolute top-0 left-0 right-0 h-1.5 opacity-90"
                              style={{ backgroundColor: subject?.color || '#006BBB' }}
                            />

                            {/* 1. Cabecera: Ícono de Materia (Izq) y Botones de Acción (Der) */}
                            <div className="flex items-center justify-between gap-1.5 pt-0.5">
                              {/* Badge con Ícono y Color */}
                              <div
                                className="w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0 ring-1 ring-white/60"
                                style={{ backgroundColor: subject?.color || '#006BBB' }}
                                title={subject?.name}
                              >
                                <SubjectIcon icon={subject?.icon} className="w-3.5 h-3.5 text-white" />
                              </div>

                              {/* Botones de Acción Superiores alineados a la derecha */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {onNavigateToNotes && (
                                  <Button
                                    variant="action-indigo"
                                    size="icon-xs"
                                    onClick={() => onNavigateToNotes(slot.subjectId)}
                                    title="Tomar apunte"
                                    aria-label="Tomar apunte"
                                    icon={<FileEdit className="w-3.5 h-3.5" />}
                                  />
                                )}
                                <Button
                                  variant="action-blue"
                                  size="icon-xs"
                                  onClick={() => handleOpenEdit(slot)}
                                  title="Editar clase"
                                  aria-label="Editar clase"
                                  icon={<Edit2 className="w-3.5 h-3.5" />}
                                />
                                <Button
                                  variant="action-rose"
                                  size="icon-xs"
                                  onClick={() => setSlotToDelete(slot)}
                                  title="Eliminar clase"
                                  aria-label="Eliminar clase"
                                  icon={<Trash2 className="w-3.5 h-3.5" />}
                                />
                              </div>
                            </div>

                            {/* 2. Código / Sigla Completa (100% visible, sin cortes) y Título de la Asignatura */}
                            <div className="space-y-1">
                              {subject?.code && (
                                <div className="flex items-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] sm:text-[10.5px] font-mono font-black bg-black text-white dark:bg-white dark:text-black tracking-wider shadow-2xs">
                                    {subject.code}
                                  </span>
                                </div>
                              )}

                              {/* Nombre de la Materia (100% de Ancho Disponible) */}
                              <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-cove-blue dark:group-hover:text-cove-sky transition-colors leading-snug line-clamp-2">
                                {subject?.name || 'Materia'}
                              </h4>
                            </div>

                            {/* 3. Cuerpo de Información Completo */}
                            <div className="space-y-1 text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 min-w-0">
                              {/* Rango Horario Completo */}
                              <div className="flex items-center gap-1.5 font-mono font-bold text-cove-navy dark:text-cove-sand bg-cove-blue/10 dark:bg-cove-blue/20 border border-cove-sky/25 px-2 py-0.5 rounded-lg">
                                <Clock className="w-3 h-3 text-cove-blue dark:text-cove-sky shrink-0" />
                                <span className="font-mono text-[11px] sm:text-xs">{slot.startTime} - {slot.endTime}</span>
                              </div>

                              {/* Modalidad y Ubicación */}
                              {isSlotVirtual(slot) ? (
                                <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200 bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-lg">
                                  <Laptop className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                  <span className="font-bold text-[10px] sm:text-[11px] truncate leading-tight">
                                    Virtual {slot.classroom && slot.classroom.toLowerCase() !== 'virtual' ? `• ${slot.classroom}` : ''}
                                  </span>
                                </div>
                              ) : (
                                slot.classroom && (
                                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg">
                                    <Building2 className="w-3 h-3 text-cove-blue dark:text-cove-sky shrink-0" />
                                    <span className="font-semibold text-[10px] sm:text-[11px] truncate leading-tight">
                                      {slot.classroom}{slot.building ? ` (${slot.building})` : ''}
                                    </span>
                                  </div>
                                )
                              )}

                              {/* Catedrático Asignado */}
                              {professor && (
                                <div className="flex items-center gap-1.5 pt-0.5 text-[10px] sm:text-[11px] text-slate-700 dark:text-slate-300 font-medium min-w-0">
                                  <ProfessorAvatar
                                    name={professor.name}
                                    icon={professor.icon}
                                    color={professor.color}
                                    size="xs"
                                    className="shrink-0"
                                  />
                                  <span className="truncate leading-tight font-semibold min-w-0">{professor.name}</span>
                                </div>
                              )}
                            </div>

                            {/* 4. Indicador En Vivo */}
                            {isNow && (
                              <div className="pt-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500 text-white shadow-2xs animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                  EN CURSO AHORA
                                </span>
                              </div>
                            )}
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

      {/* 5. VISTA DIARIA (Móvil / Pases de Aula Detallados) */}
      <div className={viewMode === 'weekly' ? 'block sm:hidden space-y-3.5' : 'space-y-3.5'}>
        <div className="flex items-center justify-between bg-[var(--color-md-card-bg)] px-5 py-3.5 rounded-2xl border border-[var(--color-md-outline-variant)] shadow-2xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-md-on-surface-variant)]">
              Horario para el día
            </span>
            <h3 className="text-base font-black text-[var(--color-md-on-surface)]">
              {DAY_NAMES[selectedDay]}
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] border border-[var(--color-md-outline-variant)]">
            {daySlots.length} {daySlots.length === 1 ? 'materia' : 'materias'}
          </span>
        </div>

        {daySlots.length === 0 ? (
          <div className="text-center py-14 bg-[var(--color-md-card-bg)] rounded-3xl border border-dashed border-[var(--color-md-outline-variant)] p-8 shadow-xs">
            <Calendar className="w-12 h-12 text-[var(--color-md-outline)] mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-[var(--color-md-on-surface)]">
              Sin clases agendadas para el {DAY_NAMES[selectedDay]}
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => handleOpenCreate(selectedDay)}
              icon={<Plus className="w-5 h-5 stroke-[2.5]" />}
              className="mt-4 shadow-md"
            >
              Programar clase para este día
            </Button>
          </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5">
              {daySlots.map((slot) => {
                const subject = getSubjectById(slot.subjectId);
                const professor = getProfessorById(slot.professorId);
                const isNow =
                  selectedDay === currentDayOfWeek &&
                  nowTimeString >= slot.startTime &&
                  nowTimeString < slot.endTime;

                return (
                  <Card
                    key={slot.id}
                    padding="normal"
                    accentColor={isNow ? undefined : subject?.color}
                    interactive
                    className={`flex flex-col justify-between gap-3 group ${
                      isNow
                        ? 'border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/10'
                        : ''
                    }`}
                  >
                    {/* 1. Cabecera Superior: Ícono + Código + Título (100% ancho) + Botones de Acción */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-2xs shrink-0 ring-1 ring-white/60"
                          style={{ backgroundColor: subject?.color || '#2481cc' }}
                          title={subject?.name}
                        >
                          <SubjectIcon icon={subject?.icon} className="w-5 h-5 text-white" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-mono font-black bg-black text-white dark:bg-white dark:text-black tracking-wider shadow-2xs">
                              {subject?.code || 'CLASE'}
                            </span>

                            {isSlotVirtual(slot) ? (
                              <Badge variant="primary" size="xs" icon={<Laptop className="w-3 h-3 text-indigo-700 dark:text-indigo-400" />}>
                                VIRTUAL
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="xs" icon={<Building2 className="w-3 h-3 text-cove-blue dark:text-cove-sky" />}>
                                PRESENCIAL
                              </Badge>
                            )}

                            {isNow && (
                              <Badge variant="success" size="xs" className="animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mr-1" />
                                EN CURSO
                              </Badge>
                            )}
                          </div>

                          <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-[#2481cc] dark:group-hover:text-[#2AABEE] transition-colors tracking-tight leading-snug line-clamp-1 mt-0.5">
                            {subject?.name || 'Materia'}
                          </h4>
                        </div>
                      </div>

                      {/* Botones de Acción Superiores (Editar / Eliminar) */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <Button
                          variant="action-blue"
                          size="icon-xs"
                          onClick={() => handleOpenEdit(slot)}
                          title="Editar clase"
                          aria-label="Editar clase"
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                        />
                        <Button
                          variant="action-rose"
                          size="icon-xs"
                          onClick={() => setSlotToDelete(slot)}
                          title="Eliminar clase"
                          aria-label="Eliminar clase"
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                        />
                      </div>
                    </div>

                    {/* 2. Fila de Horario y Ubicación / Modalidad (Material Design 3 Chips) */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-[#001D32] dark:text-[#D0E4FF] bg-[#D0E4FF] dark:bg-[#004B76] border border-[#004B76]/20 dark:border-[#D0E4FF]/20 px-2.5 py-1 rounded-full text-xs shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF] shrink-0" />
                        <span>{slot.startTime} - {slot.endTime}</span>
                      </div>

                      {isSlotVirtual(slot) ? (
                        <div className="flex items-center gap-1.5 text-[#2B1700] dark:text-[#FFDCC2] bg-[#FFDCC2] dark:bg-[#683D00] border border-[#8B5000]/20 dark:border-[#FFDCC2]/20 px-2.5 py-1 rounded-full truncate font-bold text-[11px]">
                          <Laptop className="w-3.5 h-3.5 text-[#8B5000] dark:text-[#FFB77B] shrink-0" />
                          <span className="truncate">
                            {slot.classroom && slot.classroom.toLowerCase() !== 'virtual'
                              ? `Plataforma: ${slot.classroom}`
                              : 'Clase Virtual'}
                          </span>
                        </div>
                      ) : (
                        slot.classroom && (
                          <div className="flex items-center gap-1.5 text-[#191C20] dark:text-[#E2E2E6] bg-[#E2E7EF] dark:bg-[#272A2F] border border-[#C3C7D0]/40 dark:border-[#43474E]/40 px-2.5 py-1 rounded-full truncate font-semibold text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF] shrink-0" />
                            <span className="truncate">{slot.classroom}{slot.building ? ` (${slot.building})` : ''}</span>
                          </div>
                        )
                      )}
                    </div>

                    {/* 3. Pie de Tarjeta: Docente a la izquierda y Botón "Tomar Apunte" a la derecha */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      {professor ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <ProfessorAvatar
                            name={professor.name}
                            icon={professor.icon}
                            color={professor.color}
                            size="xs"
                            className="ring-1 ring-[#2481cc]/30 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px] block">
                              {professor.name}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                          Sin docente asignado
                        </span>
                      )}

                      {onNavigateToNotes && (
                        <Button
                          variant="action-indigo"
                          size="sm"
                          onClick={() => onNavigateToNotes(slot.subjectId)}
                          title="Tomar apunte de esta materia"
                          aria-label="Tomar apunte"
                          icon={<FileEdit className="w-4 h-4 stroke-[2.3]" />}
                          className="font-extrabold shadow-xs"
                        >
                          Tomar Apunte
                        </Button>
                      )}
                    </div>
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
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            ¿Deseas retirar esta cátedra de tu horario semanal? La materia y tus apuntes permanecerán guardados.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setSlotToDelete(null)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Retirar
            </button>
          </div>
        </div>
      </Modal>

      {/* Botón Flotante Reubicable (FAB con Snap a Bordes y seguimiento en scroll) */}
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
