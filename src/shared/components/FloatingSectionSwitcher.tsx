import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FAB_BUTTON_SIZE,
  FAB_DOCK_EVENT,
  fabDockedPosition,
  readFabDock,
  setFabBottomReserve,
  type DockPosition,
} from './fabLayout';

export interface FloatingSectionOption<T extends string> {
  value: T;
  label: string;
  icon: React.ReactNode;
}

interface FloatingSectionSwitcherProps<T extends string> {
  value: T;
  options: readonly FloatingSectionOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

const ITEM_SIZE = 48;
const ITEM_GAP = 8;
const GAP_BELOW_FAB = 12;
const PHONE_QUERY = '(max-width: 767px)';

/**
 * Selector de sección del teléfono (Materias | Profesores, Apuntes | Archivos) como botones
 * flotantes justo debajo del botón de agregar, del mismo lado. El elegido se extiende con su
 * nombre; el otro muestra solo el ícono. Reserva su espacio para que el botón de agregar no baje
 * encima (fabLayout) y lo sigue si el estudiante lo arrastra.
 */
export const FloatingSectionSwitcher = <T extends string>({ value, options, onChange, ariaLabel }: FloatingSectionSwitcherProps<T>) => {
  const reserve = options.length * ITEM_SIZE + (options.length - 1) * ITEM_GAP + GAP_BELOW_FAB;
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches);
  const [dock, setDock] = useState<DockPosition>(readFabDock);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const onMedia = () => setIsPhone(media.matches);
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const onDock = (event: Event) => {
      const detail = (event as CustomEvent<DockPosition>).detail;
      setDock(detail ?? readFabDock());
    };
    media.addEventListener('change', onMedia);
    window.addEventListener('resize', onResize);
    window.addEventListener(FAB_DOCK_EVENT, onDock);
    return () => {
      media.removeEventListener('change', onMedia);
      window.removeEventListener('resize', onResize);
      window.removeEventListener(FAB_DOCK_EVENT, onDock);
    };
  }, []);

  // El botón de agregar deja este espacio libre debajo mientras el selector se muestra
  useEffect(() => {
    if (!isPhone) return;
    setFabBottomReserve(reserve);
    return () => setFabBottomReserve(0);
  }, [isPhone, reserve]);

  if (!isPhone) return null;

  const fab = fabDockedPosition(dock, viewport.width, viewport.height, reserve);
  const top = fab.y + FAB_BUTTON_SIZE + GAP_BELOW_FAB;
  const onRight = dock.side === 'right';

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
      className={`fixed z-40 flex flex-col gap-2 ${onRight ? 'right-4 items-end' : 'left-4 items-start'}`}
      style={{ top }}
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
            className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold shadow-[0_6px_16px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.22)] ring-2 ring-white/80 transition-[background-color,color,padding] duration-200 ease-out active:scale-95 dark:ring-black/50 ${
              selected
                ? 'bg-[var(--color-md-primary)] px-4 text-[var(--color-md-on-primary)]'
                : 'w-12 border border-[var(--color-md-outline)] bg-[var(--color-md-surface)] text-[var(--color-md-primary)]'
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
