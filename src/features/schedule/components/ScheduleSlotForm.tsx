import React, { useState, useMemo } from 'react';
import { Building2, Laptop, UserX, Timer, AlertCircle } from 'lucide-react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import { M3Select } from '../../../shared/components/M3Select';
import {
  FormSheet,
  FormSection,
  FormField,
  SegmentedControl,
  formInputClass,
  type SegmentedOption,
} from '../../../shared/components/form';
import { isSlotVirtual } from '../utils/slotModality';
import {
  DAY_NAMES,
  SHORT_DAY_NAMES,
  type ScheduleSlot,
  type CreateScheduleSlotDTO,
  type DayOfWeek,
  type ClassModality,
} from '../types';

interface ScheduleSlotFormProps {
  initialData?: ScheduleSlot;
  defaultDay?: DayOfWeek;
  onSubmit: (data: CreateScheduleSlotDTO) => Promise<void>;
  onCancel: () => void;
}

const VIRTUAL_PRESETS = ['Zoom', 'Microsoft Teams', 'Google Meet', 'Campus Virtual', 'Discord'] as const;

const DAY_OPTIONS: SegmentedOption<DayOfWeek>[] = (Object.keys(DAY_NAMES) as unknown as DayOfWeek[]).map((key) => {
  const day = Number(key) as DayOfWeek;
  return { value: day, label: DAY_NAMES[day], shortLabel: SHORT_DAY_NAMES[day] };
});

