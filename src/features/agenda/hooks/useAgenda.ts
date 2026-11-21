import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../shared/db/AppDatabase';
import { agendaRepository } from '../repositories/agendaRepository';
import type { AgendaEvent, CreateAgendaEventDTO, UpdateAgendaEventDTO } from '../types';

const EMPTY: AgendaEvent[] = [];

/** Eventos de la agenda ordenados por fecha y hora, en vivo desde IndexedDB. */
export function useAgenda() {
  const events = useLiveQuery(
    async () => {
      const all = await db.agendaEvents.toArray();
      return all.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
    },
    [],
    EMPTY
  );

  return {
    events,
    addEvent: (dto: CreateAgendaEventDTO) => agendaRepository.create(dto),
    updateEvent: (id: string, dto: UpdateAgendaEventDTO) => agendaRepository.update(id, dto),
    setDone: (id: string, done: boolean) => agendaRepository.setDone(id, done),
    removeEvent: (id: string) => agendaRepository.delete(id),
  };
}
