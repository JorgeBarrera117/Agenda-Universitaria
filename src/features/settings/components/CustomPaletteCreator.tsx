import React, { useEffect, useRef, useState } from 'react';
import { Check, Pipette, Wand2 } from 'lucide-react';
import { M3ColorPickerModal } from '../../../shared/components/form';
import type { GeneratedTokens } from '../../../shared/utils/paletteGenerator';
import type { ThemeTokenSet } from '../../../shared/utils/theme';
import type { BackgroundSource, BackgroundTint, CustomPaletteSettings, PaletteRecipe, PaletteStyle } from '../types';

interface CustomPaletteCreatorProps {
  /** Receta con la que empieza (la de tu paleta guardada o una nueva desde la paleta activa). */
  initialRecipe: PaletteRecipe;
  /** ¿La paleta propia es la que está en uso? */
  isActive: boolean;
  onApply: (palette: CustomPaletteSettings) => void;
}

type Slot = 'primary' | 'accent' | 'background';

/** Colores de partida para elegir con un toque (el resto con el selector o escribiendo el código). */
const QUICK_COLORS = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#3949AB', '#8E24AA', '#D81B60', '#6D4C41'];

const HEX_INPUT = /^#?([0-9a-f]{6})$/i;

const STYLE_OPTIONS: { value: PaletteStyle; label: string; description: string }[] = [
  { value: 'balanced', label: 'Equilibrado', description: 'Colores suaves y armónicos.' },
  { value: 'vibrant', label: 'Vibrante', description: 'Todo más intenso y saturado.' },
  { value: 'expressive', label: 'Expresivo', description: 'El acento contrasta con el principal.' },
  { value: 'fidelity', label: 'Fiel', description: 'Respeta tu color lo más posible.' },
  { value: 'monochrome', label: 'Monocromo', description: 'Grises; tu color vive solo en el acento.' },
];

const TINT_OPTIONS: { value: BackgroundTint; label: string }[] = [
  { value: 'neutral', label: 'Neutro' },
  { value: 'soft', label: 'Suave' },
  { value: 'strong', label: 'Marcado' },
];

const SOURCE_OPTIONS: { value: BackgroundSource; label: string }[] = [
  { value: 'primary', label: 'Del principal' },
  { value: 'accent', label: 'Del acento' },
  { value: 'custom', label: 'Otro color' },
];

const chipClass = (selected: boolean) =>
  `inline-flex min-h-[36px] items-center justify-center rounded-full border px-3 text-xs font-bold transition-all duration-150 active:scale-95 ${
    selected
      ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
      : 'border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-outline)]'
  }`;

/** Muestras rápidas + selector libre + código hexadecimal para un color. */
const ColorField: React.FC<{ value: string; onPick: (color: string) => void; label: string }> = ({ value, onPick, label }) => {
  const [hexInput, setHexInput] = useState(value);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hexInvalid = hexInput.trim() !== '' && !HEX_INPUT.test(hexInput.trim());

  const pick = (color: string) => {
    const normalized = color.toUpperCase();
    setHexInput(normalized);
    onPick(normalized);
  };

  return (
    <div className="space-y-2">
      <div role="group" aria-label={`Colores rápidos para ${label}`} className="flex flex-wrap gap-2">
        {QUICK_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => pick(color)}
            aria-label={`Usar el color ${color}`}
            aria-pressed={value === color}
            className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-[var(--color-md-outline-variant)] transition-transform duration-150 active:scale-90"
            style={{ backgroundColor: color }}
          >
            {value === color && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {/* Selector propio de la app (el <input type="color"> abre en Android un diálogo del sistema) */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={`Elegir cualquier color para ${label}`}
          aria-haspopup="dialog"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-[var(--color-md-outline-variant)] transition-transform duration-150 active:scale-95"
          style={{ backgroundColor: value }}
        >
          <Pipette className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />
        </button>
        <M3ColorPickerModal
          isOpen={pickerOpen}
          initialColor={value}
          onClose={() => setPickerOpen(false)}
          onApply={pick}
          title={`Elige ${label}`}
          showIconContrastHint={false}
        />
        <input
          type="text"
          maxLength={7}
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value);
            const match = HEX_INPUT.exec(e.target.value.trim());
            if (match) onPick(`#${match[1].toUpperCase()}`);
          }}
          placeholder="#00639B"
          aria-label={`Código del color para ${label}`}
          aria-invalid={hexInvalid}
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] px-3 font-mono text-sm text-[var(--color-md-on-surface)] outline-none focus:border-[var(--color-md-primary)]"
        />
      </div>
      {hexInvalid && <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">Escribe el color como #RRGGBB, por ejemplo #3AA0E0.</p>}
    </div>
  );
};

