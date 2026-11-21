import React from 'react';
import { Bell, ClipboardList, SquareCheckBig, Sun } from 'lucide-react';
import type { AgendaEventType } from '../types';

/** Ícono de cada tipo: tarea, examen, recordatorio o día libre. */
export const AgendaTypeIcon: React.FC<{ type: AgendaEventType; className?: string }> = ({ type, className = 'h-4 w-4' }) => {
  switch (type) {
    case 'task':
      return <SquareCheckBig className={className} aria-hidden="true" />;
    case 'exam':
      return <ClipboardList className={className} aria-hidden="true" />;
    case 'holiday':
      return <Sun className={className} aria-hidden="true" />;
    default:
      return <Bell className={className} aria-hidden="true" />;
  }
};
