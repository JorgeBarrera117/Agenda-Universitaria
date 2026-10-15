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
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
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
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white p-6 shadow-xl border border-indigo-900/40">
          {/* Elementos decorativos de fondo sutiles */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-36 h-36 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />

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
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 text-indigo-200">
                        {getSubjectById(activeClassNow.subjectId)?.code}
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-medium text-slate-300">
                    <span className="flex items-center gap-1.5 font-mono text-amber-300">
                      <Clock className="w-3.5 h-3.5" />
                      {activeClassNow.startTime} - {activeClassNow.endTime}
                    </span>
                    {activeClassNow.classroom && (
                      <span className="flex items-center gap-1.5 text-slate-200 bg-white/10 px-2.5 py-0.5 rounded-lg">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        {activeClassNow.classroom}
                        {activeClassNow.building && ` (${activeClassNow.building})`}
                      </span>
                    )}
                    {getProfessorById(activeClassNow.professorId) && (
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-200">
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
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-sm font-extrabold shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0"
                >
                  <FileEdit className="w-4 h-4 text-slate-950" />
                  Tomar Apunte de esta Clase
                </button>
              )}
            </div>
          ) : nextClassToday ? (
            // B. ESTADO: SIGUIENTE CLASE HOY
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  PRÓXIMA CLASE HOY
                </div>
                <h3 className="text-xl font-extrabold text-white">
                  {getSubjectById(nextClassToday.subjectId)?.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-300">
                  <span className="font-mono text-amber-300 font-bold">
                    Inicia a las {nextClassToday.startTime}
                  </span>
                  {nextClassToday.classroom && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      {nextClassToday.classroom}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400">Total clases hoy:</span>
                <span className="ml-2 font-mono font-bold text-indigo-300">
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
                  <p className="text-xs text-slate-400">
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
                  ? 'bg-white text-slate-900 shadow-sm'
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
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Por Día
            </button>
          </div>

          <button
            onClick={() => handleOpenCreate(selectedDay)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
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
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-indigo-500/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="text-[10px] font-bold tracking-wider uppercase opacity-75">
                {SHORT_DAY_NAMES[day as DayOfWeek]}
              </div>
              <div className="text-sm font-black flex items-center justify-center gap-1 mt-0.5">
                {DAY_NAMES[day as DayOfWeek].slice(0, 3)}
                {isToday && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white/50" />
                )}
              </div>
              <div
                className={`text-[10px] mt-1 font-semibold ${
                  isSelected ? 'text-indigo-300' : 'text-slate-400'
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
                    ? 'bg-white border-2 border-indigo-500/40 shadow-sm'
                    : 'bg-slate-100/70 border border-slate-200/70'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        isToday ? 'text-indigo-700' : 'text-slate-700'
                      }`}
                    >
                      {DAY_NAMES[day]}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    )}
                  </div>
                  <button
                    onClick={() => handleOpenCreate(day)}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
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
                          className={`bg-white rounded-2xl p-3 border transition-all relative overflow-hidden group shadow-2xs hover:shadow-md ${
                            isNow
                              ? 'border-emerald-500 ring-2 ring-emerald-400/30'
                              : 'border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          {/* Franja de Color de la Asignatura */}
                          <div
                            className="absolute top-0 left-0 bottom-0 w-2 rounded-l"
                            style={{ backgroundColor: subject?.color || '#4f46e5' }}
                          />

                          <div className="pl-2">
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-[11px] font-mono font-bold text-slate-500">
                                {subject?.code || 'CLASE'}
                              </span>

                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                <button
                                  onClick={() => handleOpenEdit(slot)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setSlotToDelete(slot)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <h4 className="text-xs font-black text-slate-900 line-clamp-2 mt-0.5">
                              {subject?.name || 'Materia'}
                            </h4>

                            <div className="mt-2.5 space-y-1.5 text-[11px]">
                              {/* Rango Horario */}
                              <div className="flex items-center gap-1 font-mono font-bold text-indigo-950 bg-indigo-50/70 px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span>{slot.startTime} - {slot.endTime}</span>
                              </div>

                              {/* Aula y Edificio */}
                              {slot.classroom && (
                                <div className="flex items-center gap-1 text-slate-600 truncate bg-slate-50 px-2 py-0.5 rounded-md">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate font-medium">{slot.classroom}</span>
                                </div>
                              )}

                              {/* Docente */}
                              {professor && (
                                <div className="text-[10px] text-slate-500 truncate pt-1 border-t border-slate-100 font-medium">
                                  {professor.name}
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
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
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
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
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
                    className={`bg-white rounded-3xl p-5 border shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between ${
                      isNow
                        ? 'border-emerald-500 ring-2 ring-emerald-400/30'
                        : 'border-slate-200'
                    }`}
                  >
                    <div
                      className="absolute top-0 left-0 bottom-0 w-2.5"
                      style={{ backgroundColor: subject?.color || '#4f46e5' }}
                    />

                    <div className="pl-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {subject?.code && (
                            <span className="inline-block text-[11px] font-mono font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mb-1">
                              {subject.code}
                            </span>
                          )}
                          <h4 className="text-lg font-black text-slate-900">
                            {subject?.name || 'Materia'}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1">
                          {onNavigateToNotes && (
                            <button
                              onClick={() => onNavigateToNotes(slot.subjectId)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                              title="Tomar apunte de esta materia"
                            >
                              <FileEdit className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(slot)}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                            title="Editar clase"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSlotToDelete(slot)}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                            title="Eliminar clase"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Detalles del Pase de Clase */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div className="flex items-center gap-2 font-mono font-black text-indigo-900 bg-indigo-50/80 px-3 py-2 rounded-xl">
                          <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>{slot.startTime} - {slot.endTime}</span>
                        </div>

                        {slot.classroom && (
                          <div className="flex items-center gap-2 text-slate-700 bg-slate-100/80 px-3 py-2 rounded-xl truncate">
                            <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                            <span className="truncate font-semibold">{slot.classroom}</span>
                          </div>
                        )}

                        {slot.building && (
                          <div className="flex items-center gap-2 text-slate-600 bg-slate-100/80 px-3 py-2 rounded-xl truncate">
                            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate">{slot.building}</span>
                          </div>
                        )}
                      </div>

                      {professor && (
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                          <span className="text-slate-400 font-medium">Profesor a cargo:</span>
                          <span className="font-bold text-slate-800">{professor.name}</span>
                        </div>
                      )}
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
