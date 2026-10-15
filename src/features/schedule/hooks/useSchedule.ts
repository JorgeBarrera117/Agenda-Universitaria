import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../shared/db/AppDatabase';
import { scheduleRepository } from '../repositories/scheduleRepository';
import type { CreateScheduleSlotDTO, UpdateScheduleSlotDTO, DayOfWeek } from '../types';

export function useSchedule() {
  const slots = useLiveQuery(
    () => db.scheduleSlots.toArray(),
    []
  );

  const addSlot = async (dto: CreateScheduleSlotDTO) => {
    return scheduleRepository.create(dto);
  };

  const updateSlot = async (id: string, dto: UpdateScheduleSlotDTO) => {
    return scheduleRepository.update(id, dto);
  };

  const removeSlot = async (id: string) => {
    return scheduleRepository.delete(id);
  };

  const getSlotsByDay = (day: DayOfWeek) => {
    if (!slots) return [];
    return slots
      .filter((s) => s.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  return {
    slots: slots ?? [],
    isLoading: slots === undefined,
    addSlot,
    updateSlot,
    removeSlot,
    getSlotsByDay,
  };
}
