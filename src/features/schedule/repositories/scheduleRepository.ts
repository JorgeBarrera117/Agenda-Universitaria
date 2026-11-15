import { db } from '../../../shared/db/AppDatabase';
import { DAY_NAMES, type ScheduleSlot, type CreateScheduleSlotDTO, type UpdateScheduleSlotDTO, type DayOfWeek } from '../types';

export interface IScheduleRepository {
  getAll(): Promise<ScheduleSlot[]>;
  getByDay(day: DayOfWeek): Promise<ScheduleSlot[]>;
  getById(id: string): Promise<ScheduleSlot | undefined>;
  create(data: CreateScheduleSlotDTO): Promise<ScheduleSlot>;
  /** Crea varias clases a la vez (una por día): o se guardan todas, o ninguna. */
  createMany(items: CreateScheduleSlotDTO[]): Promise<ScheduleSlot[]>;
  update(id: string, data: UpdateScheduleSlotDTO): Promise<void>;
  delete(id: string): Promise<void>;
  /** Quita todas las clases del horario semanal. Devuelve cuántas quitó. */
  clearAll(): Promise<number>;
  checkOverlap(slot: { dayOfWeek: DayOfWeek; startTime: string; endTime: string }, excludeId?: string): Promise<ScheduleSlot | undefined>;
}

export class DexieScheduleRepository implements IScheduleRepository {
  async getAll(): Promise<ScheduleSlot[]> {
    return db.scheduleSlots.toArray();
  }

  async getByDay(day: DayOfWeek): Promise<ScheduleSlot[]> {
    const slots = await db.scheduleSlots.where('dayOfWeek').equals(day).toArray();
    return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  async getById(id: string): Promise<ScheduleSlot | undefined> {
    return db.scheduleSlots.get(id);
  }

  async checkOverlap(
    slot: { dayOfWeek: DayOfWeek; startTime: string; endTime: string },
    excludeId?: string
  ): Promise<ScheduleSlot | undefined> {
    const daySlots = await db.scheduleSlots.where('dayOfWeek').equals(slot.dayOfWeek).toArray();
    return daySlots.find((existing) => {
      if (excludeId && existing.id === excludeId) return false;
      // Condición estándar de solapamiento de intervalos temporales: A_start < B_end && A_end > B_start
      return slot.startTime < existing.endTime && slot.endTime > existing.startTime;
    });
  }

  async create(data: CreateScheduleSlotDTO): Promise<ScheduleSlot> {
    if (data.startTime >= data.endTime) {
      throw new Error('La hora de inicio debe ser menor que la hora de término.');
    }

    const overlap = await this.checkOverlap({
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
    });

    if (overlap) {
      throw new Error(`Existe un solapamiento con otra clase en el horario (${overlap.startTime} - ${overlap.endTime}).`);
    }

    const slot: ScheduleSlot = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await db.scheduleSlots.add(slot);
    return slot;
  }

  async createMany(items: CreateScheduleSlotDTO[]): Promise<ScheduleSlot[]> {
    // En una transacción: si un día se cruza con otra clase, no queda la materia a medio cargar
    return db.transaction('rw', db.scheduleSlots, async () => {
      for (const data of items) {
        const day = DAY_NAMES[data.dayOfWeek].toLowerCase();
        if (data.startTime >= data.endTime) {
          throw new Error(`El ${day}: la hora de inicio debe ser menor que la de término.`);
        }
        const overlap = await this.checkOverlap(data);
        if (overlap) {
          throw new Error(`El ${day} se cruza con otra clase de tu horario (${overlap.startTime} – ${overlap.endTime}).`);
        }
      }
      const now = new Date().toISOString();
      const created = items.map((data): ScheduleSlot => ({ ...data, id: crypto.randomUUID(), createdAt: now }));
      await db.scheduleSlots.bulkAdd(created);
      return created;
    });
  }

  async update(id: string, data: UpdateScheduleSlotDTO): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Clase de horario no encontrada.');

    const targetDay = data.dayOfWeek ?? existing.dayOfWeek;
    const targetStart = data.startTime ?? existing.startTime;
    const targetEnd = data.endTime ?? existing.endTime;

    if (targetStart >= targetEnd) {
      throw new Error('La hora de inicio debe ser menor que la hora de término.');
    }

    const overlap = await this.checkOverlap(
      { dayOfWeek: targetDay, startTime: targetStart, endTime: targetEnd },
      id
    );

    if (overlap) {
      throw new Error(`Existe un solapamiento con otra clase en el horario (${overlap.startTime} - ${overlap.endTime}).`);
    }

    await db.scheduleSlots.update(id, data);
  }

  async delete(id: string): Promise<void> {
    await db.scheduleSlots.delete(id);
  }

  async clearAll(): Promise<number> {
    const count = await db.scheduleSlots.count();
    await db.scheduleSlots.clear();
    return count;
  }
}

export const scheduleRepository = new DexieScheduleRepository();
