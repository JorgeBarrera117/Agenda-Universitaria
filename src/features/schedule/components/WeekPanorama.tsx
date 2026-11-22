import React, { useMemo } from 'react';
import type { Subject } from '../../subjects/types';
import { DAY_NAMES, SHORT_DAY_NAMES, type DayOfWeek, type ScheduleSlot } from '../types';
import { useTimeFormatter } from '../../settings/hooks/useTimeFormatter';

interface WeekPanoramaProps {
  days: DayOfWeek[];
  slots: ScheduleSlot[];
  getSubjectById: (id: string) => Subject | undefined;
  todayDay: DayOfWeek;
  /** Hora actual "HH:mm" para la línea de «ahora». */
  nowTimeString: string;
  /** Tocar el encabezado de un día lo abre en la vista Día. */
  onOpenDay: (day: DayOfWeek) => void;
  /** Tocar un bloque abre la ficha de su materia (o el día, si no hay ficha). */
  onOpenSlot: (slot: ScheduleSlot) => void;
}

/** Alto de una hora en la parrilla: entra una mañana entera sin desplazarse mucho. */
const PX_PER_HOUR = 44;
const DEFAULT_RANGE = { from: 7, to: 13 };

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Vista Semana del teléfono: parrilla compacta con una columna por día y un bloque por clase,
 * colocado y dimensionado según su hora (como un calendario). Se ve toda la carga de la semana
 * de un vistazo; el detalle de cada clase queda en la vista Día. El bloque usa el color de la
 * materia como tinte sobre la superficie (no como relleno sólido) para leerse en claro y oscuro.
 */
export const WeekPanorama: React.FC<WeekPanoramaProps> = ({
  days,
  slots,
  getSubjectById,
  todayDay,
  nowTimeString,
  onOpenDay,
  onOpenSlot,
}) => {
  const formatter = useTimeFormatter();

  // Rango de horas: de la primera clase a la última de la semana (horas completas)
  const range = useMemo(() => {
    const visible = slots.filter((s) => days.includes(s.dayOfWeek));
    if (visible.length === 0) return DEFAULT_RANGE;
    const from = Math.floor(Math.min(...visible.map((s) => toMinutes(s.startTime))) / 60);
    const to = Math.ceil(Math.max(...visible.map((s) => toMinutes(s.endTime))) / 60);
    return { from, to: Math.max(to, from + 1) };
  }, [slots, days]);

  const hours = Array.from({ length: range.to - range.from }, (_unused, i) => range.from + i);
  const gridHeight = (range.to - range.from) * PX_PER_HOUR;
  const nowMinutes = toMinutes(nowTimeString);
  const nowTop = ((nowMinutes - range.from * 60) / 60) * PX_PER_HOUR;
  const showNow = nowMinutes >= range.from * 60 && nowMinutes <= range.to * 60;

  return (
    <section
      aria-label="Vista semanal"
      className="md-card rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-2 shadow-2xs"
    >
      {/* Encabezados de los días */}
      <div className="flex gap-1 pl-7">
        {days.map((day) => {
          const isToday = day === todayDay;
          const count = slots.filter((s) => s.dayOfWeek === day).length;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onOpenDay(day)}
              aria-label={`Ver el ${DAY_NAMES[day]} (${count} ${count === 1 ? 'clase' : 'clases'})${isToday ? ', hoy' : ''}`}
              className={`flex min-h-10 min-w-0 flex-1 flex-col items-center justify-center rounded-lg py-1 transition-[background-color,transform] duration-150 ease-out active:scale-95 ${
                isToday
                  ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                  : 'text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-on-surface)]/[0.06]'
              }`}
            >
              <span className="text-11px font-black uppercase leading-tight tracking-wide">{SHORT_DAY_NAMES[day]}</span>
              <span className={`text-9px leading-tight ${isToday ? 'opacity-90' : 'text-[var(--color-md-on-surface-variant)]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Parrilla: columna de horas + una columna por día */}
      <div className="relative mt-1 flex gap-1" style={{ height: gridHeight }}>
        <div className="relative w-6 shrink-0" aria-hidden="true">
          {hours.map((h, i) => (
            <span
              key={h}
              className="absolute right-0 -translate-y-1/2 text-9px font-semibold tabular-nums text-[var(--color-md-on-surface-variant)]"
              style={{ top: i * PX_PER_HOUR }}
            >
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>

        {/* Líneas de cada hora (detrás de las columnas) */}
        <div className="pointer-events-none absolute inset-y-0 left-7 right-0" aria-hidden="true">
          {hours.map((h, i) => (
            <span
              key={h}
              className="absolute inset-x-0 border-t border-dashed border-[var(--color-md-outline-variant)]/70"
              style={{ top: i * PX_PER_HOUR }}
            />
          ))}
        </div>

        {days.map((day) => {
          const isToday = day === todayDay;
          const daySlots = slots.filter((s) => s.dayOfWeek === day);
          return (
            <div
              key={day}
              className={`relative min-w-0 flex-1 rounded-md ${isToday ? 'bg-[var(--color-md-primary)]/[0.06]' : ''}`}
            >
              {daySlots.map((slot) => {
                const subject = getSubjectById(slot.subjectId);
                const color = subject?.color || '#006BBB';
                const start = toMinutes(slot.startTime);
                const end = toMinutes(slot.endTime);
                const top = ((start - range.from * 60) / 60) * PX_PER_HOUR;
                const height = Math.max(((end - start) / 60) * PX_PER_HOUR - 2, 22);
                const isNow = isToday && nowTimeString >= slot.startTime && nowTimeString < slot.endTime;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => onOpenSlot(slot)}
                    aria-label={`${subject?.name || 'Clase'}, ${DAY_NAMES[day]} ${formatter.range(slot.startTime, slot.endTime)}`}
                    style={{
                      top: top + 1,
                      height,
                      borderLeftColor: color,
                      backgroundColor: `color-mix(in srgb, ${color} 22%, var(--color-md-card-bg))`,
                    }}
                    className={`absolute inset-x-0 overflow-hidden rounded-md border-l-[3px] px-1 py-0.5 text-left text-[var(--color-md-on-surface)] transition-transform duration-150 ease-out active:scale-[0.97] ${
                      isNow ? 'ring-2 ring-[var(--color-md-primary)]' : ''
                    }`}
                  >
                    <span className="block text-9px font-bold tabular-nums leading-tight opacity-80">
                      {formatter.time(slot.startTime)}
                    </span>
                    {/* Guiones de división en español (Android); sin diccionario, corta donde haga falta */}
                    <span lang="es" className="block text-10px font-bold leading-tight hyphens-auto [overflow-wrap:anywhere]">
                      {subject?.name || 'Clase'}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Línea de «ahora» */}
        {showNow && days.includes(todayDay) && (
          <span
            className="pointer-events-none absolute left-7 right-0 h-0.5 rounded-full bg-[var(--color-md-primary)]"
            style={{ top: nowTop }}
            aria-hidden="true"
          />
        )}
      </div>
    </section>
  );
};
