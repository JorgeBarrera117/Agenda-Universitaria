import React, { useEffect } from 'react';
import { Delete } from 'lucide-react';

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  /** Puntos a mostrar (la longitud del PIN, o 6 al crear uno). */
  length: number;
  /** Al llegar a `length` dígitos (p. ej. desbloquear sin pulsar otro botón). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  /** Error: los puntos se ponen en rojo y tiemblan. */
  hasError?: boolean;
  /** Botón opcional a la izquierda del 0 (p. ej. la huella). */
  extraAction?: React.ReactNode;
  /** Acepta también el teclado físico (computadora). */
  captureKeyboard?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Teclado de PIN al estilo Material 3: puntos de progreso y teclas circulares tonales grandes
 * (fáciles de tocar con el pulgar). En la computadora también se puede escribir con el teclado.
 */
export const PinPad: React.FC<PinPadProps> = ({
  value,
  onChange,
  length,
  onComplete,
  disabled = false,
  hasError = false,
  extraAction,
  captureKeyboard = true,
}) => {
  const press = (digit: string) => {
    if (disabled || value.length >= length) return;
    const next = value + digit;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };
  const erase = () => {
    if (!disabled) onChange(value.slice(0, -1));
  };

  useEffect(() => {
    if (!captureKeyboard) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        erase();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const keyClass =
    'flex h-16 w-16 items-center justify-center rounded-full text-2xl font-medium text-[var(--color-md-on-surface)] bg-[var(--color-md-surface-container-high)] transition-[transform,background-color] duration-100 active:scale-95 active:bg-[var(--color-md-secondary-container)] disabled:opacity-40';

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className={`flex items-center gap-3 ${hasError ? 'animate-[pin-shake_0.35s_ease-in-out]' : ''}`}
        aria-label={`${value.length} de ${length} dígitos`}
        role="status"
      >
        {Array.from({ length }, (_, index) => (
          <span
            key={index}
            className={`h-3.5 w-3.5 rounded-full transition-colors duration-150 ${
              hasError
                ? 'bg-red-600 dark:bg-red-400'
                : index < value.length
                  ? 'bg-[var(--color-md-primary)]'
                  : 'border-2 border-[var(--color-md-outline)]'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4" role="group" aria-label="Teclado numérico">
        {KEYS.map((digit) => (
          <button key={digit} type="button" onClick={() => press(digit)} disabled={disabled} className={keyClass} aria-label={digit}>
            {digit}
          </button>
        ))}
        <span className="flex h-16 w-16 items-center justify-center">{extraAction}</span>
        <button type="button" onClick={() => press('0')} disabled={disabled} className={keyClass} aria-label="0">
          0
        </button>
        <button
          type="button"
          onClick={erase}
          disabled={disabled || value.length === 0}
          aria-label="Borrar"
          className="flex h-16 w-16 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-on-surface)]/[0.06] disabled:opacity-30"
        >
          <Delete className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
