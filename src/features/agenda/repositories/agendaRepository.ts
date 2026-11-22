import { db } from '../../../shared/db/AppDatabase';
import { AGENDA_REPEAT_MAX, type AgendaChecklistItem, type AgendaEvent, type AgendaRepeat, type CreateAgendaEventDTO, type UpdateAgendaEventDTO } from '../types';
import { repeatDates } from '../utils/agendaDates';

export interface IAgendaRepository {
  getAll(): Promise<AgendaEvent[]>;
  create(data: CreateAgendaEventDTO): Promise<AgendaEvent>;
  /** Crea el evento en cada fecha de la repetición; devuelve cuántos creó. */
  createSeries(data: CreateAgendaEventDTO, repeat: AgendaRepeat): Promise<number>;
  setChecklist(id: string, checklist: AgendaChecklistItem[]): Promise<void>;
  /** Elimina todos los eventos de una serie. */
  deleteSeries(seriesId: string): Promise<number>;
  update(id: string, data: UpdateAgendaEventDTO): Promise<void>;
  setDone(id: string, done: boolean): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Quita lo que no aplica al tipo (hora y aviso en días libres, "hecha" fuera de tareas). */
function normalize<T extends UpdateAgendaEventDTO>(data: T): T {
  const result = { ...data };
  if (result.type === 'holiday') {
    result.time = undefined;
    result.remind = 'none';
    result.subjectId = undefined;
    result.done = undefined;
  } else if (result.type) {
    result.endDate = undefined;
    if (result.type !== 'task') {
      result.done = undefined;
      result.checklist = undefined;
    }
    if (result.type !== 'exam') result.study = undefined;
  }
  if (result.checklist) {
    result.checklist = result.checklist
      .map((item) => ({ ...item, text: item.text.trim().slice(0, 140) }))
      .filter((item) => item.text)
      .slice(0, 30);
    if (result.checklist.length === 0) result.checklist = undefined;
  }
  if (result.study && result.study.length === 0) result.study = undefined;
  if (typeof result.title === 'string') result.title = result.title.trim().slice(0, 140);
  return result;
}

export class DexieAgendaRepository implements IAgendaRepository {
  async getAll(): Promise<AgendaEvent[]> {
    return db.agendaEvents.toArray();
  }

  async create(data: CreateAgendaEventDTO): Promise<AgendaEvent> {
    const now = new Date().toISOString();
    const event: AgendaEvent = { ...normalize(data), id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    await db.agendaEvents.add(event);
    return event;
  }

  async createSeries(data: CreateAgendaEventDTO, repeat: AgendaRepeat): Promise<number> {
    const now = new Date().toISOString();
    const seriesId = crypto.randomUUID();
    const base = normalize(data);
    const events: AgendaEvent[] = repeatDates(base.date, repeat.everyWeeks, repeat.until, AGENDA_REPEAT_MAX).map((date) => ({
      ...base,
      date,
      seriesId,
      // Cada fecha con sus propias subtareas sin marcar
      checklist: base.checklist?.map((item) => ({ ...item, id: crypto.randomUUID(), done: false })),
      done: base.type === 'task' ? false : undefined,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }));
    await db.agendaEvents.bulkAdd(events);
    return events.length;
  }

  async setChecklist(id: string, checklist: AgendaChecklistItem[]): Promise<void> {
    await db.agendaEvents.update(id, { checklist, updatedAt: new Date().toISOString() });
  }

  async deleteSeries(seriesId: string): Promise<number> {
    return db.agendaEvents.filter((event) => event.seriesId === seriesId).delete();
  }

  async update(id: string, data: UpdateAgendaEventDTO): Promise<void> {
    await db.agendaEvents.update(id, { ...normalize(data), updatedAt: new Date().toISOString() });
  }

  async setDone(id: string, done: boolean): Promise<void> {
    await db.agendaEvents.update(id, { done, updatedAt: new Date().toISOString() });
  }

  async delete(id: string): Promise<void> {
    await db.agendaEvents.delete(id);
  }
}

export const agendaRepository = new DexieAgendaRepository();
