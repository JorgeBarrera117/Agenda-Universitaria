import type { ScheduleSlot } from '../types';

type SlotLocation = Pick<ScheduleSlot, 'modality' | 'classroom' | 'building'>;

const VIRTUAL_KEYWORDS = ['virtual', 'zoom', 'teams', 'meet', 'online'];

/**
 * Indica si una clase es virtual. La modalidad explícita manda; para bloques antiguos sin
 * modalidad se deduce por palabras clave en el aula o el edificio.
 */
export function isSlotVirtual(slot?: SlotLocation): boolean {
  if (!slot) return false;
  if (slot.modality === 'virtual') return true;
  if (slot.modality === 'presencial') return false;
  const classroom = (slot.classroom || '').toLowerCase();
  const building = (slot.building || '').toLowerCase();
  return (
    VIRTUAL_KEYWORDS.some((k) => classroom.includes(k)) ||
    building.includes('virtual') ||
    building.includes('online')
  );
}

/** Plataforma de la clase virtual según su enlace («Zoom», «Meet», «Teams») o null si no se reconoce. */
export function meetingPlatform(link: string | undefined): string | null {
  const value = (link || '').toLowerCase();
  if (value.includes('zoom.')) return 'Zoom';
  if (value.includes('meet.google.')) return 'Meet';
  if (value.includes('teams.microsoft.') || value.includes('teams.live.')) return 'Teams';
  if (value.includes('webex.')) return 'Webex';
  return null;
}

/** Texto de ubicación legible: "Aula 204 (Edificio A)", "Zoom" o null si no hay datos. */
export function describeSlotLocation(slot: SlotLocation): string | null {
  const classroom = slot.classroom?.trim();
  if (isSlotVirtual(slot)) {
    return classroom && classroom.toLowerCase() !== 'virtual' ? classroom : null;
  }
  if (!classroom) return null;
  return slot.building ? `${classroom} (${slot.building})` : classroom;
}
