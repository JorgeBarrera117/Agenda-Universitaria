import React, { useMemo, useState } from 'react';
import { Check, ImageIcon } from 'lucide-react';
import type { WallpaperStyle } from '../types';
import {
  WALLPAPER_CATEGORIES,
  WALLPAPER_PATTERNS,
  getPatternMask,
  isPatternWallpaper,
  patternMaskSize,
  type PatternWallpaperId,
  type WallpaperCategory,
} from '../../../shared/wallpapers/wallpaperPatterns';

type CategoryId = WallpaperCategory | 'personal';

interface WallpaperPickerProps {
  value: WallpaperStyle;
  onChange: (style: WallpaperStyle) => void;
  /** Miniatura de la foto propia, si hay una guardada. */
  customPreview: string | null;
  /** Abre el selector de archivos para subir una foto. */
  onRequestUpload: () => void;
}

function categoryOf(style: WallpaperStyle): CategoryId {
  return isPatternWallpaper(style) ? WALLPAPER_PATTERNS[style].category : 'personal';
}

const PATTERN_IDS = Object.keys(WALLPAPER_PATTERNS) as PatternWallpaperId[];

/**
 * Galería de papeles tapiz agrupada por categorías (chips de filtro M3).
 * - Se abre en la categoría del fondo actual.
 * - Cada miniatura muestra el patrón real con el color del tema.
 * - El nombre del fondo elegido se ve siempre, aunque esté en otra categoría.
 */
export const WallpaperPicker: React.FC<WallpaperPickerProps> = ({ value, onChange, customPreview, onRequestUpload }) => {
  const [category, setCategory] = useState<CategoryId>(() => categoryOf(value));

  const items = useMemo(
    () => (category === 'personal' ? [] : PATTERN_IDS.filter((id) => WALLPAPER_PATTERNS[id].category === category)),
    [category]
  );

  const currentLabel = isPatternWallpaper(value)
    ? WALLPAPER_PATTERNS[value].label
    : value === 'custom'
      ? 'Mi foto'
      : 'Fondo liso';

  return (
    <div className="space-y-3">
      {/* Categorías: chips de filtro con desplazamiento horizontal en pantallas estrechas */}
      {/* Degradado en el borde derecho: indica que hay más categorías al deslizar */}
      <div
        role="tablist"
        aria-label="Categorías de papel tapiz"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pr-8 [mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] [scrollbar-width:none]"
      >
        {WALLPAPER_CATEGORIES.map((cat) => {
          const selected = category === cat.id;
          const containsCurrent = categoryOf(value) === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setCategory(cat.id)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.98] ${
                selected
                  ? 'border-transparent bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]'
                  : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/[0.06]'
              }`}
            >
              {selected && <Check className="h-4 w-4" aria-hidden="true" />}
              {cat.label}
              {/* Punto: aquí está el fondo que tienes puesto */}
              {containsCurrent && !selected && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-md-primary)]" aria-label="(fondo actual)" />
              )}
            </button>
          );
        })}
      </div>

      <div role="radiogroup" aria-label="Papel tapiz" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((id) => (
          <WallpaperTile key={id} label={WALLPAPER_PATTERNS[id].label} selected={value === id} onSelect={() => onChange(id)}>
            <PatternThumb id={id} />
          </WallpaperTile>
        ))}

        {category === 'personal' && (
          <>
            <WallpaperTile
              label={customPreview ? 'Mi foto' : 'Subir foto'}
              selected={value === 'custom'}
              onSelect={() => (customPreview ? onChange('custom') : onRequestUpload())}
            >
              {customPreview ? (
                <img src={customPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-[var(--color-md-primary)]">
                  <ImageIcon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-11px font-bold">Subir</span>
                </span>
              )}
            </WallpaperTile>
            <WallpaperTile label="Fondo liso" selected={value === 'none'} onSelect={() => onChange('none')}>
              <span className="text-11px font-bold text-[var(--color-md-on-surface-variant)]">Sin dibujo</span>
            </WallpaperTile>
          </>
        )}
      </div>

      <p className="text-xs text-[var(--color-md-on-surface-variant)]" aria-live="polite">
        Fondo actual: <strong className="text-[var(--color-md-on-surface)]">{currentLabel}</strong>
      </p>
    </div>
  );
};

const WallpaperTile: React.FC<{ label: string; selected: boolean; onSelect: () => void; children: React.ReactNode }> = ({
  label,
  selected,
  onSelect,
  children,
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    className={`group flex flex-col gap-1.5 rounded-2xl border-2 p-1.5 text-center transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.98] ${
      selected
        ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)]/40'
        : 'border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] hover:border-[var(--color-md-outline)]'
    }`}
  >
    <span className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-xl border border-[var(--color-md-outline-variant)]/60 bg-[var(--color-md-surface)]">
      {children}
      {selected && (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-2xs">
          <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
        </span>
      )}
    </span>
    <span className="block truncate px-0.5 text-xs font-semibold text-[var(--color-md-on-surface)]">{label}</span>
  </button>
);

/** Miniatura del patrón, más pequeño que a tamaño real para que se aprecie su repetición. */
const PatternThumb: React.FC<{ id: PatternWallpaperId }> = ({ id }) => {
  const mask = useMemo(() => getPatternMask(id), [id]);
  const size = patternMaskSize(mask, 0.42);
  return (
    <span
      aria-hidden="true"
      className="h-full w-full"
      style={{
        backgroundColor: 'var(--color-md-primary)',
        WebkitMaskImage: mask.dataUri,
        maskImage: mask.dataUri,
        WebkitMaskRepeat: 'repeat',
        maskRepeat: 'repeat',
        WebkitMaskSize: size,
        maskSize: size,
        opacity: 0.6,
      }}
    />
  );
};
