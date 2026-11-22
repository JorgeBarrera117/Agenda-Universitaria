import React, { useState } from 'react';
import { Bell, BellOff, CalendarDays, Check, Clock, ListChecks, Plus, Repeat, X } from 'lucide-react';
import { FormField, FormSection, FormSheet, SegmentedControl, formInputClass } from '../../../shared/components/form';
import { M3Select } from '../../../shared/components/M3Select';
import { DatePickerField } from '../../../shared/components/pickers/DatePickerField';
import { TimePickerField } from '../../../shared/components/pickers/TimePickerField';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { DetailChip, DetailHero, DetailIconTile } from '../../../shared/components/detail/DetailKit';
import { useTimeFormatter } from '../../settings/hooks/useTimeFormatter';
import { mediumDateLabel } from '../../../shared/utils/calendarDates';
import type { Subject } from '../../subjects/types';
import {
  AGENDA_LEAD_LABEL,
  AGENDA_TYPE_LABEL,
  AGENDA_REMINDER_LEADS,
  AGENDA_REPEAT_MAX,
  AGENDA_STUDY_LABEL,
  AGENDA_STUDY_LEADS,
  type AgendaChecklistItem,
  type AgendaRepeat,
  type AgendaStudyLead,
  type AgendaEvent,
  type AgendaEventType,
  type AgendaReminderLead,
  type CreateAgendaEventDTO,
} from '../types';
import { addDaysToKey, isDateKey, isTimeValue, repeatDates } from '../utils/agendaDates';
import { AgendaTypeIcon } from './AgendaTypeIcon';
import { agendaEventColor } from './agendaVisuals';

interface AgendaEventFormProps {
  initialData?: AgendaEvent;
  /** Fecha propuesta para uno nuevo (el día elegido en el calendario o hoy). */
  defaultDate: string;
  subjects: readonly Subject[];
  notificationsEnabled: boolean;
  /** Con `repeat`, se crea en cada fecha de la repetición (solo al crear). */
  onSubmit: (data: CreateAgendaEventDTO, repeat?: AgendaRepeat) => Promise<void>;
  onCancel: () => void;
}

const TYPE_OPTIONS: { value: AgendaEventType; label: string; shortLabel: string }[] = [
  { value: 'task', label: 'Tarea', shortLabel: 'Tarea' },
  { value: 'exam', label: 'Examen', shortLabel: 'Examen' },
  { value: 'reminder', label: 'Recordatorio', shortLabel: 'Aviso' },
  { value: 'holiday', label: 'Día libre', shortLabel: 'Libre' },
];

const TITLE_HINT: Record<AgendaEventType, string> = {
  task: 'Ej.: Entregar el proyecto',
  exam: 'Ej.: Parcial 2',
  reminder: 'Ej.: Llevar la calculadora',
  holiday: 'Ej.: Carnaval, vacaciones',
};

/** Aviso por defecto de cada tipo al crear (el estudiante lo puede cambiar). */
const DEFAULT_LEAD: Record<AgendaEventType, AgendaReminderLead> = { task: '1d', exam: '1d', reminder: 'at', holiday: 'none' };

/**
 * Formulario de la agenda (mismo FormSheet que los demás formularios): tipo, título, fecha y hora,
 * materia, aviso y notas. Un día libre puede abarcar varios días (vacaciones) y no lleva hora ni aviso.
 */
