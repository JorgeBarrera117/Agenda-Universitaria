import React, { useRef, useState } from 'react';
import { Clock, Clock3, Keyboard } from 'lucide-react';
import { Modal } from '../Modal';
import { formInputClass } from '../form/formStyles';
import { formatClockTime } from '../../utils/timeFormat';
import { useAppSettings } from '../../../features/settings/hooks/useAppSettings';

interface TimePickerFieldProps {
  /** id del botón: el FormField lo etiqueta con htmlFor. */
  id?: string;
  /** "HH:mm" (24 h) o '' si no hay hora. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Muestra "Borrar" (hora opcional). */
  allowClear?: boolean;
  dialogTitle?: string;
  ariaLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseTime(value: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h <= 23 && m <= 59 ? { h, m } : null;
}

/**
 * Campo de hora con el reloj de Material 3 de la app (no el del sistema): esfera para elegir la
 * hora y luego los minutos, o teclado. Respeta el formato de 12 o 24 horas de Ajustes.
 */
export const TimePickerField: React.FC<TimePickerFieldProps> = ({
  id,
  value,
  onChange,
  placeholder = 'Elegir hora',
  allowClear = false,
  dialogTitle = 'Elige la hora',
  ariaLabel,
  invalid = false,
  disabled = false,
  className = '',
}) => {
  const { settings } = useAppSettings();
  const use12h = settings.timeFormat === '12h';
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-label={ariaLabel ? `${ariaLabel}: ${value ? formatClockTime(value, settings.timeFormat) : 'sin hora'}` : undefined}
        aria-invalid={invalid || undefined}
        className={`${formInputClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
          invalid ? 'border-[#BA1A1A] dark:border-[#FFB4AB]' : ''
        } ${className}`}
      >
        <span className={`truncate ${value ? 'font-mono font-bold' : 'text-[var(--color-md-on-surface-variant)] opacity-80'}`}>
          {value ? formatClockTime(value, settings.timeFormat) : placeholder}
        </span>
        <Clock className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
      </button>
      {isOpen && (
        <TimePickerDialog
          initial={value}
          use12h={use12h}
          allowClear={allowClear}
          title={dialogTitle}
          onCancel={() => setIsOpen(false)}
          onConfirm={(next) => {
            onChange(next);
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
};

interface TimePickerDialogProps {
  initial: string;
  use12h: boolean;
  allowClear: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

const DIAL = 256;
const CENTER = DIAL / 2;
const OUTER_R = 104;
const INNER_R = 68;

/** Ángulo (0 = arriba, sentido horario) y distancia al centro de un punto de la esfera. */
function polar(event: React.PointerEvent<SVGSVGElement>): { angle: number; dist: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  const scale = DIAL / rect.width;
  const dx = (event.clientX - rect.left) * scale - CENTER;
  const dy = (event.clientY - rect.top) * scale - CENTER;
  const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return { angle, dist: Math.hypot(dx, dy) };
}

const at = (index: number, radius: number) => {
  const rad = ((index * 30 - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
};

const TimePickerDialog: React.FC<TimePickerDialogProps> = ({ initial, use12h, allowClear, title, onCancel, onConfirm }) => {
  const start = parseTime(initial) ?? { h: 8, m: 0 };
  const [hour, setHour] = useState(start.h);
  const [minute, setMinute] = useState(start.m);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [keyboard, setKeyboard] = useState(false);
  const dragging = useRef(false);

  const isPm = hour >= 12;
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  const pick = (event: React.PointerEvent<SVGSVGElement>) => {
    const { angle, dist } = polar(event);
    if (mode === 'minute') {
      setMinute(Math.round(angle / 6) % 60);
      return;
    }
    const index = Math.round(angle / 30) % 12;
    if (use12h) {
      const h12 = index === 0 ? 12 : index;
      setHour((h12 % 12) + (isPm ? 12 : 0));
    } else {
      const inner = dist < (OUTER_R + INNER_R) / 2;
      setHour(inner ? 12 + index : index);
    }
  };

  // Posición de la manecilla
  const hand = (() => {
    if (mode === 'minute') {
      const rad = ((minute * 6 - 90) * Math.PI) / 180;
      return { x: CENTER + OUTER_R * Math.cos(rad), y: CENTER + OUTER_R * Math.sin(rad) };
    }
    if (use12h) return at(hour % 12, OUTER_R);
    return at(hour % 12, hour >= 12 ? INNER_R : OUTER_R);
  })();

  type Mark = { key: string; label: string; x: number; y: number; selected: boolean; small?: boolean };
  const marks: Mark[] = [];
  if (mode === 'minute') {
    for (let i = 0; i < 12; i += 1) {
      const { x, y } = at(i, OUTER_R);
      marks.push({ key: `m${i}`, label: pad(i * 5), x, y, selected: minute === i * 5 });
    }
  } else if (use12h) {
    for (let i = 0; i < 12; i += 1) {
      const { x, y } = at(i, OUTER_R);
      marks.push({ key: `h${i}`, label: String(i === 0 ? 12 : i), x, y, selected: hour12 === (i === 0 ? 12 : i) });
    }
  } else {
    for (let i = 0; i < 12; i += 1) {
      const outer = at(i, OUTER_R);
      marks.push({ key: `h${i}`, label: i === 0 ? '00' : String(i), ...outer, selected: hour === i });
      const inner = at(i, INNER_R);
      marks.push({ key: `h${12 + i}`, label: String(12 + i), ...inner, selected: hour === 12 + i, small: true });
    }
  }

  const value = `${pad(hour)}:${pad(minute)}`;
  const displayHour = use12h ? String(hour12) : pad(hour);

  const boxClass = (active: boolean) =>
    `flex h-20 w-24 items-center justify-center rounded-xl text-5xl font-normal transition-colors ${
      active
        ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
        : 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface)]'
    }`;

  return (
    <Modal isOpen onClose={onCancel} title={title} maxWidth="sm" dismissOnBackdrop>
      <div className="space-y-5">
        {/* Hora y minutos: tocar uno lo elige en la esfera */}
        <div className="flex items-center justify-center gap-2">
          {keyboard ? (
            <>
              <input
                type="number"
                inputMode="numeric"
                min={use12h ? 1 : 0}
                max={use12h ? 12 : 23}
                value={displayHour}
                aria-label="Hora"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  if (use12h) {
                    const h12 = Math.min(12, Math.max(1, n));
                    setHour((h12 % 12) + (isPm ? 12 : 0));
                  } else {
                    setHour(Math.min(23, Math.max(0, n)));
                  }
                }}
                className={`${boxClass(true)} text-center outline-none focus:ring-2 focus:ring-[var(--color-md-primary)]`}
              />
              <span className="text-5xl text-[var(--color-md-on-surface)]">:</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={pad(minute)}
                aria-label="Minutos"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isNaN(n)) setMinute(Math.min(59, Math.max(0, n)));
                }}
                className={`${boxClass(false)} text-center outline-none focus:ring-2 focus:ring-[var(--color-md-primary)]`}
              />
            </>
          ) : (
            <>
              <button type="button" onClick={() => setMode('hour')} aria-pressed={mode === 'hour'} aria-label={`Hora: ${displayHour}`} className={boxClass(mode === 'hour')}>
                {displayHour}
              </button>
              <span className="text-5xl text-[var(--color-md-on-surface)]" aria-hidden="true">:</span>
              <button type="button" onClick={() => setMode('minute')} aria-pressed={mode === 'minute'} aria-label={`Minutos: ${pad(minute)}`} className={boxClass(mode === 'minute')}>
                {pad(minute)}
              </button>
            </>
          )}
          {use12h && (
            <div className="ml-1 flex h-20 flex-col overflow-hidden rounded-xl border border-[var(--color-md-outline)]" role="group" aria-label="Mañana o tarde">
              {(['a. m.', 'p. m.'] as const).map((label, index) => {
                const active = index === 1 ? isPm : !isPm;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setHour((hour % 12) + (index === 1 ? 12 : 0))}
                    className={`flex flex-1 items-center justify-center px-3 text-sm font-bold ${index === 1 ? 'border-t border-[var(--color-md-outline)]' : ''} ${
                      active ? 'bg-[var(--color-md-tertiary-container,var(--color-md-secondary-container))] text-[var(--color-md-on-surface)]' : 'text-[var(--color-md-on-surface-variant)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Esfera: tocar o arrastrar elige; al soltar la hora, pasa a los minutos */}
        {!keyboard && (
          <svg
            viewBox={`0 0 ${DIAL} ${DIAL}`}
            className="mx-auto block w-full max-w-[256px] touch-none select-none"
            role="img"
            aria-label={mode === 'hour' ? `Esfera de horas, ${displayHour}` : `Esfera de minutos, ${pad(minute)}`}
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              pick(e);
            }}
            onPointerMove={(e) => {
              if (dragging.current) pick(e);
            }}
            onPointerUp={() => {
              dragging.current = false;
              if (mode === 'hour') setMode('minute');
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
          >
            <circle cx={CENTER} cy={CENTER} r={CENTER} className="fill-[var(--color-md-surface-container-high)]" />
            <line x1={CENTER} y1={CENTER} x2={hand.x} y2={hand.y} strokeWidth={2} className="stroke-[var(--color-md-primary)]" />
            <circle cx={CENTER} cy={CENTER} r={4} className="fill-[var(--color-md-primary)]" />
            <circle cx={hand.x} cy={hand.y} r={22} className="fill-[var(--color-md-primary)]" />
            {marks.map((mark) => (
              <text
                key={mark.key}
                x={mark.x}
                y={mark.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={mark.small ? 13 : 16}
                className={mark.selected ? 'fill-[var(--color-md-on-primary)] font-bold' : 'fill-[var(--color-md-on-surface)]'}
              >
                {mark.label}
              </text>
            ))}
          </svg>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setKeyboard((k) => !k)}
            aria-label={keyboard ? 'Usar la esfera del reloj' : 'Escribir la hora con el teclado'}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/5"
          >
            {keyboard ? <Clock3 className="h-5 w-5" aria-hidden="true" /> : <Keyboard className="h-5 w-5" aria-hidden="true" />}
          </button>
          {allowClear && initial && (
            <button
              type="button"
              onClick={() => onConfirm('')}
              className="h-10 rounded-full px-3 text-sm font-bold text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/10"
            >
              Borrar
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-full px-4 text-sm font-bold text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(value)}
            className="h-10 rounded-full bg-[var(--color-md-primary)] px-5 text-sm font-bold text-[var(--color-md-on-primary)]"
          >
            Aceptar
          </button>
        </div>
      </div>
    </Modal>
  );
};
