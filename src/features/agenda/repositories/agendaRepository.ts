import { db } from '../../../shared/db/AppDatabase';
import type { AgendaEvent, CreateAgendaEventDTO, UpdateAgendaEventDTO } from '../types';

export interface IAgendaRepository {
  getAll(): Promise<AgendaEvent[]>;
  create(data: CreateAgendaEventDTO): Promise<AgendaEvent>;
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
    if (result.type !== 'task') result.done = undefined;
  }
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
