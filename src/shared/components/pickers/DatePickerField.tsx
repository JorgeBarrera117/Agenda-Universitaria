import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '../Modal';
import { formInputClass } from '../form/formStyles';
import {
  MONTHS_LONG,
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  WEEKDAY_INITIALS,
  fromDateKey,
  mediumDateLabel,
  monthGrid,
  toDateKey,
} from '../../utils/calendarDates';

interface DatePickerFieldProps {
  /** id del botón: el FormField lo etiqueta con htmlFor. */
  id: string;
  /** "YYYY-MM-DD" o '' si no hay fecha. */
  value: string;
  onChange: (value: string) => void;
  /** Primer día que se puede elegir ("YYYY-MM-DD"). */
  min?: string;
  placeholder?: string;
  /** Muestra "Borrar" (campos opcionales). */
  allowClear?: boolean;
  dialogTitle?: string;
  className?: string;
}

/**
 * Campo de fecha con el selector de Material 3 de la app (no el del sistema): se ve igual en
 * Android, Windows y el navegador, con los colores del tema. Toca el campo y elige en el calendario.
 */
export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  id,
  value,
  onChange,
  min,
  placeholder = 'Elegir fecha',
  allowClear = false,
  dialogTitle = 'Elige la fecha',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        className={`${formInputClass} flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${value ? '' : 'text-[var(--color-md-on-surface-variant)] opacity-80'}`}>
          {value ? mediumDateLabel(value) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
      </button>
      {isOpen && (
        <DatePickerDialog
          initial={value}
          min={min}
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

interface DatePickerDialogProps {
  initial: string;
  min?: string;
  allowClear: boolean;
  title: string;
  /** Texto del botón principal (por defecto «Aceptar»). */
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

/** El diálogo de calendario solo (sin el campo), para quien abre el selector desde otro control. */
export const DatePickerDialog: React.FC<DatePickerDialogProps> = ({ initial, min, allowClear, title, confirmLabel = 'Aceptar', onCancel, onConfirm }) => {
  const [todayKey] = useState(() => toDateKey(new Date()));
  const [draft, setDraft] = useState(initial || (min && min > todayKey ? min : todayKey));
  const [visible, setVisible] = useState(() => {
    const date = fromDateKey(draft);
    return { year: date.getFullYear(), month: date.getMonth() };
  });

  const cells = useMemo(() => monthGrid(visible.year, visible.month), [visible]);
  const changeMonth = (delta: number) =>
    setVisible(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const draftDate = fromDateKey(draft);
  const headline = `${WEEKDAYS_SHORT[draftDate.getDay()]}, ${draftDate.getDate()} ${MONTHS_SHORT[draftDate.getMonth()]}`;

  return (
    <Modal isOpen onClose={onCancel} title={title} maxWidth="sm" dismissOnBackdrop>
      <div className="space-y-3">
        <p className="border-b border-[var(--color-md-outline-variant)] pb-3 text-3xl font-normal text-[var(--color-md-on-surface)]">{headline}</p>

        <div className="flex items-center gap-1">
          <span className="flex-1 pl-1 text-sm font-bold text-[var(--color-md-on-surface)]">
            {MONTHS_LONG[visible.month]} {visible.year}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            aria-label="Mes anterior"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/5"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            aria-label="Mes siguiente"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/5"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-7" aria-hidden="true">
          {WEEKDAY_INITIALS.map((label, index) => (
            <span key={`${label}${index}`} className="py-1 text-center text-xs font-bold text-[var(--color-md-on-surface-variant)]">
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1" role="group" aria-label={`${MONTHS_LONG[visible.month]} ${visible.year}`}>
          {cells.map((cell) => {
            const selected = cell.key === draft;
            const isToday = cell.key === todayKey;
            const disabled = Boolean(min && cell.key < min);
            const date = fromDateKey(cell.key);
            return (
              <button
                key={cell.key}
                type="button"
                disabled={disabled}
                onClick={() => setDraft(cell.key)}
                aria-pressed={selected}
                aria-label={`${WEEKDAYS_SHORT[date.getDay()]} ${cell.day} de ${MONTHS_LONG[date.getMonth()].toLowerCase()}`}
                className="flex h-11 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${
                    selected
                      ? 'bg-[var(--color-md-primary)] font-bold text-[var(--color-md-on-primary)]'
                      : isToday
                        ? 'font-bold text-[var(--color-md-primary)] ring-[1.5px] ring-inset ring-[var(--color-md-primary)]'
                        : cell.inMonth
                          ? 'text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-on-surface)]/5'
                          : 'text-[var(--color-md-on-surface-variant)] opacity-45'
                  }`}
                >
                  {cell.day}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
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
            onClick={() => onConfirm(draft)}
            className="h-10 rounded-full bg-[var(--color-md-primary)] px-5 text-sm font-bold text-[var(--color-md-on-primary)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
