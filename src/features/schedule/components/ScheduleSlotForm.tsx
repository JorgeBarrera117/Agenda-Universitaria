import React, { useState, useMemo } from 'react';
import {
  Building2,
  Laptop,
  ArrowLeft,
  Check,
  Calendar,
  UserX,
  Clock,
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

const VIRTUAL_PRESETS = ['Zoom', 'Microsoft Teams', 'Google Meet', 'Campus Virtual', 'Discord'] as const;

export const ScheduleSlotForm: React.FC<ScheduleSlotFormProps> = ({
  initialData,
  defaultDay = 1,
  onSubmit,
  onCancel,
}) => {
  const { subjects, getSubjectById } = useSubjects();
  const { professors } = useProfessors();

  // Determinar modalidad inicial
  const getInitialModality = (): ClassModality => {
    if (initialData?.modality) return initialData.modality;
    const c = (initialData?.classroom || '').toLowerCase();
    const b = (initialData?.building || '').toLowerCase();
    if (
      c.includes('virtual') ||
      c.includes('zoom') ||
      c.includes('teams') ||
      c.includes('meet') ||
      b.includes('virtual')
    ) {
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
    initialData &&
      initialData.modality !== 'virtual' &&
      !(initialData.classroom || '').toLowerCase().includes('virtual')
      ? initialData.classroom || ''
      : ''
  );
  const [building, setBuilding] = useState(
    initialData && initialData.modality !== 'virtual' ? initialData.building || '' : ''
  );

  // Campos virtuales
  const [virtualPlatform, setVirtualPlatform] = useState(
    initialData?.modality === 'virtual' ||
      (initialData?.classroom || '').toLowerCase().includes('virtual')
      ? initialData?.classroom || ''
      : ''
  );
  const [virtualLink, setVirtualLink] = useState(
    initialData?.virtualLink ||
      (initialData?.modality === 'virtual' ? initialData.building || '' : '')
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Soporte de navegación con botón "Atrás" de Android
  useBackButton(() => {
    onCancel();
    return true;
  }, BACK_PRIORITY.MODAL, true);

  // Auto-asignación inteligente de docente y aula predeterminada
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const sub = subjects.find((s) => s.id === newSubjectId);
    if (!sub) return;

    // 1. Auto-asignar profesor titular
    const profForSub = sub.professorId
      ? professors.find((p) => p.id === sub.professorId)
      : professors.find((p) => (p.subjectIds || []).includes(newSubjectId));

    if (profForSub) {
      setProfessorId(profForSub.id);
    } else {
      setProfessorId('');
    }

    // 2. Auto-asignar aula y modalidad habitual
    if (sub.classroomDefault) {
      const lower = sub.classroomDefault.toLowerCase();
      if (
        lower.includes('virtual') ||
        lower.includes('zoom') ||
        lower.includes('teams') ||
        lower.includes('meet')
      ) {
        setModality('virtual');
        setVirtualPlatform(sub.classroomDefault);
      } else {
        setModality('presencial');
        setClassroom(sub.classroomDefault);
      }
    }
  };

  const selectedSubject = useMemo(
    () => getSubjectById(subjectId),
    [getSubjectById, subjectId]
  );

  const selectedProfessor = useMemo(
    () => professors.find((p) => p.id === professorId),
    [professors, professorId]
  );

  // Opciones memoizadas para M3Select
  const subjectOptions = useMemo(
    () =>
      subjects.map((s) => {
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
      }),
    [subjects, professors]
  );

  const professorOptions = useMemo(
    () => [
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
    ],
    [professors]
  );

  const dayOptions = useMemo(
    () =>
      (Object.entries(DAY_NAMES) as [string, string][]).map(([val, name]) => ({
        value: Number(val) as DayOfWeek,
        label: name,
        icon: (
          <div className="w-6 h-6 rounded-lg bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] flex items-center justify-center shrink-0 shadow-2xs">
            <Calendar className="w-3.5 h-3.5" />
          </div>
        ),
      })),
    []
  );

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

      const isVirt = modality === 'virtual';
      const finalClassroom = isVirt
        ? virtualPlatform.trim() || 'Virtual'
        : classroom.trim() || undefined;
      const finalBuilding = isVirt
        ? virtualLink.trim() || undefined
        : building.trim() || undefined;
      const finalVirtualLink = isVirt
        ? virtualLink.trim() || undefined
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
    <form onSubmit={handleSubmit} className="space-y-3 animate-in fade-in duration-150 pb-8">
      {/* 1. Barra Superior Compacta (Top App Bar) */}
      <div className="sticky top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 py-2.5 bg-[#FDFBFF]/95 dark:bg-[#14171B]/95 backdrop-blur-xl border-b border-[#C3C7D0]/40 dark:border-[#43474E]/40 flex items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Volver al horario"
            title="Volver"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] flex items-center justify-center text-[#191C20] dark:text-[#E2E2E6] transition-all active:scale-90 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-[#191C20] dark:text-[#E2E2E6] truncate leading-tight">
              {initialData ? 'Modificar Cátedra' : 'Programar Cátedra'}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#43474E] dark:text-[#8C9199] truncate leading-none mt-0.5">
              {DAY_NAMES[dayOfWeek]} • {selectedSubject?.name || 'Selecciona asignatura'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#43474E] dark:text-[#C3C7D0] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || subjects.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white dark:text-[#003353] bg-[#00639B] hover:bg-[#005282] dark:bg-[#92CCFF] dark:hover:bg-[#72BAF5] active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.8]" />
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

      {/* 2. Píldora de Estado Compacta (Sustituye la antigua tarjeta gigante de 200px) */}
      {selectedSubject && (
        <div className="px-3 py-2 rounded-2xl bg-[var(--color-md-surface-container)] border border-[var(--color-md-outline-variant)] flex items-center justify-between gap-2.5 text-xs shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
              style={{ backgroundColor: selectedSubject.color || '#00639B' }}
            >
              <SubjectIcon icon={selectedSubject.icon} className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-[#191C20] dark:text-[#E2E2E6] truncate block leading-tight">
                {selectedSubject.name}
              </span>
              <span className="text-[10px] text-[#72777F] dark:text-[#8C9199] font-mono">
                {selectedSubject.code || 'ASIGNATURA'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
            <span className="inline-flex items-center gap-1 font-mono font-bold bg-[var(--color-md-card-bg)] px-2 py-0.5 rounded-lg border border-[var(--color-md-outline-variant)]">
              <Clock className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF]" />
              {startTime && endTime ? `${startTime} - ${endTime}` : 'Horario pendiente'}
            </span>
            {selectedProfessor && (
              <span className="hidden sm:inline-flex items-center gap-1 font-medium text-[#43474E] dark:text-[#C3C7D0] bg-[var(--color-md-card-bg)] px-2 py-0.5 rounded-lg border border-[var(--color-md-outline-variant)]">
                Prof. {selectedProfessor.name}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. Contenedor Principal Unificado (Alta Densidad, Espacio Optimizado) */}
      <div className="p-3.5 sm:p-5 bg-[var(--color-md-card-bg)] border border-[var(--color-md-outline-variant)] rounded-2xl sm:rounded-3xl shadow-xs space-y-3.5">
        
        {/* Fila 1: Asignatura + Selector de Modalidad en Línea */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-7 lg:col-span-8">
            {subjects.length === 0 ? (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                No tienes materias inscritas. Ve a la sección Materias para crear una primero.
              </p>
            ) : (
              <M3Select
                label="Materia *"
                value={subjectId}
                onChange={handleSubjectChange}
                options={subjectOptions}
                placeholder="-- Selecciona una materia --"
                required
              />
            )}
          </div>

          {/* Selector de Modalidad Segmentado Compacto */}
          <div className="sm:col-span-5 lg:col-span-4">
            <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider mb-1.5">
              Modalidad
            </label>
            <div className="grid grid-cols-2 p-1 bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 rounded-2xl border border-[#C3C7D0]/50 dark:border-[#43474E]/50">
              <button
                type="button"
                onClick={() => setModality('presencial')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  modality === 'presencial'
                    ? 'bg-[#00639B] text-white dark:bg-[#92CCFF] dark:text-[#003353] shadow-xs'
                    : 'text-[#43474E] dark:text-[#C3C7D0] hover:text-[#191C20]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Presencial</span>
              </button>
              <button
                type="button"
                onClick={() => setModality('virtual')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  modality === 'virtual'
                    ? 'bg-[#00639B] text-white dark:bg-[#92CCFF] dark:text-[#003353] shadow-xs'
                    : 'text-[#43474E] dark:text-[#C3C7D0] hover:text-[#191C20]'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 shrink-0" />
                <span>Virtual</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fila 2: Día de la Semana + Catedrático */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <M3Select
              label="Día de la semana *"
              value={dayOfWeek}
              onChange={(val) => setDayOfWeek(Number(val) as DayOfWeek)}
              options={dayOptions}
              required
            />
          </div>

          <div>
            <M3Select
              label="Catedrático Asignado"
              value={professorId}
              onChange={(val) => setProfessorId(val)}
              options={professorOptions}
              placeholder="(Sin profesor asignado)"
            />
          </div>
        </div>

        {/* Fila 3: Rango Horario */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1 uppercase tracking-wider">
              Hora Inicio *
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] font-mono font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF]"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1 uppercase tracking-wider">
              Hora Término *
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] font-mono font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF]"
              required
            />
          </div>
        </div>

        {/* Fila 4: Ubicación Adaptativa según Modalidad */}
        <div className="pt-2 border-t border-[#C3C7D0]/30 dark:border-[#43474E]/30">
          {modality === 'presencial' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1 uppercase tracking-wider">
                  Aula / Salón / Laboratorio
                </label>
                <input
                  type="text"
                  value={classroom}
                  onChange={(e) => setClassroom(e.target.value)}
                  placeholder="Ej: Aula 204, Lab Redes"
                  className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-xs sm:text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1 uppercase tracking-wider">
                  Edificio / Pabellón (Opcional)
                </label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="Ej: Edificio C, Campus Norte"
                  className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-xs sm:text-sm transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="block text-[11px] font-bold text-[#00639B] dark:text-[#92CCFF] uppercase tracking-wider">
                  Plataforma Virtual
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  {VIRTUAL_PRESETS.map((plat) => (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => setVirtualPlatform(plat)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        virtualPlatform === plat
                          ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border-[#00639B] dark:border-[#92CCFF]'
                          : 'bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#43474E] dark:text-[#C3C7D0] border-transparent hover:border-[#72777F]'
                      }`}
                    >
                      {plat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={virtualPlatform}
                  onChange={(e) => setVirtualPlatform(e.target.value)}
                  placeholder="Nombre de la plataforma (ej: Zoom, Teams)"
                  className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-xs sm:text-sm"
                />
                <input
                  type="text"
                  value={virtualLink}
                  onChange={(e) => setVirtualLink(e.target.value)}
                  placeholder="Enlace o ID de reunión (Opcional)"
                  className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-mono text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};
