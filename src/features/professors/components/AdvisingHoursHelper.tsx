import React, { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { TimePickerField } from '../../../shared/components/pickers/TimePickerField';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { formatClockTime } from '../../../shared/utils/timeFormat';

interface AdvisingHoursHelperProps {
  /** Recibe la línea lista ("Martes y Jueves de 14:00 a 16:00") para sumarla al texto. */
  onAdd: (line: string) => void;
}

const DAYS = [
  { short: 'L', name: 'Lunes' },
  { short: 'M', name: 'Martes' },
  { short: 'X', name: 'Miércoles' },
  { short: 'J', name: 'Jueves' },
  { short: 'V', name: 'Viernes' },
  { short: 'S', name: 'Sábado' },
];

/** "Lunes", "Lunes y Martes", "Lunes, Miércoles y Viernes". */
function joinDays(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/**
 * Atajo para el horario de asesoría: días + desde/hasta con el reloj de la app. Escribe la línea
 * en el texto (que sigue siendo libre: se puede agregar "previa cita", la oficina, etc.).
 */
export const AdvisingHoursHelper: React.FC<AdvisingHoursHelperProps> = ({ onAdd }) => {
  const { settings } = useAppSettings();
  const [days, setDays] = useState<string[]>([]);
  const [from, setFrom] = useState('14:00');
  const [to, setTo] = useState('16:00');

  const toggle = (name: string) =>
    setDays((prev) => (prev.includes(name) ? prev.filter((d) => d !== name) : DAYS.map((d) => d.name).filter((d) => d === name || prev.includes(d))));

  const invalid = Boolean(from && to && to <= from);
  const canAdd = days.length > 0 && from && to && !invalid;

  return (
    <div className="space-y-2.5 rounded-2xl border border-dashed border-[var(--color-md-outline-variant)] p-3">
      <p className="text-xs font-semibold text-[var(--color-md-on-surface-variant)]">Agregar un horario con el reloj</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días de asesoría">
        {DAYS.map((day) => {
          const selected = days.includes(day.name);
          return (
            <button
              key={day.name}
              type="button"
              aria-pressed={selected}
              aria-label={day.name}
              onClick={() => toggle(day.name)}
              className={`h-10 w-10 rounded-full text-sm font-bold transition-colors ${
                selected
                  ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                  : 'border border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)]'
              }`}
            >
              {day.short}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TimePickerField value={from} onChange={setFrom} ariaLabel="Desde" dialogTitle="Asesoría desde" />
        <TimePickerField value={to} onChange={setTo} ariaLabel="Hasta" dialogTitle="Asesoría hasta" invalid={invalid} />
      </div>
      <button
        type="button"
        disabled={!canAdd}
        onClick={() => {
          onAdd(`${joinDays(days)} de ${formatClockTime(from, settings.timeFormat)} a ${formatClockTime(to, settings.timeFormat)}`);
          setDays([]);
        }}
        className="flex h-10 items-center gap-2 rounded-full bg-[var(--color-md-secondary-container)] px-4 text-13px font-bold text-[var(--color-md-on-secondary-container)] transition-opacity disabled:opacity-45"
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Agregar al texto
      </button>
    </div>
  );
};
