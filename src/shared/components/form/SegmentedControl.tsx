import React, { useRef } from 'react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  /** Texto alternativo corto para pantallas estrechas (p. ej. "Lun" en lugar de "Lunes"). */
  shortLabel?: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}

/**
 * Botón segmentado M3 (radiogroup accesible). Navegable con flechas del teclado; el segmento
 * activo usa el color primario del tema.
 */
export const SegmentedControl = <T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) => {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const nextIndex = (index + step + options.length) % options.length;
    onChange(options[nextIndex].value);
    buttonsRef.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex gap-1 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-1 ${className}`}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={String(option.value)}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.shortLabel ? option.label : undefined}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-all duration-150 ease-out active:scale-[0.98] ${
              isSelected
                ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-xs'
                : 'text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)] hover:text-[var(--color-md-on-surface)]'
            }`}
          >
            {option.icon}
            {option.shortLabel ? (
              <>
                <span className="sm:hidden" aria-hidden="true">{option.shortLabel}</span>
                <span className="hidden truncate sm:inline" aria-hidden="true">{option.label}</span>
              </>
            ) : (
              <span className="truncate">{option.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
