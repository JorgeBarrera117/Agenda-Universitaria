import React, { useState } from 'react';
import {
  Building2,
  Laptop,
  ArrowLeft,
  Check,
  UserCheck,
  Calendar,
  UserX,
} from 'lucide-react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { SubjectIcon, SubjectBadge } from '../../subjects/components/SubjectIcon';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import { M3Select } from '../../../shared/components/M3Select';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import {
  DAY_NAMES,
  type ScheduleSlot,
  type CreateScheduleSlotDTO,
  type DayOfWeek,
  type ClassModality,
} from '../types';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';

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
    initialData && initialData.modality !== 'virtual' && !(initialData.classroom || '').toLowerCase().includes('virtual')
      ? initialData.classroom || ''
      : ''
  );
  const [building, setBuilding] = useState(
    initialData && initialData.modality !== 'virtual' ? initialData.building || '' : ''
  );

  // Campos virtuales
  const [virtualPlatform, setVirtualPlatform] = useState(
    initialData?.modality === 'virtual' || (initialData?.classroom || '').toLowerCase().includes('virtual')
      ? initialData?.classroom || ''
      : ''
  );
  const [virtualLink, setVirtualLink] = useState(
    initialData?.virtualLink || (initialData?.modality === 'virtual' ? initialData.building || '' : '')
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Soporte de navegación con botón "Atrás" de Android
  useBackButton(() => {
    onCancel();
    return true;
  }, BACK_PRIORITY.MODAL, true);

  // Cuando cambia la materia seleccionada, auto-asignar inteligentemente su profesor y aula
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const sub = subjects.find((s) => s.id === newSubjectId);
    if (!sub) return;

    // 1. Auto-asignar profesor vinculado a la materia
    const profForSub = sub.professorId
      ? professors.find((p) => p.id === sub.professorId)
      : professors.find((p) => (p.subjectIds || []).includes(newSubjectId));

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
    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-200 pb-10">
      {/* 1. Barra Superior Fija (Material Design 3 Top App Bar) */}
      <div className="sticky top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 py-3 bg-[#FDFBFF]/95 dark:bg-[#14171B]/95 backdrop-blur-xl border-b border-[#C3C7D0]/40 dark:border-[#43474E]/40 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Volver al horario"
            title="Volver"
            className="w-10 h-10 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] flex items-center justify-center text-[#191C20] dark:text-[#E2E2E6] transition-all active:scale-90 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-[#191C20] dark:text-[#E2E2E6] truncate leading-tight">
              {initialData ? 'Modificar Cátedra' : 'Programar Cátedra'}
            </h2>
            <p className="text-[11px] text-[#43474E] dark:text-[#8C9199] truncate leading-none mt-0.5">
              {DAY_NAMES[dayOfWeek]} • {selectedSubject?.name || 'Horario Semanal'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="hidden sm:inline-flex px-4 py-2 rounded-full text-xs font-semibold text-[#43474E] dark:text-[#C3C7D0] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || subjects.length === 0}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold text-white dark:text-[#003353] bg-[#00639B] hover:bg-[#005282] dark:bg-[#92CCFF] dark:hover:bg-[#72BAF5] active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{isSubmitting ? 'Guardando...' : initialData ? 'Actualizar' : 'Guardar'}</span>
          </button>
        </div>
      </div>

      <ContextualToast
        message={error}
        variant="error"
        bottomOffset="compact"
        onClose={() => setError(null)}
      />

      {/* Tarjeta 1: Live Preview de la Cátedra */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-3">
        <div className="p-3.5 bg-[#F1F4FA] dark:bg-[#272A2F] border border-[#C3C7D0]/40 dark:border-[#43474E]/40 rounded-2xl flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ring-2 ring-white/40 shrink-0"
            style={{ backgroundColor: selectedSubject?.color || '#00639B' }}
          >
            <SubjectIcon icon={selectedSubject?.icon} className="w-6 h-6 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-mono font-black bg-black text-white dark:bg-white dark:text-black shadow-2xs tracking-wider">
                {selectedSubject?.code || 'ASIGNATURA'}
              </span>
              <span className="text-[11px] font-bold text-[#72777F] dark:text-[#8C9199]">
                {DAY_NAMES[dayOfWeek]} • {startTime && endTime ? `${startTime} - ${endTime}` : 'Horario por definir'}
              </span>
            </div>
            <h4 className="text-base font-black text-[#191C20] dark:text-[#E2E2E6] truncate leading-tight">
              {selectedSubject?.name || 'Selecciona una materia'}
            </h4>
          </div>
        </div>

        {/* Indicador de Modalidad y Profesor */}
        <div className="pt-2 border-t border-[#C3C7D0]/30 dark:border-[#43474E]/30 flex items-center justify-between text-xs font-semibold gap-2 flex-wrap">
          {modality === 'virtual' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border border-[#00639B]/30 dark:border-[#92CCFF]/30">
              <Laptop className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF] shrink-0" />
              <span>Clase Virtual ({virtualPlatform || 'En Línea'})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-[#F1F4FA] dark:bg-[#272A2F] text-[#191C20] dark:text-[#E2E2E6] border border-[#C3C7D0]/40 dark:border-[#43474E]/40">
              <Building2 className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF] shrink-0" />
              <span className="truncate">
                {classroom ? `Aula ${classroom}` : 'Aula sin asignar'}
                {building ? ` • ${building}` : ''}
              </span>
            </span>
          )}

          {selectedProfessor && (
            <span className="text-xs text-[#43474E] dark:text-[#C3C7D0] truncate font-medium flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF] shrink-0" />
              <span>Prof: <strong className="text-[#191C20] dark:text-[#E2E2E6]">{selectedProfessor.name}</strong></span>
            </span>
          )}
        </div>
      </div>

      {/* Tarjeta 2: Modalidad de Asistencia */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-3">
        <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
          Modalidad de Asistencia *
        </label>
        <div className="grid grid-cols-2 gap-3">
          {/* Opción Presencial */}
          <button
            type="button"
            onClick={() => setModality('presencial')}
            className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer text-left ${
              modality === 'presencial'
                ? 'bg-[#D0E4FF] dark:bg-[#004B76] border-[#00639B] dark:border-[#92CCFF] shadow-xs text-[#001D32] dark:text-[#D0E4FF]'
                : 'bg-[#F1F4FA] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0] border-[#C3C7D0]/40 dark:border-[#43474E]/40 hover:border-[#72777F]'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                modality === 'presencial'
                  ? 'bg-[#00639B] text-white dark:bg-[#92CCFF] dark:text-[#003353] shadow-xs'
                  : 'bg-white dark:bg-[#14171B] text-[#72777F]'
              }`}
            >
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-black leading-tight text-[#191C20] dark:text-[#E2E2E6]">
                Presencial
              </span>
              <span className="text-[10px] block leading-tight text-[#72777F] dark:text-[#8C9199] mt-0.5">
                Campus y aulas físicas
              </span>
            </div>
          </button>

          {/* Opción Virtual */}
          <button
            type="button"
            onClick={() => setModality('virtual')}
            className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer text-left ${
              modality === 'virtual'
                ? 'bg-[#D0E4FF] dark:bg-[#004B76] border-[#00639B] dark:border-[#92CCFF] shadow-xs text-[#001D32] dark:text-[#D0E4FF]'
                : 'bg-[#F1F4FA] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0] border-[#C3C7D0]/40 dark:border-[#43474E]/40 hover:border-[#72777F]'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                modality === 'virtual'
                  ? 'bg-[#00639B] text-white dark:bg-[#92CCFF] dark:text-[#003353] shadow-xs'
                  : 'bg-white dark:bg-[#14171B] text-[#72777F]'
              }`}
            >
              <Laptop className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-black leading-tight text-[#191C20] dark:text-[#E2E2E6]">
                Virtual
              </span>
              <span className="text-[10px] block leading-tight text-[#72777F] dark:text-[#8C9199] mt-0.5">
                Videollamada / En línea
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Tarjeta 3: Materia, Día y Docente */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
          Asignatura y Cátedra
        </h3>

        <div>
          {subjects.length === 0 ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              No tienes materias inscritas. Ve a la sección Materias para crear una primero.
            </p>
          ) : (
            <M3Select
              label="Materia"
              value={subjectId}
              onChange={(val) => handleSubjectChange(val)}
              options={subjects.map((s) => {
                const prof = s.professorId
                  ? professors.find((p) => p.id === s.professorId)
                  : professors.find((p) => (p.subjectIds || []).includes(s.id));
                return {
                  value: s.id,
                  label: s.name,
                  sublabel: `${s.code ? `${s.code} • ` : ''}${prof ? `Prof. ${prof.name}` : ''}`.trim(),
                  color: s.color,
                  icon: <SubjectBadge icon={s.icon} color={s.color} size="select" />,
                };
              })}
              placeholder="-- Selecciona una materia --"
              required
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <M3Select
              label="Día de la semana"
              value={dayOfWeek}
              onChange={(val) => setDayOfWeek(Number(val) as DayOfWeek)}
              options={(Object.entries(DAY_NAMES) as [string, string][]).map(([val, name]) => ({
                value: Number(val) as DayOfWeek,
                label: name,
                icon: (
                  <div className="w-6 h-6 rounded-lg bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] flex items-center justify-center shrink-0 shadow-2xs">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                ),
              }))}
              required
            />
          </div>

          <div>
            <M3Select
              label="Catedrático Asignado"
              value={professorId}
              onChange={(val) => setProfessorId(val)}
              options={[
                {
                  value: '',
                  label: '(Sin profesor asignado)',
                  icon: (
                    <div className="w-6 h-6 rounded-lg bg-[#E2E7EF] dark:bg-[#272A2F] text-[#72777F] dark:text-[#8C9199] flex items-center justify-center shrink-0">
                      <UserX className="w-3.5 h-3.5" />
                    </div>
                  ),
                },
                ...professors.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.office || p.email,
                  color: p.color,
                  icon: (
                    <ProfessorAvatar
                      name={p.name}
                      icon={p.icon}
                      color={p.color}
                      size="select"
                      shape="squircle"
                    />
                  ),
                })),
              ]}
              placeholder="(Sin profesor asignado)"
            />
          </div>
        </div>

        {/* Rango Horario */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
              Hora Inicio *
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
              Hora Término *
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF]"
              required
            />
          </div>
        </div>
      </div>

      {/* Tarjeta 4: Ubicación (Presencial o Virtual) */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-4">
        {modality === 'presencial' ? (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#00639B] dark:text-[#92CCFF]" />
              <span>Ubicación Física en el Campus</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
                  Aula / Laboratorio / Salón
                </label>
                <input
                  type="text"
                  value={classroom}
                  onChange={(e) => setClassroom(e.target.value)}
                  placeholder="Ej: Aula 204, Lab de Redes"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
                  Edificio / Pabellón / Campus
                </label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="Ej: Edificio C, Campus Central"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#00639B] dark:text-[#92CCFF] uppercase tracking-wider flex items-center gap-1.5">
              <Laptop className="w-4 h-4 text-[#00639B] dark:text-[#92CCFF]" />
              <span>Configuración de Clase Virtual</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-2">
                Plataforma de Videollamada
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {['Zoom', 'Microsoft Teams', 'Google Meet', 'Campus Virtual', 'Discord'].map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setVirtualPlatform(plat)}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                      virtualPlatform === plat
                        ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border-[#00639B] dark:border-[#92CCFF] shadow-2xs'
                        : 'bg-[#F1F4FA] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0] border-[#C3C7D0]/40 dark:border-[#43474E]/40 hover:border-[#72777F]'
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
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
                Enlace de la Clase o ID de Reunión (Opcional)
              </label>
              <input
                type="text"
                value={virtualLink}
                onChange={(e) => setVirtualLink(e.target.value)}
                placeholder="Ej: https://zoom.us/j/... o ID: 123 456 7890"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-mono text-xs transition-all"
              />
            </div>
          </div>
        )}
      </div>
    </form>
  );
};
