import React, { useState, useEffect } from 'react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { DAY_NAMES, type ScheduleSlot, type CreateScheduleSlotDTO, type DayOfWeek } from '../types';

interface ScheduleSlotFormProps {
  initialData?: ScheduleSlot;
  defaultDay?: DayOfWeek;
  onSubmit: (data: CreateScheduleSlotDTO) => Promise<void>;
  onCancel: () => void;
}

export const ScheduleSlotForm: React.FC<ScheduleSlotFormProps> = ({
  initialData,
  defaultDay = 1,
  onSubmit,
  onCancel,
}) => {
  const { subjects } = useSubjects();
  const { professors } = useProfessors();

  const [subjectId, setSubjectId] = useState(initialData?.subjectId || subjects[0]?.id || '');
  const [professorId, setProfessorId] = useState(initialData?.professorId || '');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(
    initialData?.dayOfWeek || defaultDay
  );
  const [startTime, setStartTime] = useState(initialData?.startTime || '08:00');
  const [endTime, setEndTime] = useState(initialData?.endTime || '10:00');
  const [classroom, setClassroom] = useState(
    initialData?.classroom ||
      (subjects.find((s) => s.id === (initialData?.subjectId || subjects[0]?.id))?.classroomDefault || '')
  );
  const [building, setBuilding] = useState(initialData?.building || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar estado cuando se cargan las materias de Dexie
  useEffect(() => {
    if (!subjectId && subjects.length > 0) {
      const targetId = initialData?.subjectId || subjects[0].id;
      setSubjectId(targetId);
      const sub = subjects.find((s) => s.id === targetId);
      if (sub?.classroomDefault) {
        setClassroom((prev) => prev || sub.classroomDefault || '');
      }
      const profForSub = professors.find((p) => p.subjectIds.includes(targetId));
      if (profForSub) {
        setProfessorId((prev) => prev || profForSub.id);
      }
    }
  }, [subjects, subjectId, initialData, professors]);

  // Cuando cambia la materia seleccionada, sugerir su aula por defecto si el campo está vacío
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const sub = subjects.find((s) => s.id === newSubjectId);
    if (sub?.classroomDefault && !classroom) {
      setClassroom(sub.classroomDefault);
    }
    // Si la materia tiene profesores asignados, sugerir el primero
    const profForSub = professors.find((p) => p.subjectIds.includes(newSubjectId));
    if (profForSub && !professorId) {
      setProfessorId(profForSub.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) {
      setError('Debes seleccionar una materia.');
      return;
    }
    if (startTime >= endTime) {
      setError('La hora de inicio debe ser menor que la hora de término.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        subjectId,
        professorId: professorId || undefined,
        dayOfWeek,
        startTime,
        endTime,
        classroom: classroom.trim() || undefined,
        building: building.trim() || undefined,
      });
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Error al guardar el bloque de clase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Materia *
        </label>
        {subjects.length === 0 ? (
          <p className="text-xs text-red-600">
            No tienes materias registradas. Ve a la sección Materias para crear una primero.
          </p>
        ) : (
          <select
            value={subjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
            required
          >
            <option value="" disabled>-- Selecciona una materia --</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.code ? `(${s.code})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Día de la semana *
          </label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value) as DayOfWeek)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
          >
            {Object.entries(DAY_NAMES).map(([val, name]) => (
              <option key={val} value={val}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Profesor Asignado
          </label>
          <select
            value={professorId}
            onChange={(e) => setProfessorId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
          >
            <option value="">(Sin profesor asignado)</option>
            {professors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Hora Inicio *
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Hora Término *
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Aula / Laboratorio
          </label>
          <input
            type="text"
            value={classroom}
            onChange={(e) => setClassroom(e.target.value)}
            placeholder="Ej: Aula 104, Lab 2"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Edificio / Campus
          </label>
          <input
            type="text"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            placeholder="Ej: Edificio Central, Campus Norte"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || subjects.length === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm cursor-pointer"
        >
          {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar Clase' : 'Agregar al Horario'}
        </button>
      </div>
    </form>
  );
};
