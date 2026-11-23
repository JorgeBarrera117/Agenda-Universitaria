import React from 'react';
import { CalendarRange, Contact, FileText, NotebookPen, BookOpen } from 'lucide-react';
import type { RoomItemKind } from '../types/room';

/** Estilos compartidos de la sala (solo tokens del tema: siguen la paleta dinámica). */

export const ROOM_FILLED_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-md-primary)] px-5 text-sm font-bold text-[var(--color-md-on-primary)] shadow-xs transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4';

export const ROOM_TONAL_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-md-secondary-container)] px-4 text-sm font-bold text-[var(--color-md-on-secondary-container)] transition-all duration-150 hover:brightness-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4';

export const ROOM_TEXT_BUTTON =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10 active:scale-[0.98] disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4';

export const ROOM_DANGER_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-500/12 px-4 text-sm font-bold text-red-700 dark:bg-red-400/15 dark:text-red-200 transition-all duration-150 hover:brightness-95 active:scale-[0.98] disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4';

export const ROOM_ICON_BUTTON =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-on-surface)]/8 active:scale-95 disabled:opacity-40 [&>svg]:h-5 [&>svg]:w-5';

export const ROOM_INPUT =
  'w-full rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] px-4 py-3 text-sm text-[var(--color-md-on-surface)] placeholder:text-[var(--color-md-on-surface-variant)]/70 outline-none transition-colors focus:border-[var(--color-md-primary)]';

export const ROOM_SECTION_TITLE = 'text-xs font-semibold uppercase tracking-wider text-[var(--color-md-primary)]';

export const ROOM_ITEM_ICON: Record<RoomItemKind, React.ReactNode> = {
  schedule: <CalendarRange aria-hidden="true" />,
  subject: <BookOpen aria-hidden="true" />,
  contact: <Contact aria-hidden="true" />,
  note: <NotebookPen aria-hidden="true" />,
  document: <FileText aria-hidden="true" />,
};
