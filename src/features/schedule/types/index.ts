export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export const SHORT_DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
  7: 'Dom',
};

export type ClassModality = 'presencial' | 'virtual';

export interface ScheduleSlot {
  id: string;
  subjectId: string;
  professorId?: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:mm" (24h)
  endTime: string;   // "HH:mm" (24h)
  modality?: ClassModality;
  classroom?: string;
  building?: string;
  virtualLink?: string;
  createdAt: string;
}

export type CreateScheduleSlotDTO = Omit<ScheduleSlot, 'id' | 'createdAt'>;
export type UpdateScheduleSlotDTO = Partial<CreateScheduleSlotDTO>;