const MODALITY_OPTIONS: SegmentedOption<ClassModality>[] = [
  { value: 'presencial', label: 'Presencial', icon: <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  { value: 'virtual', label: 'Virtual', icon: <Laptop className="h-4 w-4 shrink-0" aria-hidden="true" /> },
];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function describeDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min de clase`;
  return rest === 0 ? `${hours} h de clase` : `${hours} h ${rest} min de clase`;
}

export const ScheduleSlotForm: React.FC<ScheduleSlotFormProps> = ({ initialData, defaultDay = 1, onSubmit, onCancel }) => {
  const { subjects: allSubjects, getSubjectById } = useSubjects();
  // Solo materias en curso: las archivadas (semestres anteriores) no reciben clases nuevas. Si se
  // edita una clase existente, su materia se mantiene en la lista aunque esté archivada.
  const subjects = useMemo(
    () => allSubjects.filter((s) => !s.isArchived || s.id === initialData?.subjectId),
    [allSubjects, initialData?.subjectId]
  );
  const { professors } = useProfessors();

  const initialIsVirtual = initialData ? isSlotVirtual(initialData) : false;

  const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');
  const [professorId, setProfessorId] = useState(initialData?.professorId || '');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(initialData?.dayOfWeek || defaultDay);
  const [startTime, setStartTime] = useState(initialData?.startTime || '');
  const [endTime, setEndTime] = useState(initialData?.endTime || '');
  const [modality, setModality] = useState<ClassModality>(initialIsVirtual ? 'virtual' : 'presencial');

  // Los campos de ambas modalidades se conservan al alternar, así no se pierde lo escrito
  const [classroom, setClassroom] = useState(!initialIsVirtual ? initialData?.classroom || '' : '');
  const [building, setBuilding] = useState(!initialIsVirtual ? initialData?.building || '' : '');
  const [virtualPlatform, setVirtualPlatform] = useState(initialIsVirtual ? initialData?.classroom || '' : '');
  const [virtualLink, setVirtualLink] = useState(
    initialData?.virtualLink || (initialIsVirtual ? initialData?.building || '' : '')
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSubject = useMemo(() => getSubjectById(subjectId), [getSubjectById, subjectId]);

  const durationMinutes = startTime && endTime ? toMinutes(endTime) - toMinutes(startTime) : null;
  const isTimeRangeInvalid = durationMinutes !== null && durationMinutes <= 0;

  // Al elegir materia se proponen su docente titular y su aula/modalidad habitual
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const sub = subjects.find((s) => s.id === newSubjectId);
    if (!sub) return;

    const titular = sub.professorId
      ? professors.find((p) => p.id === sub.professorId)
      : professors.find((p) => (p.subjectIds || []).includes(newSubjectId));
    setProfessorId(titular?.id ?? '');

    if (sub.classroomDefault) {
      if (isSlotVirtual({ classroom: sub.classroomDefault })) {
        setModality('virtual');
        setVirtualPlatform(sub.classroomDefault);
      } else {
        setModality('presencial');
        setClassroom(sub.classroomDefault);
      }
    }
  };

  const subjectOptions = useMemo(
    () =>
      subjects.map((s) => {
        const titular = s.professorId
          ? professors.find((p) => p.id === s.professorId)
          : professors.find((p) => (p.subjectIds || []).includes(s.id));
        return {
          value: s.id,
          label: s.name,
          sublabel: [s.code, titular ? `Prof. ${titular.name}` : ''].filter(Boolean).join(' · ') || undefined,
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
        label: 'Sin docente asignado',
        icon: (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-md-surface-container)] text-[var(--color-md-on-surface-variant)]">
            <UserX className="h-3.5 w-3.5" />
          </span>
        ),
      },
      ...professors.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: p.office || p.email,
        color: p.color,
        icon: <ProfessorAvatar name={p.name} icon={p.icon} color={p.color} size="select" shape="squircle" />,
      })),
    ],
    [professors]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!subjectId) {
      setError('Selecciona la materia de la clase.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Indica la hora de inicio y de fin.');
      return;
    }
    if (isTimeRangeInvalid) {
      setError('La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const isVirtual = modality === 'virtual';
      await onSubmit({
        subjectId,
        professorId: professorId || undefined,
        dayOfWeek,
        startTime,
        endTime,
        modality,
        classroom: isVirtual ? virtualPlatform.trim() || 'Virtual' : classroom.trim() || undefined,
        building: isVirtual ? virtualLink.trim() || undefined : building.trim() || undefined,
        virtualLink: isVirtual ? virtualLink.trim() || undefined : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la clase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormSheet
      title={initialData ? 'Editar clase' : 'Nueva clase'}
      subtitle={`${DAY_NAMES[dayOfWeek]} · ${selectedSubject?.name || 'Selecciona una materia'}`}
      onBack={onCancel}
      backLabel="Volver al horario"
      onSubmit={handleSubmit}
      submitLabel={initialData ? 'Actualizar' : 'Guardar'}
      isSubmitting={isSubmitting}
      submitDisabled={subjects.length === 0}
      error={error}
      onDismissError={() => setError(null)}
    >
      <FormSection title="Materia">
        {subjects.length === 0 ? (
          <p className="flex items-start gap-2 rounded-xl bg-[var(--color-md-surface-container)] p-3 text-xs font-medium text-[var(--color-md-on-surface)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
            Aún no tienes materias. Créalas primero en la pestaña Materias.
          </p>
        ) : (
          <M3Select
            value={subjectId}
            onChange={handleSubjectChange}
            options={subjectOptions}
            placeholder="Selecciona una materia"
            required
          />
        )}
      </FormSection>

      <FormSection title="Día y horario">
        <SegmentedControl value={dayOfWeek} onChange={setDayOfWeek} options={DAY_OPTIONS} ariaLabel="Día de la semana" />

        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="slot-start" label="Inicio" required>
            <input
              id="slot-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`${formInputClass} font-mono font-bold`}
            />
          </FormField>
          <FormField htmlFor="slot-end" label="Fin" required>
            <input
              id="slot-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-invalid={isTimeRangeInvalid}
              className={`${formInputClass} font-mono font-bold`}
            />
          </FormField>
        </div>

        {durationMinutes !== null && (
          <p
            role="status"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              isTimeRangeInvalid
                ? 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface)]'
                : 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
            }`}
          >
            {isTimeRangeInvalid ? (
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Timer className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isTimeRangeInvalid ? 'El fin debe ser posterior al inicio' : describeDuration(durationMinutes)}
          </p>
        )}
      </FormSection>

      <FormSection title="Docente">
        <M3Select
          value={professorId}
          onChange={(val) => setProfessorId(val)}
          options={professorOptions}
          placeholder="Sin docente asignado"
        />
      </FormSection>

      <FormSection title="Modalidad y ubicación">
        <SegmentedControl value={modality} onChange={setModality} options={MODALITY_OPTIONS} ariaLabel="Modalidad de la clase" />

        {modality === 'presencial' ? (
          <div key="presencial" className="grid grid-cols-1 gap-3 animate-in fade-in duration-150 sm:grid-cols-2">
            <FormField htmlFor="slot-classroom" label="Aula, salón o laboratorio">
              <input
                id="slot-classroom"
                type="text"
                value={classroom}
                onChange={(e) => setClassroom(e.target.value)}
                placeholder="ej. Aula 204"
                className={formInputClass}
              />
            </FormField>
            <FormField htmlFor="slot-building" label="Edificio o pabellón">
              <input
                id="slot-building"
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="ej. Edificio C"
                className={formInputClass}
              />
            </FormField>
          </div>
        ) : (
          <div key="virtual" className="space-y-3 animate-in fade-in duration-150">
            <FormField htmlFor="slot-platform" label="Plataforma">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {VIRTUAL_PRESETS.map((platform) => {
                  const isSelected = virtualPlatform === platform;
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => setVirtualPlatform(platform)}
                      aria-pressed={isSelected}
                      className={`h-8 rounded-full border px-3 text-xs font-bold transition-all duration-150 ease-out active:scale-95 ${
                        isSelected
                          ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                          : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-outline)]'
                      }`}
                    >
                      {platform}
                    </button>
                  );
                })}
              </div>
              <input
                id="slot-platform"
                type="text"
                value={virtualPlatform}
                onChange={(e) => setVirtualPlatform(e.target.value)}
                placeholder="ej. Zoom"
                className={formInputClass}
              />
            </FormField>
            <FormField htmlFor="slot-link" label="Enlace o ID de la reunión">
              <input
                id="slot-link"
                type="text"
                inputMode="url"
                value={virtualLink}
                onChange={(e) => setVirtualLink(e.target.value)}
                placeholder="https://… o 123 456 789"
                className={`${formInputClass} font-mono text-xs`}
              />
            </FormField>
          </div>
        )}
      </FormSection>
    </FormSheet>
  );
};