/** Mini maqueta de la app con los colores generados (claro u oscuro). */
const PalettePreview: React.FC<{ label: string; tokens: ThemeTokenSet }> = ({ label, tokens }) => (
  <div className="min-w-0 flex-1 space-y-1">
    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">{label}</p>
    <div
      className="relative space-y-1.5 rounded-xl p-2 pb-7"
      style={{ backgroundColor: tokens.surface, border: `1px solid ${tokens.outlineVariant}` }}
      aria-hidden="true"
    >
      <div className="space-y-1.5 rounded-lg p-2" style={{ backgroundColor: tokens.cardBg, border: `1px solid ${tokens.outlineVariant}` }}>
        <p className="truncate text-[11px] font-bold" style={{ color: tokens.onSurface }}>
          Cálculo Diferencial
        </p>
        <p className="truncate text-[10px]" style={{ color: tokens.onSurfaceVariant }}>
          Lun 08:00 – 10:00
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ backgroundColor: tokens.secondaryContainer, color: tokens.onSecondaryContainer }}
          >
            MAT-101
          </span>
          <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: tokens.primary, color: tokens.onPrimary }}>
            Botón
          </span>
        </div>
      </div>
      {/* Barra inferior con la pestaña activa y el botón flotante en el acento */}
      <div
        className="absolute inset-x-0 bottom-0 flex h-6 items-center gap-1 rounded-b-xl px-2"
        style={{ backgroundColor: tokens.surfaceContainer, borderTop: `1px solid ${tokens.outlineVariant}` }}
      >
        <span className="h-3 w-7 rounded-full" style={{ backgroundColor: tokens.accentContainer ?? tokens.primaryContainer }} />
        <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: tokens.outlineVariant }} />
        <span className="h-1.5 w-4 rounded-full" style={{ backgroundColor: tokens.outlineVariant }} />
      </div>
      <span
        className="absolute bottom-[3px] right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-md text-[10px] font-black"
        style={{ backgroundColor: tokens.accent ?? tokens.primary, color: tokens.onAccent ?? tokens.onPrimary }}
      >
        +
      </span>
    </div>
  </div>
);

/**
 * "Crea tu paleta": tres colores (principal, acento y fondo) y un estilo de Material You. La app
 * calcula los colores de claro y oscuro con contraste legible. La librería de color se descarga
 * solo aquí, al abrir esta sección.
 */
