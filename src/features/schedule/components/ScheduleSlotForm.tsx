import React, { useState, useMemo } from 'react';
import { Building2, Laptop, UserX, Timer, AlertCircle, Check } from 'lucide-react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import { M3Switch } from '../../settings/components/SettingsPrimitives';
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
  /** Una clase por día elegido (al editar, siempre una sola). */
  onSubmit: (data: CreateScheduleSlotDTO[]) => Promise<void>;
  onCancel: () => void;
}

interface TimeRange {
  start: string;
  end: string;
}

const VIRTUAL_PRESETS = ['Zoom', 'Microsoft Teams', 'Google Meet', 'Campus Virtual', 'Discord'] as const;

const WEEK: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

const DAY_OPTIONS: SegmentedOption<DayOfWeek>[] = WEEK.map((day) => ({
  value: day,
  label: DAY_NAMES[day],
  shortLabel: SHORT_DAY_NAMES[day],
}));

const MODALITY_OPTIONS: SegmentedOption<ClassModality>[] = [
  { value: 'presencial', label: 'Presencial', icon: <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  { value: 'virtual', label: 'Virtual', icon: <Laptop className="h-4 w-4 shrink-0" aria-hidden="true" /> },
];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutos de clase, o null si falta alguna hora. */
function durationOf(range: TimeRange): number | null {
  return range.start && range.end ? toMinutes(range.end) - toMinutes(range.start) : null;
}

function describeDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min de clase`;
  return rest === 0 ? `${hours} h de clase` : `${hours} h ${rest} min de clase`;
}

/** Duración en un chip de ayuda M3 (o el aviso si el fin no es posterior al inicio). */
const DurationChip: React.FC<{ range: TimeRange; compact?: boolean }> = ({ range, compact = false }) => {
  const minutes = durationOf(range);
  if (minutes === null) return null;
  const invalid = minutes <= 0;
  return (
    <p
      role="status"
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
        invalid
          ? 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface)]'
          : 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
      }`}
    >
      {invalid ? <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> : <Timer className="h-3.5 w-3.5" aria-hidden="true" />}
      {invalid ? (compact ? 'Fin antes del inicio' : 'El fin debe ser posterior al inicio') : describeDuration(minutes)}
    </p>
  );
};

