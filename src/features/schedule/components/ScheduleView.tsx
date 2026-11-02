import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const currentDayOfWeek = useMemo(() => {
    const day = new Date().getDay();
    return (day === 0 ? 7 : day) as DayOfWeek;
  }, []);

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

  // Hora actual en formato "HH:mm"
  const now = new Date();
  const nowTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  // Clases de hoy memoizadas
  const todaySlots = useMemo(() => {
    return slots
      .filter((s) => s.dayOfWeek === currentDayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots, currentDayOfWeek]);

  // Clase en curso ahora mismo
  const activeClassNow = useMemo(() => {
    return todaySlots.find(
      (s) => nowTimeString >= s.startTime && nowTimeString < s.endTime
    );
  }, [todaySlots, nowTimeString]);

  // Próxima clase hoy
  const nextClassToday = useMemo(() => {
    return todaySlots.find((s) => s.startTime > nowTimeString);
  }, [todaySlots, nowTimeString]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Horario Académico
            </h2>
            <Badge variant="primary" size="sm">
              {settings.semesterName}
            </Badge>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
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
        </div>
      </div>

      {/* 2. TARJETA HERO DE EVENTOS DE HOY / PRÓXIMA CLASE (Diseño M3 Prominente Solicitado) */}
      {activeClassNow ? (
        // Estado A: Clase en Curso Ahora
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] p-3.5 sm:p-5 shadow-xs border border-[#00639B]/25 dark:border-white/10">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#C4EED0] dark:bg-[#0A532C] text-[#00210E] dark:text-[#C4EED0] border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                EN CLASE AHORA MISMO
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-bold tracking-tight text-[#001D32] dark:text-[#D0E4FF] truncate">
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
                    <span className="inline-flex items-center gap-1 bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg font-medium text-[11px]">
                      <Building2 className="w-3.5 h-3.5 text-[#00639B] dark:text-[#96CCFF]" />
                      <span>{activeClassNow.classroom}{activeClassNow.building ? ` (${activeClassNow.building})` : ''}</span>
                    </span>
                  )
                )}
                {getProfessorById(activeClassNow.professorId) && (
                  <span className="inline-flex items-center gap-1 bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg text-[11px]">
                    <span className="font-medium truncate max-w-[160px]">Prof. {getProfessorById(activeClassNow.professorId)?.name}</span>
                  </span>
                )}
              </div>
            </div>

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
        </section>
      ) : nextClassToday ? (
        // Estado B: Próxima Clase Hoy (Hero Card M3 rica y prominente preferida por los usuarios)
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] p-3.5 sm:p-5 shadow-xs border border-[#00639B]/25 dark:border-white/10">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFDCC1] dark:bg-[#683D00] text-[#2E1500] dark:text-[#FFDCC1] border border-amber-500/20 shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                  PRÓXIMA CLASE HOY
                </div>
                {/* Resumen en pantallas móviles */}
                <div className="flex items-center gap-1 sm:hidden text-xs font-medium bg-white/60 dark:bg-black/30 px-2.5 py-0.5 rounded-lg">
                  <span className="opacity-80">Total hoy:</span>
                  <span className="font-mono font-bold">
                    {todaySlots.length} {todaySlots.length === 1 ? 'clase' : 'clases'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-bold tracking-tight text-[#001D32] dark:text-[#D0E4FF] truncate">
                  {getSubjectById(nextClassToday.subjectId)?.name || 'Clase Universitaria'}
                </h3>
                {getSubjectById(nextClassToday.subjectId)?.code && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-mono font-black bg-black text-white dark:bg-white dark:text-black tracking-wider shadow-2xs">
                    {getSubjectById(nextClassToday.subjectId)?.code}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-medium pt-0.5">
                <span className="inline-flex items-center gap-1 font-mono font-bold bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg text-xs">
                  <Clock className="w-3.5 h-3.5 text-[#00639B] dark:text-[#96CCFF]" />
                  Inicia a las {nextClassToday.startTime}
                </span>

                {isSlotVirtual(nextClassToday) ? (
                  <span className="inline-flex items-center gap-1 bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                    <Laptop className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Virtual {nextClassToday.classroom && nextClassToday.classroom.toLowerCase() !== 'virtual' ? `• ${nextClassToday.classroom}` : ''}</span>
                  </span>
                ) : (
                  nextClassToday.classroom && (
                    <span className="inline-flex items-center gap-1 bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg font-medium text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-[#00639B] dark:text-[#96CCFF]" />
                      <span>{nextClassToday.classroom}{nextClassToday.building ? ` (${nextClassToday.building})` : ''}</span>
                    </span>
                  )
                )}

                {getProfessorById(nextClassToday.professorId) && (
                  <span className="inline-flex items-center gap-1 bg-white/70 dark:bg-black/30 px-2.5 py-1 rounded-lg text-[11px]">
                    <span className="font-medium truncate max-w-[160px]">Prof. {getProfessorById(nextClassToday.professorId)?.name}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Resumen en pantallas medianas y de escritorio */}
            <div className="hidden sm:flex flex-col items-end gap-1 text-xs shrink-0 font-medium">
              <span className="opacity-80">Total hoy:</span>
              <span className="font-mono font-bold text-sm bg-white/60 dark:bg-black/30 px-3 py-1 rounded-lg">
                {todaySlots.length} {todaySlots.length === 1 ? 'clase' : 'clases'}
              </span>
            </div>
          </div>
        </section>
      ) : todaySlots.length > 0 ? (
        // Estado C: Jornada finalizada
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl sm:rounded-3xl bg-[#C4EED0]/40 dark:bg-[#0A532C]/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-500/20 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#C4EED0] dark:bg-[#0A532C] text-[#00210E] dark:text-[#C4EED0] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
                ¡Jornada de hoy completada!
              </h4>
              <p className="text-[11px] sm:text-xs opacity-80 hidden sm:block">
                Has terminado todas tus clases del día ({todaySlots.length} {todaySlots.length === 1 ? 'clase cursada' : 'clases cursadas'}). Aprovecha para repasar tus apuntes.
              </p>
            </div>
          </div>
        </div>
      ) : null}

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
                        <div className="h-full flex items-center justify-center py-8 text-center text-[11px] text-slate-400 dark:text-slate-500 italic">
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
                                  : `linear-gradient(155deg, ${subject?.color || '#006BBB'}15 0%, ${subject?.color || '#006BBB'}04 100%), var(--card-bg, #ffffff)`,
                                borderColor: isNow ? undefined : `${subject?.color || '#006BBB'}40`,
                              }}
                              className={`rounded-xl p-2 border transition-all relative overflow-hidden group shadow-2xs hover:shadow-xs flex flex-col justify-between gap-1 ${
                                isNow
                                  ? 'border-emerald-500 ring-2 ring-emerald-400/50 bg-emerald-50/20'
                                  : 'hover:border-cove-sky/80'
                              }`}
                            >
                              {/* Barra superior de acento */}
                              <div
                                className="absolute top-0 left-0 right-0 h-1 opacity-90"
                                style={{ backgroundColor: subject?.color || '#006BBB' }}
                              />

                              {/* Fila 1: Hora + Botones de Acción */}
                              <div className="flex items-center justify-between gap-1 pt-0.5">
                                <span className="font-mono font-bold text-[10px] text-[#00639B] dark:text-[#96CCFF]">
                                  {slot.startTime} - {slot.endTime}
                                </span>

                                {/* Menú Contextual M3 (Kebab ⋮) */}
                                <M3KebabMenu
                                  size="sm"
                                  items={[
                                    {
                                      id: 'edit',
                                      label: 'Editar clase',
                                      icon: <Edit2 className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />,
                                      variant: 'primary',
                                      onClick: () => handleOpenEdit(slot),
                                    },
                                    ...(onNavigateToNotes
                                      ? [
                                          {
                                            id: 'notes',
                                            label: 'Tomar apunte',
                                            icon: <FileEdit className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
                                            onClick: () => onNavigateToNotes(slot.subjectId),
                                          },
                                        ]
                                      : []),
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

                              {/* Fila 2: Título de Materia */}
                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight line-clamp-2">
                                  {subject?.name || 'Materia'}
                                </h4>
                              </div>

                              {/* Fila 3: Aula/Modalidad + Docente */}
                              <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/40 dark:border-slate-700/40 min-w-0">
                                <span className="truncate font-medium flex items-center gap-1">
                                  {isSlotVirtual(slot) ? (
                                    <>
                                      <Laptop className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                      <span>Virtual</span>
                                    </>
                                  ) : slot.classroom ? (
                                    <>
                                      <Building2 className="w-2.5 h-2.5 text-slate-500 shrink-0" />
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
              const professor = getProfessorById(slot.professorId);
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
                  className={`flex flex-col justify-between gap-2.5 ${
                    isNow
                      ? 'border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/10'
                      : ''
                  }`}
                >
                  {/* Cabecera: Ícono + Código + Título + Acciones */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0"
                        style={{ backgroundColor: subject?.color || '#2481cc' }}
                      >
                        <SubjectIcon icon={subject?.icon} className="w-4 h-4 text-white" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9.5px] font-mono font-black bg-black text-white dark:bg-white dark:text-black">
                            {subject?.code || 'CLASE'}
                          </span>
                          {isNow && (
                            <Badge variant="success" size="xs" className="animate-pulse">
                              EN CURSO
                            </Badge>
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate leading-tight mt-0.5">
                          {subject?.name || 'Materia'}
                        </h4>
                      </div>
                    </div>

                    {/* Menú Contextual M3 (Kebab ⋮) */}
                    <M3KebabMenu
                      items={[
                        {
                          id: 'edit',
                          label: 'Editar clase',
                          icon: <Edit2 className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />,
                          variant: 'primary',
                          onClick: () => handleOpenEdit(slot),
                        },
                        ...(onNavigateToNotes
                          ? [
                              {
                                id: 'notes',
                                label: 'Tomar apunte',
                                icon: <FileEdit className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
                                onClick: () => onNavigateToNotes(slot.subjectId),
                              },
                            ]
                          : []),
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

                  {/* Fila Horario y Ubicación */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-[#001D32] dark:text-[#D0E4FF] bg-[#D0E4FF] dark:bg-[#004B76] px-2 py-0.5 rounded-lg text-[10.5px]">
                      <Clock className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF]" />
                      {slot.startTime} - {slot.endTime}
                    </span>

                    {isSlotVirtual(slot) ? (
                      <span className="inline-flex items-center gap-1 text-[#2B1700] dark:text-[#FFDCC2] bg-[#FFDCC2] dark:bg-[#683D00] px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        <Laptop className="w-3 h-3 text-[#8B5000] dark:text-[#FFB77B]" />
                        <span>Virtual</span>
                      </span>
                    ) : slot.classroom ? (
                      <span className="inline-flex items-center gap-1 text-[#191C20] dark:text-[#E2E2E6] bg-[#E2E7EF] dark:bg-[#272A2F] px-2 py-0.5 rounded-lg text-[10px] font-semibold truncate">
                        <MapPin className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF]" />
                        <span className="truncate">{slot.classroom}</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Pie de tarjeta con Docente y Botón Apunte */}
                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                    {professor ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ProfessorAvatar
                          name={professor.name}
                          icon={professor.icon}
                          color={professor.color}
                          size="xs"
                          className="shrink-0"
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[10.5px]">
                          {professor.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">
                        Sin docente
                      </span>
                    )}

                    {onNavigateToNotes && (
                      <Button
                        variant="action-indigo"
                        size="sm"
                        onClick={() => onNavigateToNotes(slot.subjectId)}
                        title="Tomar apunte"
                        aria-label="Tomar apunte"
                        icon={<FileEdit className="w-3.5 h-3.5" />}
                        className="text-[11px] py-1 px-2.5 h-7 font-bold"
                      >
                        Apunte
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