export const CustomPaletteCreator: React.FC<CustomPaletteCreatorProps> = ({ initialRecipe, isActive, onApply }) => {
  const [recipe, setRecipe] = useState<PaletteRecipe>(initialRecipe);
  const [slot, setSlot] = useState<Slot>('primary');
  const [preview, setPreview] = useState<GeneratedTokens | null>(null);
  const [appliedKey, setAppliedKey] = useState<string | null>(isActive ? JSON.stringify(initialRecipe) : null);
  // Solo vale el resultado de la última receta pedida (si se cambian rápido, las anteriores se ignoran)
  const requestRef = useRef(0);

  const generate = (next: PaletteRecipe) => {
    const request = ++requestRef.current;
    void import('../../../shared/utils/paletteGenerator').then(({ generatePaletteTokens }) => {
      if (request === requestRef.current) setPreview(generatePaletteTokens(next));
    });
  };

  // Vista previa inicial, una sola vez al abrir la sección (carga diferida de la librería).
  // Después, la receta vive en el estado local: cambios externos no pisan lo que se está editando.
  const initialRecipeRef = useRef(initialRecipe);
  useEffect(() => {
    const request = ++requestRef.current;
    void import('../../../shared/utils/paletteGenerator').then(({ generatePaletteTokens }) => {
      if (request === requestRef.current) setPreview(generatePaletteTokens(initialRecipeRef.current));
    });
  }, []);

  const update = (changes: Partial<PaletteRecipe>) => {
    const next = { ...recipe, ...changes };
    setRecipe(next);
    generate(next);
  };

  const isApplied = appliedKey === JSON.stringify(recipe);
  const activeStyle = STYLE_OPTIONS.find((o) => o.value === recipe.style) ?? STYLE_OPTIONS[0];
  const light = preview?.light;
  const tintLabel = TINT_OPTIONS.find((o) => o.value === recipe.backgroundTint)?.label ?? 'Neutro';

  const slots: { id: Slot; label: string; detail: string; swatch: string }[] = [
    { id: 'primary', label: 'Principal', detail: recipe.seed, swatch: light?.primary ?? recipe.seed },
    { id: 'accent', label: 'Acento', detail: recipe.accent ?? 'Automático', swatch: light?.accent ?? recipe.accent ?? recipe.seed },
    { id: 'background', label: 'Fondo', detail: tintLabel, swatch: light?.surfaceContainerHigh ?? '#E2E7EF' },
  ];

  return (
    <div className="space-y-3">
      {/* Estilo */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-[var(--color-md-on-surface)]">Estilo</p>
        <div role="radiogroup" aria-label="Estilo de la paleta" className="flex flex-wrap gap-1.5">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={recipe.style === option.value}
              onClick={() => update({ style: option.value })}
              className={chipClass(recipe.style === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--color-md-on-surface-variant)]" aria-live="polite">
          {activeStyle.description}
        </p>
      </div>

      {/* Los tres colores: se toca uno para editarlo */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-[var(--color-md-on-surface)]">Colores</p>
        <div role="tablist" aria-label="Color que estás editando" className="grid grid-cols-3 gap-1.5">
          {slots.map((item) => {
            const selected = slot === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="palette-slot-editor"
                onClick={() => setSlot(item.id)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 transition-all duration-150 active:scale-[0.97] ${
                  selected
                    ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)]/40'
                    : 'border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)]'
                }`}
              >
                <span
                  className="h-7 w-7 rounded-full ring-1 ring-[var(--color-md-outline-variant)]"
                  style={{ backgroundColor: item.swatch }}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-bold text-[var(--color-md-on-surface)]">{item.label}</span>
                <span className="max-w-full truncate text-[10px] text-[var(--color-md-on-surface-variant)]">{item.detail}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="palette-slot-editor"
        role="tabpanel"
        className="space-y-2.5 rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] p-2.5"
      >
        {slot === 'primary' && (
          <>
            <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">Botones, enlaces y partes resaltadas.</p>
            <ColorField key="primary" label="el color principal" value={recipe.seed} onPick={(seed) => update({ seed })} />
          </>
        )}

        {slot === 'accent' && (
          <>
            <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">
              Botón flotante, pestaña activa, etiquetas y chips.
            </p>
            <button type="button" aria-pressed={recipe.accent === null} onClick={() => update({ accent: null })} className={chipClass(recipe.accent === null)}>
              {recipe.accent === null && <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
              Automático (según el estilo)
            </button>
            <ColorField
              key={`accent-${recipe.accent === null ? 'auto' : 'manual'}`}
              label="el acento"
              value={recipe.accent ?? light?.accent ?? recipe.seed}
              onPick={(accent) => update({ accent })}
            />
          </>
        )}

        {slot === 'background' && (
          <>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">Cuánto color lleva el fondo</p>
              <div role="radiogroup" aria-label="Cuánto color lleva el fondo" className="flex flex-wrap gap-1.5">
                {TINT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={recipe.backgroundTint === option.value}
                    onClick={() => update({ backgroundTint: option.value })}
                    className={chipClass(recipe.backgroundTint === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">Tono del fondo</p>
              <div role="radiogroup" aria-label="Tono del fondo" className="flex flex-wrap gap-1.5">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={recipe.backgroundSource === option.value}
                    onClick={() =>
                      update({
                        backgroundSource: option.value,
                        backgroundColor: option.value === 'custom' ? (recipe.backgroundColor ?? '#C2A57A') : recipe.backgroundColor,
                        // Elegir un tono sin tinte no se notaría: pasa a "Suave"
                        backgroundTint: recipe.backgroundTint === 'neutral' && option.value !== 'primary' ? 'soft' : recipe.backgroundTint,
                      })
                    }
                    className={chipClass(recipe.backgroundSource === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {recipe.backgroundSource === 'custom' && (
              <ColorField
                key="background"
                label="el fondo"
                value={recipe.backgroundColor ?? '#C2A57A'}
                onPick={(backgroundColor) => update({ backgroundColor })}
              />
            )}
          </>
        )}
      </div>

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
          onApply({ seed: recipe.seed, recipe, light: preview.light, dark: preview.dark });
          setAppliedKey(JSON.stringify(recipe));
        }}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-md-primary)] px-4 text-sm font-bold text-[var(--color-md-on-primary)] shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
      >
        {isApplied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
        {isApplied ? 'Tu paleta está en uso' : 'Usar esta paleta'}
      </button>
    </div>
  );
};
