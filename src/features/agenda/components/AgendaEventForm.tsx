import React, { useState } from 'react';
import { BellOff } from 'lucide-react';
import { FormField, FormSection, FormSheet, SegmentedControl, formInputClass } from '../../../shared/components/form';
import { M3Select } from '../../../shared/components/M3Select';
import { DatePickerField } from '../../../shared/components/pickers/DatePickerField';
import { TimePickerField } from '../../../shared/components/pickers/TimePickerField';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import type { Subject } from '../../subjects/types';
import {
  AGENDA_LEAD_LABEL,
  AGENDA_REMINDER_LEADS,
  type AgendaEvent,
  type AgendaEventType,
  type AgendaReminderLead,
  type CreateAgendaEventDTO,
} from '../types';
import { isDateKey, isTimeValue } from '../utils/agendaDates';
import { AgendaTypeIcon } from './AgendaTypeIcon';

interface AgendaEventFormProps {
  initialData?: AgendaEvent;
  /** Fecha propuesta para uno nuevo (el día elegido en el calendario o hoy). */
  defaultDate: string;
  subjects: readonly Subject[];
  notificationsEnabled: boolean;
  onSubmit: (data: CreateAgendaEventDTO) => Promise<void>;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHoliday = type === 'holiday';
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
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setIsSubmitting(false);
    }
  };

  return (
    <FormSheet
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
