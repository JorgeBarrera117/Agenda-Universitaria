import React, { useState } from 'react';
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
  Globe,
} from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import { ScheduleSlotForm } from './ScheduleSlotForm';
import { Modal } from '../../../shared/components/Modal';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
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

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onNavigateToNotes }) => {
  const { slots, isLoading, addSlot, updateSlot, removeSlot } = useSchedule();
  const { getSubjectById } = useSubjects();
  const { getProfessorById } = useProfessors();
  const { settings } = useAppSettings();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-cove-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

  return (
    <div className="space-y-4">
      {/* 1. CENTRO DE CONTROL EN VIVO (UX PENSAMIENTO DE DISEÑO - ULTRA SLEEK Y COMPACTO) */}
      {(activeClassNow || nextClassToday || todaySlots.length > 0) && (
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-cove-navy via-cove-deep to-cove-blue text-white p-3 sm:py-3 sm:px-5 shadow-lg border border-cove-sky/30">
          {/* Elementos decorativos de fondo sutiles */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-cove-sky/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-36 h-36 bg-cove-blue/20 rounded-full blur-xl pointer-events-none" />

          {activeClassNow ? (
            // A. ESTADO: EN CLASE AHORA
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1 sm:space-y-1.5 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  EN CLASE AHORA MISMO
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                    {getSubjectById(activeClassNow.subjectId)?.name || 'Clase Universitaria'}
                    {getSubjectById(activeClassNow.subjectId)?.code && (
                      <Badge variant="navy" size="xs">
                        {getSubjectById(activeClassNow.subjectId)?.code}
                      </Badge>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-200">
                    <span className="flex items-center gap-1 font-mono text-cove-gold font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {activeClassNow.startTime} - {activeClassNow.endTime}
                    </span>
                    {isSlotVirtual(activeClassNow) ? (
                      <span className="flex items-center gap-1 text-white bg-indigo-500/30 border border-indigo-300/40 px-2 py-0.5 rounded-lg font-bold text-[11px]">
                        <Laptop className="w-3.5 h-3.5 text-sky-300" />
                        <span>Clase Virtual {activeClassNow.classroom && activeClassNow.classroom.toLowerCase() !== 'virtual' ? `• ${activeClassNow.classroom}` : ''}</span>
                      </span>
                    ) : (
                      activeClassNow.classroom && (
                        <span className="flex items-center gap-1 text-white bg-white/15 px-2 py-0.5 rounded-lg text-[11px]">
                          <Building2 className="w-3.5 h-3.5 text-cove-sky" />
                          <span>
                            {activeClassNow.classroom}
                            {activeClassNow.building && ` (${activeClassNow.building})`}
                          </span>
                        </span>
                      )
                    )}
                    {getProfessorById(activeClassNow.professorId) && (
                      <span className="flex items-center gap-1 text-slate-200 text-xs">
                        <ProfessorAvatar
                          name={getProfessorById(activeClassNow.professorId)!.name}
                          icon={getProfessorById(activeClassNow.professorId)?.icon}
                          color={getProfessorById(activeClassNow.professorId)?.color}
                          size="xs"
                        />
                        {getProfessorById(activeClassNow.professorId)?.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Atajo 1-tap UX: Tomar apunte de la clase actual */}
              {onNavigateToNotes && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onNavigateToNotes(activeClassNow.subjectId)}
                  className="bg-gradient-to-r from-cove-gold to-amber-400 text-cove-navy font-black shadow-md shadow-cove-gold/25 hover:from-amber-300 hover:to-amber-400 shrink-0 self-start md:self-center"
                  icon={<FileEdit className="w-3.5 h-3.5 text-cove-navy" />}
                >
                  Tomar Apunte
                </Button>
              )}
            </div>
          ) : nextClassToday ? (
            // B. ESTADO: SIGUIENTE CLASE HOY (Línea compacta de alta densidad)
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cove-gold/20 text-cove-gold border border-cove-gold/40 shrink-0">
                  <Sparkles className="w-3 h-3" />
                  PRÓXIMA CLASE HOY
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white truncate max-w-[280px] sm:max-w-[380px]">
                  {getSubjectById(nextClassToday.subjectId)?.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="font-mono text-cove-gold font-bold">
                    Inicia a las {nextClassToday.startTime}
                  </span>
                  {nextClassToday.classroom && (
                    <span className="flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3 h-3 text-cove-sky" />
                      {nextClassToday.classroom}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-slate-400 shrink-0">
                <span>Total hoy: </span>
                <span className="font-mono font-bold text-cove-sand">
                  {todaySlots.length} {todaySlots.length === 1 ? 'clase' : 'clases'}
                </span>
              </div>
            </div>
          ) : (
            // C. ESTADO: CLASES COMPLETADAS HOY
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">¡Jornada de hoy completada!</h4>
                  <p className="text-[11px] sm:text-xs text-slate-300 hidden sm:block">
                    Has terminado todas tus clases del día. Aprovecha para repasar tus apuntes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. ENCABEZADO Y SELECTOR DE VISTAS */}
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
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 hidden sm:block">
            Planificación de bloques lectivos, aulas y cátedras universitarias.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Alternar vista diaria / semanal */}
          <div className="hidden sm:flex items-center bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-300/60 dark:border-slate-700/60 shadow-xs">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-white dark:bg-slate-700 text-cove-navy dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Semana
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-white dark:bg-slate-700 text-cove-navy dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Por Día
            </button>
          </div>

          <div className="hidden sm:block">
            <Button
              variant="primary"
              size="md"
              icon={<CalendarPlus className="w-4 h-4" />}
              onClick={() => handleOpenCreate(selectedDay)}
            >
              Nueva Clase
            </Button>
          </div>
        </div>
      </div>

      {/* 3. SELECTOR DE DÍAS (Visible solo en vista diaria en desktop, o en móvil) */}
      <div className={viewMode === 'weekly' ? 'block sm:hidden' : 'block'}>
        <div className="bg-slate-200/60 dark:bg-slate-900/60 p-1.5 sm:p-2 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div className="flex items-stretch gap-1.5 sm:gap-2.5 overflow-x-auto custom-scrollbar pb-0.5">
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
                  className={`relative flex-1 min-w-[50px] sm:min-w-[74px] py-2 sm:py-3 px-2 rounded-2xl text-center border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-cove-navy dark:bg-blue-600 text-white border-cove-navy dark:border-blue-500 shadow-md shadow-cove-navy/25 dark:shadow-blue-600/30 ring-2 ring-cove-sky/40 dark:ring-blue-400/40'
                      : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs'
                  }`}
                >
                  {/* Indicador de "Hoy": Micro-badge absoluto en esquina para no alterar el centrado geométrico del texto */}
                  {isToday && (
                    <span
                      className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 rounded-full ${
                        isSelected
                          ? 'bg-cove-gold ring-2 ring-cove-navy dark:ring-blue-600 animate-pulse'
                          : 'bg-amber-500 ring-2 ring-white dark:ring-slate-800'
                      }`}
                      title="Hoy"
                    />
                  )}

                  {/* Día de la semana perfectamente centrado */}
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider block leading-tight text-center">
                    {SHORT_DAY_NAMES[day as DayOfWeek]}
                  </span>

                  {/* Conteo de bloques con contraste de alta legibilidad */}
                  <div
                    className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 font-semibold truncate ${
                      isSelected ? 'text-cove-sky dark:text-sky-200' : 'text-slate-400 dark:text-slate-400'
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

      {/* 4. VISTA SEMANAL (Cuadrícula Responsiva Desktop / Laptop con Tarjetas Verticales de Ancho Completo) */}
      {viewMode === 'weekly' && (
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <div
            className={`hidden sm:grid ${
              displayedDays.length === 7
                ? 'grid-cols-7 min-w-[1260px] 2xl:min-w-0'
                : displayedDays.length === 6
                ? 'grid-cols-6 min-w-[1080px] 2xl:min-w-0'
                : 'grid-cols-5 min-w-[900px] xl:min-w-0'
            } gap-3 bg-slate-200/60 dark:bg-slate-900/60 p-3 sm:p-3.5 rounded-3xl border border-slate-200 dark:border-slate-800`}
          >
            {displayedDays.map((day) => {
              const daySlotsList = slots
                .filter((s) => s.dayOfWeek === day)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
              const isToday = currentDayOfWeek === day;

              return (
                <div
                  key={day}
                  className={`flex flex-col gap-2.5 rounded-2xl p-2.5 sm:p-3 transition-colors ${
                    isToday
                      ? 'bg-white dark:bg-slate-900 border-2 border-cove-sky/80 shadow-sm'
                      : 'bg-slate-100/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80'
                  }`}
                >
                  {/* Encabezado del Día */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/90 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-black uppercase tracking-wider ${
                          isToday ? 'text-cove-blue dark:text-cove-sky' : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {DAY_NAMES[day]}
                      </span>
                      {isToday && (
                        <span className="w-2 h-2 rounded-full bg-cove-gold ring-1 ring-white shrink-0" />
                      )}
                    </div>
                    <button
                      onClick={() => handleOpenCreate(day)}
                      className="p-1 text-slate-400 hover:text-cove-blue dark:hover:text-cove-sky rounded-lg hover:bg-cove-blue/10 transition-colors cursor-pointer"
                      title={`Agregar clase el ${DAY_NAMES[day]}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Lista de Bloques del Día */}
                  <div className="space-y-2.5 min-h-[300px]">
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
                            className={`rounded-2xl p-2.5 sm:p-3 border transition-all relative overflow-hidden group shadow-2xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-2 ${
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

                            {/* 1. Cabecera compacta: Ícono + Código y Botones de Acción Superiores */}
                            <div className="flex items-center justify-between gap-1 pt-0.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {/* Badge con Ícono y Color */}
                                <div
                                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-white shadow-2xs shrink-0 ring-1 ring-white/60"
                                  style={{ backgroundColor: subject?.color || '#006BBB' }}
                                  title={subject?.name}
                                >
                                  <SubjectIcon icon={subject?.icon} className="w-3.5 h-3.5 text-white" />
                                </div>

                                {/* Código de Asignatura */}
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black text-white bg-cove-navy shadow-2xs tracking-wider truncate max-w-[65px] sm:max-w-[85px]">
                                  {subject?.code || 'CLASE'}
                                </span>
                              </div>

                              {/* Botones de Acción Superiores alineados a la derecha */}
                              <div className="flex items-center gap-1 shrink-0">
                                {onNavigateToNotes && (
                                  <Button
                                    variant="action-indigo"
                                    size="icon-xs"
                                    onClick={() => onNavigateToNotes(slot.subjectId)}
                                    title="Tomar apunte"
                                    aria-label="Tomar apunte"
                                    icon={<FileEdit className="w-3 h-3 text-white" />}
                                  />
                                )}
                                <Button
                                  variant="action-blue"
                                  size="icon-xs"
                                  onClick={() => handleOpenEdit(slot)}
                                  title="Editar clase"
                                  aria-label="Editar clase"
                                  icon={<Edit2 className="w-3 h-3 text-white" />}
                                />
                                <Button
                                  variant="action-rose"
                                  size="icon-xs"
                                  onClick={() => setSlotToDelete(slot)}
                                  title="Eliminar clase"
                                  aria-label="Eliminar clase"
                                  icon={<Trash2 className="w-3 h-3 text-white" />}
                                />
                              </div>
                            </div>

                            {/* 2. Nombre de la Materia (100% de Ancho Disponible) */}
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-cove-blue dark:group-hover:text-cove-sky transition-colors leading-snug line-clamp-2">
                              {subject?.name || 'Materia'}
                            </h4>

                            {/* 3. Cuerpo de Información Completo */}
                            <div className="space-y-1 text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
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
                                <div className="flex items-center gap-1.5 pt-0.5 text-[10px] sm:text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                                  <ProfessorAvatar
                                    name={professor.name}
                                    icon={professor.icon}
                                    color={professor.color}
                                    size="xs"
                                  />
                                  <span className="truncate leading-tight font-semibold">{professor.name}</span>
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
      )}

      {/* 5. VISTA DIARIA (Móvil / Pases de Aula Detallados) */}
      <div className={viewMode === 'weekly' ? 'block sm:hidden space-y-3.5' : 'space-y-3.5'}>
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Horario para el día
            </span>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {DAY_NAMES[selectedDay]}
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-cove-blue/10 dark:bg-cove-sky/15 text-cove-blue dark:text-cove-sky border border-cove-sky/30 dark:border-cove-sky/40">
            {daySlots.length} {daySlots.length === 1 ? 'materia' : 'materias'}
          </span>
        </div>

        {daySlots.length === 0 ? (
          <div className="text-center py-14 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 shadow-xs">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Sin clases agendadas para el {DAY_NAMES[selectedDay]}
            </p>
            <button
              onClick={() => handleOpenCreate(selectedDay)}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-cove-blue/10 dark:bg-cove-blue/20 text-cove-blue dark:text-cove-sky text-xs font-bold rounded-xl hover:bg-cove-blue/20 dark:hover:bg-cove-blue/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Programar clase para este día
            </button>
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
                    className={`flex flex-row items-stretch justify-between gap-3 group ${
                      isNow
                        ? 'border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/10'
                        : ''
                    }`}
                  >
                    {/* Contenido Principal (Izquierda) */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        {/* Encabezado: Código, Estado en vivo y Modalidad */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-black text-white shadow-2xs"
                            style={{ backgroundColor: subject?.color || '#006BBB' }}
                          >
                            <SubjectIcon icon={subject?.icon} className="w-3 h-3 shrink-0" />
                            <span>{subject?.code || 'CLASE'}</span>
                          </span>

                          {/* Modalidad Badge */}
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
                              EN CURSO AHORA
                            </Badge>
                          )}
                        </div>

                        {/* Nombre Principal de la Materia */}
                        <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-cove-blue dark:group-hover:text-cove-sky transition-colors tracking-tight leading-snug line-clamp-1">
                          {subject?.name || 'Materia'}
                        </h4>
                      </div>

                      {/* Filas de Información del Campus / Modalidad */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 font-mono font-bold text-cove-navy dark:text-cove-sand bg-cove-blue/10 dark:bg-cove-blue/20 border border-cove-sky/25 px-2.5 py-1 rounded-xl text-xs">
                          <Clock className="w-3.5 h-3.5 text-cove-blue dark:text-cove-sky shrink-0" />
                          <span>{slot.startTime} - {slot.endTime}</span>
                        </div>

                        {isSlotVirtual(slot) ? (
                          <>
                            <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/80 px-2.5 py-1 rounded-xl truncate font-bold text-[11px]">
                              <Laptop className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                              <span className="truncate">
                                {slot.classroom && slot.classroom.toLowerCase() !== 'virtual'
                                  ? `Plataforma: ${slot.classroom}`
                                  : 'Clase Virtual / En Línea'}
                              </span>
                            </div>

                            {slot.building && (
                              <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 px-2.5 py-1 rounded-xl truncate font-medium text-[11px]">
                                <Globe className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                                <span className="truncate">{slot.building}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {slot.classroom && (
                              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1 rounded-xl truncate font-bold text-[11px]">
                                <MapPin className="w-3.5 h-3.5 text-cove-blue dark:text-cove-sky shrink-0" />
                                <span className="truncate">{slot.classroom}</span>
                              </div>
                            )}

                            {slot.building && (
                              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1 rounded-xl truncate font-medium text-[11px]">
                                <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                                <span className="truncate">{slot.building}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Credencial del Docente */}
                      {professor && (
                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <ProfessorAvatar
                              name={professor.name}
                              icon={professor.icon}
                              color={professor.color}
                              size="xs"
                              className="ring-1 ring-cove-sky/30 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none">
                                Docente
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px] block">{professor.name}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Columna Vertical de Acciones (Derecha) - Estandarizada con Átomo Button */}
                    <div className="flex flex-col justify-center items-center shrink-0 pl-1.5 sm:pl-2 py-0.5 gap-2 sm:gap-2.5">
                      {/* Botón 1: Tomar apunte */}
                      {onNavigateToNotes ? (
                        <Button
                          variant="action-indigo"
                          size="icon-md"
                          onClick={() => onNavigateToNotes(slot.subjectId)}
                          title="Tomar apunte de esta materia"
                          aria-label="Tomar apunte"
                          icon={<FileEdit className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-11 sm:h-11" />
                      )}

                      {/* Botón 2: Editar clase */}
                      <Button
                        variant="action-blue"
                        size="icon-md"
                        onClick={() => handleOpenEdit(slot)}
                        title="Editar clase"
                        aria-label="Editar clase"
                        icon={<Edit2 className="w-4 h-4 text-white" />}
                      />

                      {/* Botón 3: Eliminar clase */}
                      <Button
                        variant="action-rose"
                        size="icon-md"
                        onClick={() => setSlotToDelete(slot)}
                        title="Eliminar clase"
                        aria-label="Eliminar clase"
                        icon={<Trash2 className="w-4 h-4 text-white" />}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      {/* Modal Crear / Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSlot ? 'Modificar Cátedra Universitaria' : 'Programar Cátedra en el Horario'}
      >
        <ScheduleSlotForm
          key={editingSlot?.id || 'new-slot'}
          initialData={editingSlot}
          defaultDay={selectedDay}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={slotToDelete !== null}
        onClose={() => setSlotToDelete(null)}
        title="¿Retirar Clase del Horario?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            ¿Deseas retirar esta cátedra de tu horario semanal? La materia y tus apuntes permanecerán guardados.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setSlotToDelete(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Retirar
            </button>
          </div>
        </div>
      </Modal>

      {/* Botón Flotante Móvil Reubicable (FAB con Snap a Bordes) */}
      <DraggableFAB
        colorScheme="schedule"
        onClick={() => handleOpenCreate(selectedDay)}
        label="Programar Nueva Cátedra"
        icon={<CalendarPlus className="w-7 h-7 text-white stroke-[2.2]" />}
      />
    </div>
  );
};