/** «Lunes» para un día; «Lun, Mié y Vie» para varios. */
function describeDays(days: DayOfWeek[]): string {
  if (days.length === 0) return 'Sin días';
  if (days.length === 1) return DAY_NAMES[days[0]];
  const names = days.map((day) => SHORT_DAY_NAMES[day]);
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
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
  const isEditing = Boolean(initialData);

  const initialIsVirtual = initialData ? isSlotVirtual(initialData) : false;

  const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');
  const [professorId, setProfessorId] = useState(initialData?.professorId || '');
  const [modality, setModality] = useState<ClassModality>(initialIsVirtual ? 'virtual' : 'presencial');

  // Días y horas. Una clase nueva puede repetirse en varios días: con «mismo horario» todos usan
  // inicio/fin compartidos; si no, cada día tiene los suyos (se rellenan con los compartidos).
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([initialData?.dayOfWeek || defaultDay]);
  const [sameTime, setSameTime] = useState(true);
  const [sharedTime, setSharedTime] = useState<TimeRange>({
    start: initialData?.startTime || '',
    end: initialData?.endTime || '',
  });
  const [dayTimes, setDayTimes] = useState<Partial<Record<DayOfWeek, TimeRange>>>({});

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
  const isMultiDay = selectedDays.length > 1;
  const usesSharedTime = !isMultiDay || sameTime;

  const timeFor = (day: DayOfWeek): TimeRange => (usesSharedTime ? sharedTime : dayTimes[day] ?? sharedTime);

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSameTimeChange = (checked: boolean) => {
    // Al pasar a horarios por día, cada día parte del horario compartido (no hay que reescribirlo)
    if (!checked) {
      setDayTimes((prev) => {
        const next = { ...prev };
        for (const day of selectedDays) next[day] = prev[day] ?? sharedTime;
        return next;
      });
    }
    setSameTime(checked);
  };

  const setDayTime = (day: DayOfWeek, field: keyof TimeRange, value: string) => {
    setDayTimes((prev) => ({ ...prev, [day]: { ...(prev[day] ?? sharedTime), [field]: value } }));
  };

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
    if (selectedDays.length === 0) {
      setError('Elige al menos un día de clase.');
      return;
    }
    for (const day of selectedDays) {
      const range = timeFor(day);
      const where = usesSharedTime ? '' : ` del ${DAY_NAMES[day].toLowerCase()}`;
      if (!range.start || !range.end) {
        setError(`Indica la hora de inicio y de fin${where}.`);
        return;
      }
      if (toMinutes(range.end) <= toMinutes(range.start)) {
        setError(`La hora de fin${where} debe ser posterior a la de inicio.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const isVirtual = modality === 'virtual';
      const common = {
        subjectId,
        professorId: professorId || undefined,
        modality,
        classroom: isVirtual ? virtualPlatform.trim() || 'Virtual' : classroom.trim() || undefined,
        building: isVirtual ? virtualLink.trim() || undefined : building.trim() || undefined,
        virtualLink: isVirtual ? virtualLink.trim() || undefined : undefined,
      };
      await onSubmit(
        selectedDays.map((day) => {
          const range = timeFor(day);
          return { ...common, dayOfWeek: day, startTime: range.start, endTime: range.end };
        })
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la clase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeInputClass = `${formInputClass} font-mono font-bold`;

  return (
    <FormSheet
      title={isEditing ? 'Editar clase' : 'Nueva clase'}
      subtitle={`${describeDays(selectedDays)} · ${selectedSubject?.name || 'Selecciona una materia'}`}
      onBack={onCancel}
      backLabel="Volver al horario"
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'Actualizar' : isMultiDay ? `Guardar ${selectedDays.length} clases` : 'Guardar'}
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

      <FormSection
        title={isEditing ? 'Día y horario' : 'Días y horario'}
        description={isEditing ? undefined : 'Marca todos los días en que tienes esta materia.'}
      >
        {isEditing ? (
          // Al editar se cambia esta clase (un bloque de un día); para otro día se crea una nueva
          <SegmentedControl
            value={selectedDays[0]}
            onChange={(day) => setSelectedDays([day])}
            options={DAY_OPTIONS}
            ariaLabel="Día de la semana"
          />
        ) : (
          // Chips de filtro M3: selección múltiple, con check al estar marcados
          <div role="group" aria-label="Días de clase" className="flex flex-wrap gap-2">
            {WEEK.map((day) => {
              const selected = selectedDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={selected}
                  aria-label={DAY_NAMES[day]}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 ease-out ${
                    selected
                      ? 'border-transparent bg-[var(--color-md-secondary-container)] pl-2 text-[var(--color-md-on-secondary-container)]'
                      : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/[0.06]'
                  }`}
                >
                  {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                  <span className="sm:hidden">{SHORT_DAY_NAMES[day]}</span>
                  <span className="hidden sm:inline">{DAY_NAMES[day]}</span>
                </button>
              );
            })}
          </div>
        )}

        {isMultiDay && (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[var(--color-md-surface-container)] px-4 py-2.5">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--color-md-on-surface)]">Mismo horario todos los días</span>
              <span className="block text-xs text-[var(--color-md-on-surface-variant)]">
                {sameTime ? 'Desactívalo si algún día empieza o termina a otra hora.' : 'Cada día tiene su propio horario.'}
              </span>
            </span>
            <M3Switch checked={sameTime} onChange={handleSameTimeChange} label="Mismo horario todos los días" />
          </label>
        )}

        {usesSharedTime ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <FormField htmlFor="slot-start" label="Inicio" required>
                <input
                  id="slot-start"
                  type="time"
                  value={sharedTime.start}
                  onChange={(e) => setSharedTime((prev) => ({ ...prev, start: e.target.value }))}
                  className={timeInputClass}
                />
              </FormField>
              <FormField htmlFor="slot-end" label="Fin" required>
                <input
                  id="slot-end"
                  type="time"
                  value={sharedTime.end}
                  onChange={(e) => setSharedTime((prev) => ({ ...prev, end: e.target.value }))}
                  aria-invalid={(durationOf(sharedTime) ?? 1) <= 0}
                  className={timeInputClass}
                />
              </FormField>
            </div>
            <DurationChip range={sharedTime} />
          </>
        ) : (
          // Una fila por día (lista M3): nombre del día, inicio y fin, y la duración
          <ul className="divide-y divide-[var(--color-md-outline-variant)] overflow-hidden rounded-2xl border border-[var(--color-md-outline-variant)]">
            {selectedDays.map((day) => {
              const range = timeFor(day);
              const dayName = DAY_NAMES[day].toLowerCase();
              return (
                <li key={day} className="space-y-2 px-3 py-3 sm:px-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--color-md-on-surface)]">{DAY_NAMES[day]}</span>
                    <DurationChip range={range} compact />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-[var(--color-md-on-surface-variant)]">Inicio</span>
                      <input
                        type="time"
                        value={range.start}
                        onChange={(e) => setDayTime(day, 'start', e.target.value)}
                        aria-label={`Inicio del ${dayName}`}
                        className={timeInputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-[var(--color-md-on-surface-variant)]">Fin</span>
                      <input
                        type="time"
                        value={range.end}
                        onChange={(e) => setDayTime(day, 'end', e.target.value)}
                        aria-label={`Fin del ${dayName}`}
                        aria-invalid={(durationOf(range) ?? 1) <= 0}
                        className={timeInputClass}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
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
