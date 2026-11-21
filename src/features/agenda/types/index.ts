/**
 * Agenda: tareas, exámenes, recordatorios y días libres con fecha concreta (a diferencia del
 * horario, que se repite cada semana).
 */
export type AgendaEventType = 'task' | 'exam' | 'reminder' | 'holiday';

/** Cuándo avisar antes del evento. Sin hora, el evento cuenta como a las 08:00 de su día. */
export type AgendaReminderLead = 'none' | 'at' | '1h' | '1d' | '2d';

export interface AgendaEvent {
  id: string;
  type: AgendaEventType;
  title: string;
  /** Día, "YYYY-MM-DD" (hora local). */
  date: string;
  /** Último día de un período libre (vacaciones), "YYYY-MM-DD"; solo para 'holiday'. */
  endDate?: string;
  /** Hora opcional, "HH:mm" (24 h). */
  time?: string;
  /** Materia opcional: le da el color y el nombre en la tarjeta. */
  subjectId?: string;
  /** Aula o lugar (exámenes). */
  place?: string;
  notes?: string;
  remind: AgendaReminderLead;
  /** Solo tareas: marcada como hecha. */
  done?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateAgendaEventDTO = Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAgendaEventDTO = Partial<CreateAgendaEventDTO>;

export const AGENDA_EVENT_TYPES: readonly AgendaEventType[] = ['task', 'exam', 'reminder', 'holiday'];
export const AGENDA_REMINDER_LEADS: readonly AgendaReminderLead[] = ['none', 'at', '1h', '1d', '2d'];

export const AGENDA_TYPE_LABEL: Record<AgendaEventType, string> = {
  task: 'Tarea',
  exam: 'Examen',
  reminder: 'Recordatorio',
  holiday: 'Día libre',
};

export const AGENDA_LEAD_LABEL: Record<AgendaReminderLead, string> = {
  none: 'Sin aviso',
  at: 'A la hora',
  '1h': '1 hora antes',
  '1d': '1 día antes',
  '2d': '2 días antes',
};
