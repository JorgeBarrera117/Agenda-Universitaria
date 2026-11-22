import type { AgendaEvent } from '../types';
import { eventCoversDay } from './agendaDates';

export type AgendaStatusTone = 'done' | 'danger' | 'today' | 'past' | 'upcoming';

export interface AgendaStatus {
  label: string;
  tone: AgendaStatusTone;
}

/**
 * Estado de un evento respecto a hoy: Hecha / Vencida / Pendiente (tareas) o Hoy / Ya pasó /
 * Próximo (lo demás). Así un recordatorio de ayer no parece "pendiente" al verlo en el calendario.
 */
export function agendaStatus(event: AgendaEvent, todayKey: string): AgendaStatus {
  const lastDay = event.endDate && event.endDate > event.date ? event.endDate : event.date;
  if (event.type === 'task') {
    if (event.done) return { label: 'Hecha', tone: 'done' };
    if (event.date < todayKey) return { label: 'Vencida', tone: 'danger' };
    if (event.date === todayKey) return { label: 'Para hoy', tone: 'today' };
    return { label: 'Pendiente', tone: 'upcoming' };
  }
  if (lastDay < todayKey) return { label: 'Ya pasó', tone: 'past' };
  if (eventCoversDay(event, todayKey)) return { label: 'Hoy', tone: 'today' };
  return { label: 'Próximo', tone: 'upcoming' };
}

export const AGENDA_STATUS_CLASS: Record<AgendaStatusTone, string> = {
  done: 'bg-[#C4EED0] text-[#00210E] dark:bg-[#1F5131] dark:text-[#C4EED0]',
  danger: 'bg-[#FFDAD6] text-[#410002] dark:bg-[#93000A] dark:text-[#FFDAD6]',
  today: 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]',
  past: 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)]',
  upcoming: 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]',
};