export const AgendaEventForm: React.FC<AgendaEventFormProps> = ({
  initialData,
  defaultDate,
  subjects,
  notificationsEnabled,
  onSubmit,
  onCancel,
}) => {
  const [type, setType] = useState<AgendaEventType>(initialData?.type ?? 'task');
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [date, setDate] = useState(initialData?.date ?? defaultDate);
  const [endDate, setEndDate] = useState(initialData?.endDate ?? '');
  const [time, setTime] = useState(initialData?.time ?? '');
  const [subjectId, setSubjectId] = useState(initialData?.subjectId ?? '');
  const [place, setPlace] = useState(initialData?.place ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [remind, setRemind] = useState<AgendaReminderLead>(initialData?.remind ?? DEFAULT_LEAD.task);
  const [remindTouched, setRemindTouched] = useState(Boolean(initialData));
  const [checklist, setChecklist] = useState<AgendaChecklistItem[]>(initialData?.checklist ?? []);
  const [newStep, setNewStep] = useState('');
  // Repaso escalonado propuesto para los exámenes nuevos: 3 días y 1 día antes
  const [study, setStudy] = useState<AgendaStudyLead[]>(initialData ? initialData.study ?? [] : ['3d', '1d']);
  const [repeatEvery, setRepeatEvery] = useState<'none' | '1' | '2'>('none');
  const [repeatUntil, setRepeatUntil] = useState(() => addDaysToKey(initialData?.date ?? defaultDate, 7 * 8));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHoliday = type === 'holiday';
  const canRepeat = !initialData && !isHoliday;
  const repeatCount =
    canRepeat && repeatEvery !== 'none' && isDateKey(date) && isDateKey(repeatUntil)
      ? repeatDates(date, Number(repeatEvery), repeatUntil, AGENDA_REPEAT_MAX).length
      : 0;

  const addStep = () => {
    const text = newStep.trim();
    if (!text || checklist.length >= 30) return;
    setChecklist((prev) => [...prev, { id: crypto.randomUUID(), text: text.slice(0, 140), done: false }]);
    setNewStep('');
  };

  const toggleStudy = (lead: AgendaStudyLead) =>
    setStudy((prev) => (prev.includes(lead) ? prev.filter((l) => l !== lead) : AGENDA_STUDY_LEADS.filter((l) => l === lead || prev.includes(l))));
  const timeFormatter = useTimeFormatter();
  const activeSubjects = subjects.filter((s) => !s.isArchived || s.id === subjectId);

  const changeType = (next: AgendaEventType) => {
    setType(next);
    // Mientras el estudiante no elija un aviso, se ajusta al tipo
    if (!remindTouched) setRemind(DEFAULT_LEAD[next]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Escribe un título.');
      return;
    }
    if (!isDateKey(date)) {
      setError('Elige una fecha válida.');
      return;
    }
    if (isHoliday && endDate && (!isDateKey(endDate) || endDate < date)) {
      setError('El último día no puede ser anterior al primero.');
      return;
    }
    if (!isHoliday && time && !isTimeValue(time)) {
      setError('La hora no es válida.');
      return;
    }
    if (canRepeat && repeatEvery !== 'none' && repeatCount < 2) {
      setError('Para repetirlo, la fecha «Hasta» debe ser al menos una semana después.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        type,
        title: title.trim(),
        date,
        endDate: isHoliday && endDate && endDate > date ? endDate : undefined,
        time: !isHoliday && time ? time : undefined,
        subjectId: !isHoliday && subjectId ? subjectId : undefined,
        place: type === 'exam' && place.trim() ? place.trim() : undefined,
        notes: notes.trim() || undefined,
        remind: isHoliday ? 'none' : remind,
        done: type === 'task' ? Boolean(initialData?.done) : undefined,
        checklist: type === 'task' && checklist.length ? checklist : undefined,
        study: type === 'exam' && study.length ? study : undefined,
        seriesId: initialData?.seriesId,
      }, canRepeat && repeatEvery !== 'none' ? { everyWeeks: repeatEvery === '2' ? 2 : 1, until: repeatUntil } : undefined);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setIsSubmitting(false);
    }
  };

  // Vista previa: la misma tarjeta de identidad que tendrá su ficha, al día con lo que se escribe
  const previewSubject = !isHoliday && subjectId ? subjects.find((s) => s.id === subjectId) : undefined;
  const previewColor = agendaEventColor({ type, subjectId: isHoliday ? undefined : subjectId || undefined }, subjects);
  const previewDate = isDateKey(date)
    ? isHoliday && isDateKey(endDate) && endDate > date
      ? `${mediumDateLabel(date)} – ${mediumDateLabel(endDate)}`
      : mediumDateLabel(date)
    : null;
  const preview = (
    <DetailHero
      compact
      color={previewColor}
      leading={
        <DetailIconTile color={previewColor} size="md">
          <AgendaTypeIcon type={type} className="h-6 w-6" />
        </DetailIconTile>
      }
      kicker={`${AGENDA_TYPE_LABEL[type]} · ${isHoliday ? 'Sin avisos de clase' : previewSubject?.name ?? 'Personal'}`}
      title={title.trim() || <span className="text-[var(--color-md-on-surface-variant)]">Sin título</span>}
      chips={
        <>
          {previewDate && <DetailChip icon={<CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}>{previewDate}</DetailChip>}
          {!isHoliday && time && isTimeValue(time) && (
            <DetailChip icon={<Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}>{timeFormatter.time(time)}</DetailChip>
          )}
          {!isHoliday && remind !== 'none' && (
            <DetailChip icon={<Bell className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}>{AGENDA_LEAD_LABEL[remind]}</DetailChip>
          )}
          {type === 'task' && checklist.length > 0 && (
            <DetailChip icon={<ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}>
              {checklist.length} {checklist.length === 1 ? 'paso' : 'pasos'}
            </DetailChip>
          )}
          {repeatCount > 1 && (
            <DetailChip tone="tonal" icon={<Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}>
              {repeatCount} fechas
            </DetailChip>
          )}
        </>
      }
    />
  );

  return (
    <FormSheet
      preview={preview}
      title={initialData ? 'Editar en la agenda' : 'Nuevo en la agenda'}
      subtitle={title.trim() || 'Tareas, exámenes, recordatorios y días libres'}
      onBack={onCancel}
      backLabel="Volver a la agenda"
      onSubmit={handleSubmit}
      submitLabel={initialData ? 'Actualizar' : 'Guardar'}
      isSubmitting={isSubmitting}
      error={error}
      onDismissError={() => setError(null)}
    >
      <FormSection title="Tipo">
        <SegmentedControl
          value={type}
          onChange={changeType}
          ariaLabel="Tipo"
          options={TYPE_OPTIONS.map((option) => ({ ...option, icon: <AgendaTypeIcon type={option.value} className="h-4 w-4 shrink-0" /> }))}
        />
        {isHoliday && (
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">
            Ese día (o esos días) la app no te avisará de tus clases. Útil para feriados, Carnaval o vacaciones.
          </p>
        )}
      </FormSection>

      <FormSection>
        <FormField htmlFor="agenda-title" label="Título" required>
          <input
            id="agenda-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={TITLE_HINT[type]}
            maxLength={140}
            className={formInputClass}
            autoComplete="off"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField htmlFor="agenda-date" label={isHoliday ? 'Desde' : 'Fecha'} required>
            <DatePickerField id="agenda-date" value={date} onChange={setDate} dialogTitle={isHoliday ? 'Primer día libre' : 'Fecha'} />
          </FormField>
          {isHoliday ? (
            <FormField htmlFor="agenda-end" label="Hasta (opcional)">
              <DatePickerField
                id="agenda-end"
                value={endDate}
                min={date}
                onChange={setEndDate}
                allowClear
                placeholder="Solo un día"
                dialogTitle="Último día libre"
              />
            </FormField>
          ) : (
            <FormField htmlFor="agenda-time" label="Hora (opcional)">
              <TimePickerField id="agenda-time" value={time} onChange={setTime} allowClear placeholder="Sin hora" />
            </FormField>
          )}
        </div>

        {type === 'exam' && (
          <FormField htmlFor="agenda-place" label="Aula o lugar (opcional)">
            <input
              id="agenda-place"
              type="text"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Ej.: Aula 204"
              maxLength={80}
              className={formInputClass}
            />
          </FormField>
        )}
      </FormSection>

      {!isHoliday && (
        <FormSection title="Materia" description="Le da su color en la agenda y en el calendario.">
          <M3Select<string>
            value={subjectId}
            onChange={setSubjectId}
            placeholder="Ninguna (personal)"
            options={[
              { value: '', label: 'Ninguna (personal)' },
              ...activeSubjects.map((s) => ({
                value: s.id,
                label: s.name,
                sublabel: s.code,
                icon: <SubjectBadge icon={s.icon} color={s.color} size="sm" />,
              })),
            ]}
          />
        </FormSection>
      )}

      {type === 'task' && (
        <FormSection title="Subtareas" description="Divide la tarea en pasos y márcalos a medida que avanzas.">
          {checklist.length > 0 && (
            <ul className="space-y-1.5">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-2 rounded-xl bg-[var(--color-md-surface-container)] py-1 pl-3 pr-1">
                  <ListChecks className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-words text-sm">{item.text}</span>
                  <button
                    type="button"
                    onClick={() => setChecklist((prev) => prev.filter((i) => i.id !== item.id))}
                    aria-label={`Quitar «${item.text}»`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => {
                // Enter agrega el paso (no envía el formulario)
                if (e.key !== 'Enter') return;
                e.preventDefault();
                addStep();
              }}
              placeholder="Ej.: Buscar bibliografía"
              maxLength={140}
              aria-label="Nuevo paso"
              className={`${formInputClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={addStep}
              disabled={!newStep.trim()}
              aria-label="Agregar paso"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] transition-opacity disabled:opacity-40"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </FormSection>
      )}

      {!isHoliday && (
        <FormSection title="Avisarme">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cuándo avisar">
            {AGENDA_REMINDER_LEADS.map((lead) => {
              const selected = remind === lead;
              return (
                <button
                  key={lead}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setRemind(lead);
                    setRemindTouched(true);
                  }}
                  className={`min-h-10 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                    selected
                      ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                      : 'border border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)]'
                  }`}
                >
                  {AGENDA_LEAD_LABEL[lead]}
                </button>
              );
            })}
          </div>
          {!time && remind !== 'none' && (
            <p className="text-xs text-[var(--color-md-on-surface-variant)]">Sin hora, el aviso se calcula desde las 08:00 de ese día.</p>
          )}
          {!notificationsEnabled && remind !== 'none' && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[#8C5000] dark:text-[#FFB86A]">
              <BellOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Las notificaciones están apagadas en Ajustes: no llegará el aviso.
            </p>
          )}
        </FormSection>
      )}

      {type === 'exam' && (
        <FormSection title="Avisos de repaso" description="Te recordamos estudiar con tiempo, a las 18:00 de esos días.">
          <div className="flex flex-wrap gap-2">
            {AGENDA_STUDY_LEADS.map((lead) => {
              const selected = study.includes(lead);
              return (
                <button
                  key={lead}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleStudy(lead)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                    selected
                      ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                      : 'border border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)]'
                  }`}
                >
                  {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  {AGENDA_STUDY_LABEL[lead]}
                </button>
              );
            })}
          </div>
        </FormSection>
      )}

      {canRepeat && (
        <FormSection title="Se repite" description="Para entregas o quices de cada semana: se crea en cada fecha.">
          <SegmentedControl
            value={repeatEvery}
            onChange={setRepeatEvery}
            ariaLabel="Se repite"
            options={[
              { value: 'none', label: 'No se repite', shortLabel: 'No' },
              { value: '1', label: 'Cada semana', shortLabel: 'Semanal' },
              { value: '2', label: 'Cada 2 semanas', shortLabel: 'Quincenal' },
            ]}
          />
          {repeatEvery !== 'none' && (
            <>
              <FormField htmlFor="agenda-repeat-until" label="Hasta">
                <DatePickerField id="agenda-repeat-until" value={repeatUntil} min={date} onChange={setRepeatUntil} dialogTitle="Última fecha" />
              </FormField>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-md-on-surface-variant)]">
                <Repeat className="h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                {repeatCount > 1
                  ? `Se creará en ${repeatCount} fechas${repeatCount === AGENDA_REPEAT_MAX ? ' (el máximo)' : ''}.`
                  : 'Elige una fecha «Hasta» posterior.'}
              </p>
            </>
          )}
        </FormSection>
      )}

      <FormSection>
        <FormField htmlFor="agenda-notes" label="Notas (opcional)">
          <textarea
            id="agenda-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            className={`${formInputClass} resize-y`}
            placeholder="Temas, materiales, qué entregar…"
          />
        </FormField>
      </FormSection>
    </FormSheet>
  );
};
