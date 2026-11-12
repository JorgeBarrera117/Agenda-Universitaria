import React, { useEffect, useRef, useState } from 'react';
import { Check, Pipette, Wand2 } from 'lucide-react';
import type { GeneratedTokens } from '../../../shared/utils/paletteGenerator';
import type { ThemeTokenSet } from '../../../shared/utils/theme';
import type { CustomPaletteSettings } from '../types';

interface CustomPaletteCreatorProps {
  /** Color con el que empieza (el de tu paleta guardada o el de la paleta activa). */
  initialSeed: string;
  /** ¿La paleta propia es la que está en uso? */
  isActive: boolean;
  onApply: (palette: CustomPaletteSettings) => void;
}

/** Colores de partida para elegir con un toque (el resto con el selector o escribiendo el código). */
const QUICK_COLORS = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#3949AB', '#8E24AA', '#D81B60', '#6D4C41'];

const HEX_INPUT = /^#?([0-9a-f]{6})$/i;

/** Mini maqueta de la app con los colores generados (claro u oscuro). */
const PalettePreview: React.FC<{ label: string; tokens: ThemeTokenSet }> = ({ label, tokens }) => (
  <div className="min-w-0 flex-1 space-y-1">
    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">{label}</p>
    <div className="rounded-xl p-2" style={{ backgroundColor: tokens.surface, border: `1px solid ${tokens.outlineVariant}` }} aria-hidden="true">
      <div className="space-y-1.5 rounded-lg p-2" style={{ backgroundColor: tokens.cardBg, border: `1px solid ${tokens.outlineVariant}` }}>
        <p className="truncate text-[11px] font-bold" style={{ color: tokens.onSurface }}>
          Cálculo Diferencial
        </p>
        <p className="truncate text-[10px]" style={{ color: tokens.onSurfaceVariant }}>
          Lun 08:00 – 10:00
        </p>
        <div className="flex items-center gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ backgroundColor: tokens.primaryContainer, color: tokens.onPrimaryContainer }}
          >
            MAT-101
          </span>
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ backgroundColor: tokens.primary, color: tokens.onPrimary }}
          >
            Botón
          </span>
        </div>
      </div>
    </div>
  </div>
);

/**
 * "Crea tu paleta": eliges un color y se calculan los colores de la app para claro y oscuro con el
 * algoritmo de Material You. La librería de color se descarga solo aquí, al abrir esta sección.
 */
export const CustomPaletteCreator: React.FC<CustomPaletteCreatorProps> = ({ initialSeed, isActive, onApply }) => {
  const [seed, setSeed] = useState(initialSeed.toUpperCase());
  const [hexInput, setHexInput] = useState(initialSeed.toUpperCase());
  const [preview, setPreview] = useState<GeneratedTokens | null>(null);
  const [appliedSeed, setAppliedSeed] = useState<string | null>(isActive ? initialSeed.toUpperCase() : null);
  // Solo vale el resultado del último color pedido (si se cambian rápido, los anteriores se ignoran)
  const requestRef = useRef(0);

  const generate = (color: string) => {
    const request = ++requestRef.current;
    void import('../../../shared/utils/paletteGenerator').then(({ generateThemeTokens }) => {
      if (request === requestRef.current) setPreview(generateThemeTokens(color));
    });
  };

  // Vista previa inicial (carga diferida de la librería al abrir la sección)
  useEffect(() => {
    const request = ++requestRef.current;
    void import('../../../shared/utils/paletteGenerator').then(({ generateThemeTokens }) => {
      if (request === requestRef.current) setPreview(generateThemeTokens(initialSeed));
    });
  }, [initialSeed]);

  const pick = (color: string) => {
    const normalized = color.toUpperCase();
    setSeed(normalized);
    setHexInput(normalized);
    generate(normalized);
  };

  const handleHexInput = (value: string) => {
    setHexInput(value);
    const match = HEX_INPUT.exec(value.trim());
    if (match) {
      const normalized = `#${match[1].toUpperCase()}`;
      setSeed(normalized);
      generate(normalized);
    }
  };

  const hexInvalid = hexInput.trim() !== '' && !HEX_INPUT.test(hexInput.trim());
  const isApplied = appliedSeed === seed;

  return (
    <div className="space-y-3">
      {/* Colores rápidos */}
      <div role="group" aria-label="Colores para empezar" className="flex flex-wrap gap-2">
        {QUICK_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => pick(color)}
            aria-label={`Usar el color ${color}`}
            aria-pressed={seed === color}
            className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-[var(--color-md-outline-variant)] transition-transform duration-150 active:scale-90"
            style={{ backgroundColor: color }}
          >
            {seed === color && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {/* Selector de color libre + código */}
      <div className="flex items-center gap-2">
        <label className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl ring-1 ring-[var(--color-md-outline-variant)]" style={{ backgroundColor: seed }}>
          <Pipette className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />
          <span className="sr-only">Elegir cualquier color</span>
          <input type="color" value={seed} onChange={(e) => pick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <div className="min-w-0 flex-1">
          <label htmlFor="custom-palette-hex" className="sr-only">
            Código del color
          </label>
          <input
            id="custom-palette-hex"
            type="text"
            inputMode="text"
            maxLength={7}
            value={hexInput}
            onChange={(e) => handleHexInput(e.target.value)}
            placeholder="#00639B"
            className="h-11 w-full rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] px-3 font-mono text-sm text-[var(--color-md-on-surface)] outline-none focus:border-[var(--color-md-primary)]"
            aria-invalid={hexInvalid}
          />
        </div>
      </div>
      {hexInvalid && <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">Escribe el color como #RRGGBB, por ejemplo #3AA0E0.</p>}

      {/* Vista previa en claro y oscuro */}
      {preview && (
        <div className="flex gap-2">
          <PalettePreview label="Claro" tokens={preview.light} />
          <PalettePreview label="Oscuro" tokens={preview.dark} />
        </div>
      )}

      <button
        type="button"
        disabled={!preview || isApplied}
        onClick={() => {
          if (!preview) return;
          onApply({ seed, light: preview.light, dark: preview.dark });
          setAppliedSeed(seed);
        }}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-md-primary)] px-4 text-sm font-bold text-[var(--color-md-on-primary)] shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
      >
        {isApplied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
        {isApplied ? 'Tu paleta está en uso' : 'Usar esta paleta'}
      </button>
    </div>
  );
};
