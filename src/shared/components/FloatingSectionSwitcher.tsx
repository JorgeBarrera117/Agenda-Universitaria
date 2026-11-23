import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBelowFabSlot } from '../hooks/useBelowFabSlot';
import { FLOATING_BUTTON_SHADOW } from './floatingStyles';

export interface FloatingSectionOption<T extends string> {
  value: T;
  label: string;
  icon: React.ReactNode;
  /** Color propio del área (no depende del tema elegido): así se distingue sobre cualquier fondo. */
  color: string;
}

interface FloatingSectionSwitcherProps<T extends string> {
  value: T;
  options: readonly FloatingSectionOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

const ITEM_SIZE = 48;
const ITEM_GAP = 12;

/**
 * Selector de sección (Materias | Profesores, Apuntes | Archivos) como botones flotantes justo
 * debajo del botón de agregar, del mismo lado. En el teléfono siempre; en PC al bajar (arriba ya
 * está el selector de la cabecera). Cada área tiene su propio color
 * sólido (sin contorno); la elegida se extiende con su nombre y la otra muestra solo el ícono.
 */
export const FloatingSectionSwitcher = <T extends string>({ value, options, onChange, ariaLabel }: FloatingSectionSwitcherProps<T>) => {
  const slot = useBelowFabSlot(options.length * ITEM_SIZE + (options.length - 1) * ITEM_GAP);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    buttonsRef.current[next]?.focus();
  };

  return createPortal(
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`fab-autohide transition-opacity duration-200 md:pointer-events-none md:opacity-0 scrolled:md:pointer-events-auto scrolled:md:opacity-100 fixed z-40 flex flex-col gap-3 ${slot.onRight ? 'right-4 items-end' : 'left-4 items-start'}`}
      style={{ top: slot.top }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            style={{ backgroundColor: option.color }}
            className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white ${FLOATING_BUTTON_SHADOW} transition-[padding,filter] duration-200 ease-out hover:brightness-110 active:scale-95 ${
              selected ? 'px-4' : 'w-12'
            }`}
          >
            {option.icon}
            {selected && (
              <span className="whitespace-nowrap" aria-hidden="true">
                {option.label}
              </span>
            )}
          </button>
        );
      })}
    </div>,
    document.body
  );
};
