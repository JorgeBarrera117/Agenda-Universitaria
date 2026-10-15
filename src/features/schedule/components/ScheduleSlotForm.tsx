import React, { useState } from 'react';
import {
  Building2,
  Laptop,
} from 'lucide-react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import {
  DAY_NAMES,
  type ScheduleSlot,
  type CreateScheduleSlotDTO,
  type DayOfWeek,
  type ClassModality,
} from '../types';

import { Button } from '../../../shared/components/atoms';

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
  const { subjects, getSubjectById } = useSubjects();
  const { professors } = useProfessors();

  // Determinar modalidad inicial (detectando si ya era virtual o tiene la palabra virtual)
  const getInitialModality = (): ClassModality => {
    if (initialData?.modality) return initialData.modality;
    const c = (initialData?.classroom || '').toLowerCase();
    const b = (initialData?.building || '').toLowerCase();
    if (c.includes('virtual') || c.includes('zoom') || c.includes('teams') || c.includes('meet') || b.includes('virtual')) {
      return 'virtual';
    }
    return 'presencial';
  };

  const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');
  const [professorId, setProfessorId] = useState(initialData?.professorId || '');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(
    initialData?.dayOfWeek || defaultDay
  );
  const [startTime, setStartTime] = useState(initialData?.startTime || '');
  const [endTime, setEndTime] = useState(initialData?.endTime || '');

  // Modalidad: Presencial vs Virtual
  const [modality, setModality] = useState<ClassModality>(getInitialModality);

  // Campos presenciales
  const [classroom, setClassroom] = useState(
    initialData && initialData.modality !== 'virtual' && !initialData.classroom?.toLowerCase().includes('virtual')
      ? initialData.classroom || ''
      : ''
  );
  const [building, setBuilding] = useState(
    initialData && initialData.modality !== 'virtual' ? initialData.building || '' : ''
  );

  // Campos virtuales
  const [virtualPlatform, setVirtualPlatform] = useState(
    initialData?.modality === 'virtual' || initialData?.classroom?.toLowerCase().includes('virtual')
      ? initialData?.classroom || ''
      : ''
  );
  const [virtualLink, setVirtualLink] = useState(
    initialData?.virtualLink || (initialData?.modality === 'virtual' ? initialData.building || '' : '')
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuando cambia la materia seleccionada, auto-asignar inteligentemente su profesor y aula
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const sub = subjects.find((s) => s.id === newSubjectId);
    if (!sub) return;

    // 1. Auto-asignar profesor vinculado a la materia
    const profForSub = sub.professorId
      ? professors.find((p) => p.id === sub.professorId)
      : professors.find((p) => p.subjectIds.includes(newSubjectId));

    if (profForSub) {
      setProfessorId(profForSub.id);
    } else {
      setProfessorId('');
    }

    // 2. Auto-asignar aula habitual y modalidad
    if (sub.classroomDefault) {
      const lower = sub.classroomDefault.toLowerCase();
      if (lower.includes('virtual') || lower.includes('zoom') || lower.includes('teams') || lower.includes('meet')) {
        setModality('virtual');
        setVirtualPlatform(sub.classroomDefault);
      } else {
        setModality('presencial');
        setClassroom(sub.classroomDefault);
      }
    }
  };

  const selectedSubject = getSubjectById(subjectId);
  const selectedProfessor = professors.find((p) => p.id === professorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) {
      setError('Debes seleccionar una materia.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Debes ingresar la hora de inicio y de término.');
      return;
    }
    if (startTime >= endTime) {
      setError('La hora de inicio debe ser anterior a la hora de término.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Normalizar datos según la modalidad seleccionada
      const isVirt = modality === 'virtual';
      const finalClassroom = isVirt
        ? (virtualPlatform.trim() || 'Virtual')
        : (classroom.trim() || undefined);
      const finalBuilding = isVirt
        ? (virtualLink.trim() || undefined)
        : (building.trim() || undefined);
      const finalVirtualLink = isVirt
        ? (virtualLink.trim() || undefined)
        : undefined;

      await onSubmit({
        subjectId,
        professorId: professorId || undefined,
        dayOfWeek,
        startTime,
        endTime,
        modality,
        classroom: finalClassroom,
        building: finalBuilding,
        virtualLink: finalVirtualLink,
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
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
          {error}
        </div>
      )}

      {/* Tarjeta de Live Preview de la Cátedra */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl space-y-2.5">
        <div className="flex items-center gap-3">
          {/* Badge con Ícono y Color de la Materia */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ring-2 ring-white/40 shrink-0"
            style={{ backgroundColor: selectedSubject?.color || '#006BBB' }}
          >
            <SubjectIcon icon={selectedSubject?.icon} className="w-6 h-6 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-cove-navy text-white shadow-2xs tracking-wider">
                {selectedSubject?.code || 'ASIGNATURA'}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {DAY_NAMES[dayOfWeek]} • {startTime && endTime ? `${startTime} - ${endTime}` : 'Horario por definir'}
              </span>
            </div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
              {selectedSubject?.name || 'Selecciona una materia'}
            </h4>
          </div>
        </div>

        {/* Indicador de Modalidad en el Preview */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold gap-2">
          {modality === 'virtual' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
              <Laptop className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Clase Virtual ({virtualPlatform || 'En Línea'})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black bg-slate-200/70 dark:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-300/70 dark:border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-cove-blue dark:text-cove-sky" />
              <span className="truncate">
                Presencial: {classroom ? classroom : 'Aula sin asignar'}
                {building ? ` • ${building}` : ''}
              </span>
            </span>
          )}

          {selectedProfessor && (
            <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate font-medium">
              Prof: <strong className="text-slate-800 dark:text-slate-200">{selectedProfessor.name}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Selector de Modalidad (Presencial vs Virtual) */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
          Modalidad de Asistencia *
        </label>
        <div className="grid grid-cols-2 gap-3">
          {/* Opción Presencial */}
          <button
            type="button"
            onClick={() => setModality('presencial')}
            className={`p-3 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer text-left ${
              modality === 'presencial'
                ? 'bg-cove-navy dark:bg-blue-600 text-white border-cove-navy dark:border-blue-500 shadow-md ring-2 ring-cove-sky/40 dark:ring-blue-400/40'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                modality === 'presencial' ? 'bg-white/15 text-white' : 'bg-slate-100 dark:bg-slate-700 text-cove-blue dark:text-cove-sky'
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-black leading-tight">Presencial</span>
              <span
                className={`text-[10px] block leading-tight ${
                  modality === 'presencial' ? 'text-slate-200' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Campus y aulas físicas
              </span>
            </div>
          </button>

          {/* Opción Virtual */}
          <button
            type="button"
            onClick={() => setModality('virtual')}
            className={`p-3 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer text-left ${
              modality === 'virtual'
                ? 'bg-gradient-to-br from-indigo-900 to-indigo-950 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400/40'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                modality === 'virtual' ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
              }`}
            >
              <Laptop className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-black leading-tight">Virtual</span>
              <span
                className={`text-[10px] block leading-tight ${
                  modality === 'virtual' ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Videollamada / En línea
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Selección de Materia y Profesor */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Materia *
          </label>
          {subjects.length === 0 ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              No tienes materias registradas. Ve a la sección Materias para crear una primero.
            </p>
          ) : (
            <div className="relative">
              <select
                value={subjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 dark:text-white bg-white dark:bg-slate-800 font-medium text-sm"
                required
              >
                <option value="" disabled className="dark:bg-slate-800 dark:text-white">-- Selecciona una materia --</option>
                {subjects.map((s) => {
                  const prof = s.professorId
                    ? professors.find((p) => p.id === s.professorId)
                    : professors.find((p) => p.subjectIds.includes(s.id));
                  return (
                    <option key={s.id} value={s.id} className="dark:bg-slate-800 dark:text-white">
                      {s.name} {s.code ? `(${s.code})` : ''} {prof ? `• Prof. ${prof.name}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Día de la semana *
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value) as DayOfWeek)}
              className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 dark:text-white bg-white dark:bg-slate-800 font-medium text-sm"
            >
              {Object.entries(DAY_NAMES).map(([val, name]) => (
                <option key={val} value={val} className="dark:bg-slate-800 dark:text-white">
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Profesor Asignado
            </label>
            <select
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 dark:text-white bg-white dark:bg-slate-800 font-medium text-sm"
            >
              <option value="" className="dark:bg-slate-800 dark:text-white">(Sin profesor asignado)</option>
              {professors.map((p) => (
                <option key={p.id} value={p.id} className="dark:bg-slate-800 dark:text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rango Horario */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Hora Inicio *
          </label>
          <div className="relative">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 dark:text-white bg-white dark:bg-slate-800 font-mono font-bold text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Hora Término *
          </label>
          <div className="relative">
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 dark:text-white bg-white dark:bg-slate-800 font-mono font-bold text-sm"
              required
            />
          </div>
        </div>
      </div>

      {/* Campos Dinámicos según Modalidad */}
      {modality === 'presencial' ? (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Building2 className="w-4 h-4 text-cove-blue dark:text-cove-sky" />
            <span>Ubicación Física en el Campus</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Aula / Laboratorio / Taller
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={classroom}
                  onChange={(e) => setClassroom(e.target.value)}
                  placeholder="Ej: Aula 204, Lab 3"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 dark:text-white bg-white dark:bg-slate-800 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Edificio / Pabellón / Campus
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="Ej: Edificio A, Campus Central"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 dark:text-white bg-white dark:bg-slate-800 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 rounded-2xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
            <Laptop className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Configuración de Clase Virtual</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                Plataforma / Medio Virtual
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['Zoom', 'Microsoft Teams', 'Google Meet', 'Campus Virtual', 'Discord'].map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setVirtualPlatform(plat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      virtualPlatform === plat
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-slate-750'
                    }`}
                  >
                    {plat}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={virtualPlatform}
                onChange={(e) => setVirtualPlatform(e.target.value)}
                placeholder="Ej: Zoom, Teams, Moodle"
                className="w-full px-3 py-2 border border-indigo-200 dark:border-indigo-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-900 dark:text-white bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                Enlace de la Clase o ID de Reunión (Opcional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={virtualLink}
                  onChange={(e) => setVirtualLink(e.target.value)}
                  placeholder="Ej: https://zoom.us/j/... o ID: 123 456 7890"
                  className="w-full px-3 py-2 border border-indigo-200 dark:border-indigo-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-900 dark:text-white bg-white dark:bg-slate-800 text-sm font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botones de Acción */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isSubmitting || subjects.length === 0}
        >
          {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar Clase' : 'Agregar al Horario'}
        </Button>
      </div>
    </form>
  );
};
