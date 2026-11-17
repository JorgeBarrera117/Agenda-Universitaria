import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import type { CardSurfaceStyle, WallpaperStyle } from '../types';
import { getPatternMask, isPatternWallpaper, patternMaskSize } from '../../../shared/wallpapers/wallpaperPatterns';

interface CardSurfacePickerProps {
  value: CardSurfaceStyle;
  onChange: (style: CardSurfaceStyle) => void;
  wallpaperStyle: WallpaperStyle;
}

const OPTIONS: { value: CardSurfaceStyle; label: string; description: string }[] = [
  { value: 'solid', label: 'Elevada', description: 'Sin borde; una sombra suave la separa del fondo.' },
  { value: 'glass', label: 'Cristal', description: 'Translúcida: se ve tu papel tapiz a través, desenfocado.' },
  { value: 'bordered', label: 'Con borde', description: 'Plana, del color del fondo y con un contorno marcado.' },
];

/** Estilo de la mini tarjeta de cada opción: la misma receta que index.css aplica a las tarjetas reales. */
function sampleCardStyle(style: CardSurfaceStyle): React.CSSProperties {
  switch (style) {
    case 'glass':
      return {
        backgroundColor: 'color-mix(in srgb, var(--color-md-card-bg) 55%, transparent)',
        border: '1px solid color-mix(in srgb, #fff 55%, transparent)',
        boxShadow: '0 4px 16px rgb(0 0 0 / 0.08)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      };
    case 'bordered':
      return { backgroundColor: 'var(--color-md-surface)', border: '1.5px solid var(--color-md-outline)' };
    default:
      return { backgroundColor: 'var(--color-md-card-bg)', border: '1px solid transparent', boxShadow: 'var(--md-elevation-1)' };
  }
}

/**
 * Acabado de tarjetas con vista previa: cada opción muestra una tarjeta de muestra sobre el papel
 * tapiz elegido, para ver la diferencia antes de elegir (los tres tipos de tarjeta de Material 3).
 */
export const CardSurfacePicker: React.FC<CardSurfacePickerProps> = ({ value, onChange, wallpaperStyle }) => {
  const mask = useMemo(() => getPatternMask(isPatternWallpaper(wallpaperStyle) ? wallpaperStyle : 'campus'), [wallpaperStyle]);
  const maskSize = patternMaskSize(mask, 0.5);
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Acabado de tarjetas" className="grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`flex flex-col gap-1.5 rounded-2xl border-2 p-1.5 text-center transition-colors ${
                selected
                  ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)]/40'
                  : 'border-[var(--color-md-outline-variant)] hover:border-[var(--color-md-outline)]'
              }`}
            >
              {/* Fondo de muestra: el papel tapiz con algo más de intensidad para que se aprecie */}
              <span className="relative flex h-20 items-center justify-center overflow-hidden rounded-xl bg-[var(--color-md-surface)]" aria-hidden="true">
                <span
                  className="absolute inset-0"
                  style={{
                    backgroundColor: 'var(--color-md-primary)',
                    WebkitMaskImage: mask.dataUri,
                    maskImage: mask.dataUri,
                    WebkitMaskSize: maskSize,
                    maskSize,
                    opacity: 0.45,
                  }}
                />
                <span className="relative w-[78%] space-y-1 rounded-lg p-1.5 text-left" style={sampleCardStyle(option.value)}>
                  <span className="block h-1.5 w-3/4 rounded-full bg-[var(--color-md-on-surface)]/70" />
                  <span className="block h-1.5 w-1/2 rounded-full bg-[var(--color-md-on-surface-variant)]/50" />
                  <span className="block h-2.5 w-6 rounded-full bg-[var(--color-md-primary)]" />
                </span>
                {selected && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-[var(--color-md-on-surface)]">{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--color-md-on-surface-variant)]" aria-live="polite">
        {current.description}
      </p>
    </div>
  );
};
