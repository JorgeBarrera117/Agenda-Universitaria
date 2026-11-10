import { BellOff, BookOpen, GraduationCap, Laptop, MessageSquareText, PenLine, type LucideIcon } from 'lucide-react';

/** Longitud máxima de la frase de estado (cabe en la barra superior de un móvil). */
export const STUDENT_STATUS_MAX_LENGTH = 35;

/** Frases rápidas de estado; el texto es lo que se guarda y el ícono acompaña en la UI. */
export const STUDENT_STATUS_PRESETS: readonly { text: string; icon: LucideIcon }[] = [
  { text: 'Estudiando', icon: BookOpen },
  { text: 'En clases', icon: GraduationCap },
  { text: 'Exámenes', icon: PenLine },
  { text: 'Modo silencio', icon: BellOff },
  { text: 'Concentrado', icon: Laptop },
];

/** Ícono genérico para una frase escrita a mano. */
export const CUSTOM_STATUS_ICON: LucideIcon = MessageSquareText;

/** Frase rápida que coincide con el texto (sin distinguir mayúsculas), si la hay. */
export function findStatusPreset(text: string): (typeof STUDENT_STATUS_PRESETS)[number] | undefined {
  const normalized = text.trim().toLowerCase();
  return STUDENT_STATUS_PRESETS.find((p) => p.text.toLowerCase() === normalized);
}

/** Iniciales (máx. 2) del nombre del estudiante para el monograma del avatar. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
