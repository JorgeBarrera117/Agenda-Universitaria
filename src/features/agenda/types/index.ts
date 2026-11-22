/**
 * Agenda: tareas, exámenes, recordatorios y días libres con fecha concreta (a diferencia del
 * horario, que se repite cada semana).
 */
export type AgendaEventType = 'task' | 'exam' | 'reminder' | 'holiday';

/** Cuándo avisar antes del evento. Sin hora, el evento cuenta como a las 08:00 de su día. */
export type AgendaReminderLead = 'none' | 'at' | '1h' | '1d' | '2d';

/** Avisos de repaso de un examen: días antes, a las 18:00. */
export type AgendaStudyLead = '7d' | '3d' | '1d';

/** Paso de una tarea (subtarea) que se marca por separado. */
export interface AgendaChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** Repetición al crear: se crean eventos reales (uno por fecha) unidos por seriesId. */
export interface AgendaRepeat {
  /** Cada cuántas semanas. */
  everyWeeks: 1 | 2;
  /** Último día posible, "YYYY-MM-DD". */
  until: string;
}

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
  /** Solo tareas: subtareas. */
  checklist?: AgendaChecklistItem[];
  /** Solo exámenes: avisos de repaso. */
  study?: AgendaStudyLead[];
  /** Eventos creados juntos con "Se repite" comparten este id. */
  seriesId?: string;
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

export const AGENDA_STUDY_LEADS: readonly AgendaStudyLead[] = ['7d', '3d', '1d'];

export const AGENDA_STUDY_LABEL: Record<AgendaStudyLead, string> = {
  '7d': '1 semana antes',
  '3d': '3 días antes',
  '1d': '1 día antes',
};

export const AGENDA_STUDY_DAYS: Record<AgendaStudyLead, number> = { '7d': 7, '3d': 3, '1d': 1 };

/** Máximo de fechas que crea una repetición (un semestre largo de clases semanales). */
export const AGENDA_REPEAT_MAX = 30;

export const AGENDA_LEAD_LABEL: Record<AgendaReminderLead, string> = {
  none: 'Sin aviso',
  at: 'A la hora',
  '1h': '1 hora antes',
  '1d': '1 día antes',
  '2d': '2 días antes',
};
