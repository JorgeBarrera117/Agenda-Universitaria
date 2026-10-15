import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  Calendar,
  LayoutGrid,
  List,
  Sparkles,
  FileEdit,
  Building2,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { ScheduleSlotForm } from './ScheduleSlotForm';
import { Modal } from '../../../shared/components/Modal';
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

export const ScheduleView: React.FC<ScheduleViewProps> = ({ onNavigateToNotes }) => {
  const { slots, isLoading, addSlot, updateSlot, removeSlot } = useSchedule();
  const { getSubjectById } = useSubjects();
  const { getProfessorById } = useProfessors();

  // Día actual del sistema (1 = Lunes, ..., 7 = Domingo)
  const currentDayOfWeek = (() => {
    const day = new Date().getDay();
    return (day === 0 ? 7 : day) as DayOfWeek;
  })();

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(currentDayOfWeek);
  const [viewMode, setViewMode] = useState<'weekly' | 'daily'>('weekly');
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

  // Días a mostrar
  const hasSaturday = slots.some((s) => s.dayOfWeek === 6);
  const hasSunday = slots.some((s) => s.dayOfWeek === 7);
  const displayedDays: DayOfWeek[] = [1, 2, 3, 4, 5];
  if (hasSaturday || selectedDay === 6) displayedDays.push(6);
  if (hasSunday || selectedDay === 7) displayedDays.push(7);

  const daySlots = slots
    .filter((s) => s.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-6">
      {/* 1. CENTRO DE CONTROL EN VIVO (UX PENSAMIENTO DE DISEÑO) */}
      {(activeClassNow || nextClassToday || todaySlots.length > 0) && (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cove-navy via-cove-deep to-cove-blue text-white p-6 shadow-xl border border-cove-sky/30">
          {/* Elementos decorativos de fondo sutiles */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-cove-sky/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-36 h-36 bg-cove-blue/20 rounded-full blur-xl pointer-events-none" />

          {activeClassNow ? (
            // A. ESTADO: EN CLASE AHORA
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  EN CLASE AHORA MISMO
                </div>

                <div>
                  <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                    {getSubjectById(activeClassNow.subjectId)?.name || 'Clase Universitaria'}
                    {getSubjectById(activeClassNow.subjectId)?.code && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 text-cove-sand">
                        {getSubjectById(activeClassNow.subjectId)?.code}
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-medium text-slate-200">
                    <span className="flex items-center gap-1.5 font-mono text-cove-gold font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {activeClassNow.startTime} - {activeClassNow.endTime}
                    </span>
                    {activeClassNow.classroom && (
                      <span className="flex items-center gap-1.5 text-white bg-white/15 px-2.5 py-0.5 rounded-lg">
                        <MapPin className="w-3.5 h-3.5 text-cove-sky" />
                        {activeClassNow.classroom}
                        {activeClassNow.building && ` (${activeClassNow.building})`}
                      </span>
                    )}
                    {getProfessorById(activeClassNow.professorId) && (
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <span className="w-5 h-5 rounded-full bg-cove-sky/30 flex items-center justify-center text-[10px] font-bold text-cove-sand">
                          {getProfessorById(activeClassNow.professorId)?.name.charAt(0)}
                        </span>
                        {getProfessorById(activeClassNow.professorId)?.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Atajo 1-tap UX: Tomar apunte de la clase actual */}
              {onNavigateToNotes && (
                <button
                  onClick={() => onNavigateToNotes(activeClassNow.subjectId)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cove-gold to-amber-400 hover:from-amber-300 hover:to-amber-400 text-cove-navy text-sm font-extrabold shadow-lg shadow-cove-gold/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0"
                >
                  <FileEdit className="w-4 h-4 text-cove-navy" />
                  Tomar Apunte de esta Clase
                </button>
              )}
            </div>
          ) : nextClassToday ? (
            // B. ESTADO: SIGUIENTE CLASE HOY
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cove-gold/20 text-cove-gold border border-cove-gold/40 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  PRÓXIMA CLASE HOY
                </div>
                <h3 className="text-xl font-extrabold text-white">
                  {getSubjectById(nextClassToday.subjectId)?.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-300">
                  <span className="font-mono text-cove-gold font-bold">
                    Inicia a las {nextClassToday.startTime}
                  </span>
                  {nextClassToday.classroom && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-cove-sky" />
                      {nextClassToday.classroom}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400">Total clases hoy:</span>
                <span className="ml-2 font-mono font-bold text-cove-sand">
                  {todaySlots.length} asignaturas
                </span>
              </div>
            </div>
          ) : (
            // C. ESTADO: CLASES COMPLETADAS HOY
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">¡Jornada de hoy completada!</h4>
                  <p className="text-xs text-slate-300">
                    Has terminado todas tus clases del día. Aprovecha para repasar tus apuntes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. ENCABEZADO Y SELECTOR DE VISTAS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Horario Académico
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Planificación de bloques lectivos, aulas y cátedras universitarias.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Alternar vista diaria / semanal */}
          <div className="hidden sm:flex items-center bg-slate-200/80 p-1 rounded-2xl border border-slate-300/60 shadow-xs">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-white text-cove-navy shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Semana
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-white text-cove-navy shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Por Día
            </button>
          </div>

          <button
            onClick={() => handleOpenCreate(selectedDay)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md shadow-cove-blue/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Clase
          </button>
        </div>
      </div>

      {/* 3. SELECTOR DE DÍAS (Píldoras estilo Campus) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {(hasSaturday || hasSunday ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5]).map((day) => {
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
              className={`flex-1 min-w-[76px] py-3 px-2 rounded-2xl text-center border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-cove-navy text-white border-cove-navy shadow-md ring-2 ring-cove-sky/40'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="text-[10px] font-bold tracking-wider uppercase opacity-75">
                {SHORT_DAY_NAMES[day as DayOfWeek]}
              </div>
              <div className="text-sm font-black flex items-center justify-center gap-1 mt-0.5">
                {DAY_NAMES[day as DayOfWeek].slice(0, 3)}
                {isToday && (
                  <span className="w-2 h-2 rounded-full bg-cove-gold ring-2 ring-white/50" />
                )}
              </div>
              <div
                className={`text-[10px] mt-1 font-semibold ${
                  isSelected ? 'text-cove-sand' : 'text-slate-400'
                }`}
              >
                {count} {count === 1 ? 'bloque' : 'bloques'}
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. VISTA SEMANAL (Cuadrícula Desktop estilo Tarjeta de Cátedra) */}
      {viewMode === 'weekly' && (
        <div className="hidden sm:grid grid-cols-5 gap-3.5 bg-slate-200/50 p-3.5 rounded-3xl border border-slate-200">
          {displayedDays.map((day) => {
            const daySlotsList = slots
              .filter((s) => s.dayOfWeek === day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const isToday = currentDayOfWeek === day;

            return (
              <div
                key={day}
                className={`flex flex-col gap-2.5 rounded-2xl p-3 transition-colors ${
                  isToday
                    ? 'bg-white border-2 border-cove-sky/60 shadow-sm'
                    : 'bg-slate-100/70 border border-slate-200/70'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        isToday ? 'text-cove-blue' : 'text-slate-700'
                      }`}
                    >
                      {DAY_NAMES[day]}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cove-blue" />
                    )}
                  </div>
                  <button
                    onClick={() => handleOpenCreate(day)}
                    className="p-1 text-slate-400 hover:text-cove-blue rounded-lg hover:bg-cove-blue/10 transition-colors cursor-pointer"
                    title={`Agregar clase el ${DAY_NAMES[day]}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 min-h-[320px]">
                  {daySlotsList.length === 0 ? (
                    <div className="h-full flex items-center justify-center py-12 text-center text-xs text-slate-400 font-medium italic">
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
                          className={`bg-white rounded-2xl p-3.5 border transition-all relative overflow-hidden group shadow-2xs hover:shadow-md hover:-translate-y-0.5 ${
                            isNow
                              ? 'border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/10'
                              : 'border-slate-200/90 hover:border-cove-sky/60'
                          }`}
                        >
                          {/* Acento superior de Materia */}
                          <div
                            className="absolute top-0 left-0 right-0 h-1"
                            style={{ backgroundColor: subject?.color || '#006BBB' }}
                          />

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-mono font-black text-white bg-cove-navy px-1.5 py-0.5 rounded-md shadow-2xs">
                                {subject?.code || 'CLASE'}
                              </span>

                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => handleOpenEdit(slot)}
                                  className="p-1 text-slate-400 hover:text-cove-blue hover:bg-cove-blue/10 rounded-lg transition-colors cursor-pointer"
                                  title="Editar bloque"
                                  aria-label="Editar"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setSlotToDelete(slot)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar bloque"
                                  aria-label="Eliminar"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <h4 className="text-xs font-black text-slate-900 line-clamp-2 leading-snug group-hover:text-cove-blue transition-colors">
                              {subject?.name || 'Materia'}
                            </h4>

                            <div className="space-y-1.5 pt-1 text-[11px]">
                              {/* Rango Horario en Cove Blue / Navy */}
                              <div className="flex items-center gap-1 font-mono font-bold text-cove-navy bg-cove-blue/10 border border-cove-sky/20 px-2 py-0.5 rounded-lg">
                                <Clock className="w-3 h-3 text-cove-blue shrink-0" />
                                <span>{slot.startTime} - {slot.endTime}</span>
                              </div>

                              {/* Aula y Ubicación */}
                              {slot.classroom && (
                                <div className="flex items-center gap-1 text-slate-700 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-lg truncate">
                                  <MapPin className="w-3 h-3 text-cove-blue shrink-0" />
                                  <span className="truncate font-semibold">{slot.classroom}</span>
                                </div>
                              )}

                              {/* Docente con micro-avatar */}
                              {professor && (
                                <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-600 truncate font-medium">
                                  <div className="w-4 h-4 rounded-full bg-cove-navy text-cove-sand flex items-center justify-center text-[8px] font-black shrink-0">
                                    {professor.name.charAt(0)}
                                  </div>
                                  <span className="truncate">{professor.name}</span>
                                </div>
                              )}
                            </div>
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
      )}

      {/* 5. VISTA DIARIA (Móvil / Pases de Aula Detallados) */}
      {(viewMode === 'daily' || window.innerWidth < 640) && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Horario para el día
              </span>
              <h3 className="text-base font-black text-slate-900">
                {DAY_NAMES[selectedDay]}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-cove-blue/10 text-cove-blue">
              {daySlots.length} {daySlots.length === 1 ? 'materia' : 'materias'}
            </span>
          </div>

          {daySlots.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-3xl border border-dashed border-slate-300 p-8">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">
                Sin clases agendadas para el {DAY_NAMES[selectedDay]}
              </p>
              <button
                onClick={() => handleOpenCreate(selectedDay)}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-cove-blue/10 text-cove-blue text-xs font-bold rounded-xl hover:bg-cove-blue/20 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Programar clase para este día
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {daySlots.map((slot) => {
                const subject = getSubjectById(slot.subjectId);
                const professor = getProfessorById(slot.professorId);
                const isNow =
                  selectedDay === currentDayOfWeek &&
                  nowTimeString >= slot.startTime &&
                  nowTimeString < slot.endTime;

                return (
                  <div
                    key={slot.id}
                    className={`bg-white rounded-3xl p-5 sm:p-6 border shadow-2xs hover:shadow-lg transition-all relative overflow-hidden flex flex-row items-stretch justify-between gap-3 sm:gap-4 group hover:border-cove-sky/60 hover:-translate-y-0.5 ${
                      isNow
                        ? 'border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/10'
                        : 'border-slate-200/90'
                    }`}
                  >
                    {/* Acento superior de Asignatura */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: subject?.color || '#006BBB' }}
                    />

                    {/* Contenido Principal (Izquierda) */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3.5">
                      <div className="space-y-2.5">
                        {/* Encabezado: Código y Estado en vivo */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black text-white shadow-2xs"
                            style={{ backgroundColor: subject?.color || '#006BBB' }}
                          >
                            <BookOpen className="w-3.5 h-3.5 shrink-0" />
                            <span>{subject?.code || 'CLASE'}</span>
                          </span>

                          {isNow && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              EN CURSO AHORA
                            </span>
                          )}
                        </div>

                        {/* Nombre Principal de la Materia */}
                        <h4 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-cove-blue transition-colors tracking-tight leading-snug">
                          {subject?.name || 'Materia'}
                        </h4>
                      </div>

                      {/* Filas de Información del Campus apiladas */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2.5 font-mono font-black text-cove-navy bg-cove-blue/10 border border-cove-sky/25 px-3.5 py-2 rounded-2xl">
                          <Clock className="w-4 h-4 text-cove-blue shrink-0" />
                          <span>{slot.startTime} - {slot.endTime}</span>
                        </div>

                        {slot.classroom && (
                          <div className="flex items-center gap-2 text-slate-800 bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-2xl truncate font-bold">
                            <MapPin className="w-4 h-4 text-cove-blue shrink-0" />
                            <span className="truncate">{slot.classroom}</span>
                          </div>
                        )}

                        {slot.building && (
                          <div className="flex items-center gap-2 text-slate-600 bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-2xl truncate font-medium">
                            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate">{slot.building}</span>
                          </div>
                        )}
                      </div>

                      {/* Credencial del Docente */}
                      {professor && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-cove-navy text-cove-sand flex items-center justify-center font-black text-xs ring-1 ring-cove-sky/30">
                              {professor.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                                Docente a cargo
                              </span>
                              <span className="font-bold text-slate-800">{professor.name}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Columna Vertical de Acciones (Derecha) - Distribución según diseño solicitado */}
                    <div className="flex flex-col justify-between items-center shrink-0 pl-2 sm:pl-3 border-l border-slate-100 py-0.5">
                      {/* Botón 1: Tomar apunte (Superior destacado en paleta Cove Sand) */}
                      {onNavigateToNotes ? (
                        <button
                          onClick={() => onNavigateToNotes(slot.subjectId)}
                          className="w-11 h-11 rounded-2xl bg-cove-sand/60 hover:bg-cove-sand border border-cove-gold/70 text-cove-navy flex items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer"
                          title="Tomar apunte de esta materia"
                          aria-label="Tomar apunte"
                        >
                          <FileEdit className="w-5 h-5 text-cove-navy" />
                        </button>
                      ) : (
                        <div className="w-11 h-11" />
                      )}

                      {/* Botón 2: Editar clase (Centro) */}
                      <button
                        onClick={() => handleOpenEdit(slot)}
                        className="w-11 h-11 rounded-2xl bg-slate-50 hover:bg-cove-blue/10 border border-slate-200/80 text-slate-500 hover:text-cove-blue flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                        title="Editar clase"
                        aria-label="Editar clase"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Botón 3: Eliminar clase (Inferior) */}
                      <button
                        onClick={() => setSlotToDelete(slot)}
                        className="w-11 h-11 rounded-2xl bg-slate-50 hover:bg-red-50 border border-slate-200/80 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                        title="Eliminar clase"
                        aria-label="Eliminar clase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Crear / Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSlot ? 'Modificar Cátedra Universitaria' : 'Programar Cátedra en el Horario'}
      >
        <ScheduleSlotForm
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
    </div>
  );
};
