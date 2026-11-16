import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Moon, Paintbrush, Plus, RotateCcw, Sun, Type, Wand2, X } from 'lucide-react';
import { M3ColorPickerModal } from '../../../shared/components/form';
import type { GeneratedTokens } from '../../../shared/utils/paletteGenerator';
import type { ThemeTokenSet } from '../../../shared/utils/theme';
import type { BackgroundSource, BackgroundTint, CustomPaletteSettings, PaletteRecipe, PaletteStyle } from '../types';
import { M3Switch } from './SettingsPrimitives';

interface CustomPaletteCreatorProps {
  /** Receta con la que empieza (la de tu paleta guardada o una nueva desde la paleta activa). */
  initialRecipe: PaletteRecipe;
  /** ¿La paleta propia es la que está en uso? */
  isActive: boolean;
  onApply: (palette: CustomPaletteSettings) => void;
}

/** Valores de fábrica del creador (el azul de la app, estilo equilibrado y colores exactos). */
const DEFAULT_CREATOR_RECIPE: PaletteRecipe = {
  seed: '#00639B',
  style: 'balanced',
  accent: null,
  backgroundTint: 'neutral',
  backgroundSource: 'primary',
  backgroundColor: null,
  exactColors: true,
  textColor: null,
};

const STYLE_OPTIONS: { value: PaletteStyle; label: string; description: string }[] = [
  { value: 'balanced', label: 'Equilibrado', description: 'Colores suaves y armónicos.' },
  { value: 'vibrant', label: 'Vibrante', description: 'Todo más intenso y saturado.' },
  { value: 'expressive', label: 'Expresivo', description: 'El acento contrasta con el principal.' },
  { value: 'fidelity', label: 'Fiel', description: 'Respeta la viveza de tu color.' },
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

type PickerTarget = 'seed' | 'accent' | 'textColor' | 'backgroundColor';

const PICKER_TITLES: Record<PickerTarget, string> = {
  seed: 'Color principal',
  accent: 'Color de acento',
  textColor: 'Color del texto',
  backgroundColor: 'Tono del fondo',
};

const chipClass = (selected: boolean) =>
  `inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-lg border px-3 text-xs font-semibold transition-colors duration-150 ${
    selected
      ? 'border-transparent bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]'
      : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/[0.06]'
  }`;

/**
 * Maqueta de la app con los colores calculados. Muestra cada color en el sitio donde se usa:
 * barra superior, tarjeta, texto, chip, botón, botón flotante y barra inferior.
 */
const PalettePreview: React.FC<{ tokens: ThemeTokenSet }> = ({ tokens }) => (
  <div
    className="relative overflow-hidden rounded-2xl"
    style={{ backgroundColor: tokens.surface, border: `1px solid ${tokens.outlineVariant}` }}
    aria-hidden="true"
  >
    <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: tokens.surfaceContainer }}>
      <span className="h-5 w-5 rounded-md" style={{ backgroundColor: tokens.primary }} />
      <span className="text-xs font-bold" style={{ color: tokens.onSurface }}>
        Mi agenda
      </span>
    </div>
    <div className="space-y-2 p-3 pb-11">
      <div className="space-y-1.5 rounded-xl p-2.5" style={{ backgroundColor: tokens.cardBg, border: `1px solid ${tokens.outlineVariant}` }}>
        <p className="text-sm font-bold" style={{ color: tokens.onSurface }}>
          Cálculo Diferencial
        </p>
        <p className="text-xs" style={{ color: tokens.onSurfaceVariant }}>
          Lun 08:00 – 10:00 · Aula 204
        </p>
        <div className="flex items-center gap-1.5 pt-0.5">
          <span
            className="rounded-md px-2 py-0.5 text-10px font-bold"
            style={{ backgroundColor: tokens.secondaryContainer, color: tokens.onSecondaryContainer }}
          >
            MAT-101
          </span>
          <span className="text-11px font-semibold" style={{ color: tokens.primary }}>
            Ver archivos
          </span>
          <span className="ml-auto rounded-full px-3 py-1 text-11px font-bold" style={{ backgroundColor: tokens.primary, color: tokens.onPrimary }}>
            Tomar apunte
          </span>
        </div>
      </div>
    </div>
    <div
      className="absolute inset-x-0 bottom-0 flex h-9 items-center gap-2 px-3"
      style={{ backgroundColor: tokens.surfaceContainer, borderTop: `1px solid ${tokens.outlineVariant}` }}
    >
      <span className="h-4 w-9 rounded-full" style={{ backgroundColor: tokens.accentContainer ?? tokens.primaryContainer }} />
      <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: tokens.outlineVariant }} />
      <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: tokens.outlineVariant }} />
    </div>
    {/* Botón flotante (acento) sobre la barra inferior, sin tapar la tarjeta */}
    <span
      className="absolute bottom-1 right-2 flex h-7 w-7 items-center justify-center rounded-lg shadow-sm"
      style={{ backgroundColor: tokens.accent ?? tokens.primary, color: tokens.onAccent ?? tokens.onPrimary }}
    >
      <Plus className="h-4 w-4" />
    </span>
  </div>
);

/** Fila de lista M3: muestra el color resultante, su valor y abre el selector al tocarla. */
const ColorRow: React.FC<{
  label: string;
  value: string;
  swatch: string;
  onClick: () => void;
  onReset?: () => void;
  warning?: string | null;
  icon?: React.ReactNode;
}> = ({ label, value, swatch, onClick, onReset, warning, icon }) => (
  <div className="flex items-center">
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--color-md-on-surface)]/[0.05]"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-[var(--color-md-outline-variant)]"
        style={{ backgroundColor: swatch }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--color-md-on-surface)]">{label}</span>
        <span className="block truncate font-mono text-xs text-[var(--color-md-on-surface-variant)]">{value}</span>
        {warning && (
          <span className="mt-0.5 flex items-start gap-1 text-11px leading-snug text-[var(--color-md-on-surface-variant)]">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            {warning}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-outline)]" aria-hidden="true" />
    </button>
    {onReset && (
      <button
        type="button"
        onClick={onReset}
        aria-label={`Volver ${label.toLowerCase()} a automático`}
        title="Volver a automático"
        className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/[0.08]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    )}
  </div>
);

/**
 * "Crea tu paleta" (Material You):
 * - Vista previa arriba, con claro/oscuro, para ver cada cambio al momento.
 * - Lista de colores (principal, acento, texto y fondo); cada uno abre el selector.
 * - Colores exactos: tal cual los eliges (solo se aclaran en oscuro si no se verían).
 * - Estilo y "Restablecer" para volver a los valores de fábrica.
 * La librería de color se descarga solo al abrir esta sección.
 */
export const CustomPaletteCreator: React.FC<CustomPaletteCreatorProps> = ({ initialRecipe, isActive, onApply }) => {
  const [recipe, setRecipe] = useState<PaletteRecipe>(initialRecipe);
  const [preview, setPreview] = useState<GeneratedTokens | null>(null);
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [appliedKey, setAppliedKey] = useState<string | null>(isActive ? JSON.stringify(initialRecipe) : null);
  const [contrast, setContrast] = useState<{ primary: number; text: number } | null>(null);
  // Solo vale el resultado de la última receta pedida (si se cambian rápido, las anteriores se ignoran)
  const requestRef = useRef(0);

  const generate = (next: PaletteRecipe) => {
    const request = ++requestRef.current;
    void import('../../../shared/utils/paletteGenerator').then(({ generatePaletteTokens, contrastRatio }) => {
      if (request !== requestRef.current) return;
      const tokens = generatePaletteTokens(next);
      setPreview(tokens);
      setContrast({
        primary: contrastRatio(tokens.light.primary, tokens.light.cardBg),
        text: Math.min(contrastRatio(tokens.light.onSurface, tokens.light.cardBg), contrastRatio(tokens.dark.onSurface, tokens.dark.cardBg)),
      });
    });
  };

  // Vista previa inicial, una sola vez al abrir la sección (carga diferida de la librería)
  const initialRecipeRef = useRef(initialRecipe);
  const generateRef = useRef(generate);
  useEffect(() => {
    generateRef.current(initialRecipeRef.current);
  }, []);

  const update = (changes: Partial<PaletteRecipe>) => {
    const next = { ...recipe, ...changes };
    setRecipe(next);
    generate(next);
  };

  const isApplied = appliedKey === JSON.stringify(recipe);
  const isDefault = JSON.stringify(recipe) === JSON.stringify(DEFAULT_CREATOR_RECIPE);
  const activeStyle = STYLE_OPTIONS.find((o) => o.value === recipe.style) ?? STYLE_OPTIONS[0];
  const tokens = preview?.[mode];
  const light = preview?.light;
  const tintLabel = TINT_OPTIONS.find((o) => o.value === recipe.backgroundTint)?.label ?? 'Neutro';
  const sourceLabel = SOURCE_OPTIONS.find((o) => o.value === recipe.backgroundSource)?.label ?? '';

  const pickerValue =
    picker === 'seed'
      ? recipe.seed
      : picker === 'accent'
        ? (recipe.accent ?? light?.accent ?? recipe.seed)
        : picker === 'textColor'
          ? (recipe.textColor ?? light?.onSurface ?? '#191C20')
          : (recipe.backgroundColor ?? '#C2A57A');

  const primaryWarning =
    contrast && contrast.primary < 3 ? 'Muy claro: los textos e íconos de este color costarán leerse en modo claro.' : null;
  const textWarning = contrast && recipe.textColor && contrast.text < 4.5 ? 'Poco contraste con el fondo: puede costar leerlo.' : null;

  return (
    <div className="space-y-3">
      {/* Vista previa con claro / oscuro */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-[var(--color-md-on-surface)]">Vista previa</p>
          <div role="radiogroup" aria-label="Modo de la vista previa" className="flex rounded-full border border-[var(--color-md-outline-variant)] p-0.5">
            {(['light', 'dark'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors ${
                  mode === m
                    ? 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]'
                    : 'text-[var(--color-md-on-surface-variant)]'
                }`}
              >
                {m === 'light' ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
                {m === 'light' ? 'Claro' : 'Oscuro'}
              </button>
            ))}
          </div>
        </div>
        {tokens ? <PalettePreview tokens={tokens} /> : <div className="h-40 animate-pulse rounded-2xl bg-[var(--color-md-surface-container-high)]" />}
      </div>

      {/* Colores: lista compacta; cada fila abre el selector */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] divide-y divide-[var(--color-md-outline-variant)]">
        <ColorRow
          label="Principal"
          value={recipe.seed}
          swatch={light?.primary ?? recipe.seed}
          warning={primaryWarning}
          onClick={() => setPicker('seed')}
        />
        <ColorRow
          label="Acento"
          value={recipe.accent ?? 'Automático'}
          swatch={light?.accent ?? recipe.accent ?? recipe.seed}
          onClick={() => setPicker('accent')}
          onReset={recipe.accent ? () => update({ accent: null }) : undefined}
        />
        <ColorRow
          label="Texto"
          value={recipe.textColor ?? 'Automático'}
          swatch={light?.cardBg ?? '#FFFFFF'}
          icon={<Type className="h-4 w-4" style={{ color: light?.onSurface ?? recipe.textColor ?? '#191C20' }} />}
          warning={textWarning}
          onClick={() => setPicker('textColor')}
          onReset={recipe.textColor ? () => update({ textColor: null }) : undefined}
        />
        <div>
          <ColorRow
            label="Fondo"
            value={`${tintLabel} · ${sourceLabel}`}
            swatch={light?.surfaceContainerHigh ?? '#E2E7EF'}
            icon={<Paintbrush className="h-4 w-4 text-[var(--color-md-on-surface-variant)]" />}
            onClick={() => setBackgroundOpen((open) => !open)}
          />
          {backgroundOpen && (
            <div className="space-y-2 px-3 pb-3">
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
                    {recipe.backgroundTint === option.value && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    {option.label}
                  </button>
                ))}
              </div>
              <div role="radiogroup" aria-label="Tono del fondo" className="flex flex-wrap gap-1.5">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={recipe.backgroundSource === option.value}
                    onClick={() => {
                      update({
                        backgroundSource: option.value,
                        backgroundColor: option.value === 'custom' ? (recipe.backgroundColor ?? '#C2A57A') : recipe.backgroundColor,
                        // Elegir un tono sin tinte no se notaría: pasa a "Suave"
                        backgroundTint: recipe.backgroundTint === 'neutral' && option.value !== 'primary' ? 'soft' : recipe.backgroundTint,
                      });
                      if (option.value === 'custom') setPicker('backgroundColor');
                    }}
                    className={chipClass(recipe.backgroundSource === option.value)}
                  >
                    {recipe.backgroundSource === option.value && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    {option.label}
                    {option.value === 'custom' && recipe.backgroundColor && recipe.backgroundSource === 'custom' && (
                      <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: recipe.backgroundColor }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Colores exactos */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--color-md-on-surface)]">Usar mis colores exactos</span>
          <span className="block text-xs leading-snug text-[var(--color-md-on-surface-variant)]">
            {recipe.exactColors
              ? 'Tal cual los eliges. En oscuro solo se aclaran si no se verían.'
              : 'Material You ajusta los tonos para que combinen y se lean bien.'}
          </span>
        </span>
        <M3Switch checked={recipe.exactColors === true} onChange={(exactColors) => update({ exactColors })} label="Usar mis colores exactos" />
      </div>

      {/* Estilo */}
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-[var(--color-md-on-surface)]">Estilo</p>
        <div role="radiogroup" aria-label="Estilo de la paleta" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={recipe.style === option.value}
              onClick={() => update({ style: option.value })}
              className={chipClass(recipe.style === option.value)}
            >
              {recipe.style === option.value && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--color-md-on-surface-variant)]" aria-live="polite">
          {activeStyle.description}
        </p>
      </div>

      {/* Acciones: en el teléfono, "Usar" ocupa la fila y "Restablecer" va debajo; en escritorio, en fila */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          disabled={isDefault}
          onClick={() => {
            setRecipe(DEFAULT_CREATOR_RECIPE);
            generate(DEFAULT_CREATOR_RECIPE);
            setBackgroundOpen(false);
          }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--color-md-outline)] px-4 text-sm font-semibold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/[0.08] disabled:opacity-40 sm:min-h-10"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Restablecer
        </button>
        <button
          type="button"
          disabled={!preview || isApplied}
          onClick={() => {
            if (!preview) return;
            onApply({ seed: recipe.seed, recipe, light: preview.light, dark: preview.dark });
            setAppliedKey(JSON.stringify(recipe));
          }}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-md-primary)] px-4 text-sm font-bold text-[var(--color-md-on-primary)] shadow-2xs transition-all duration-150 active:scale-[0.98] disabled:opacity-50 sm:min-h-10"
        >
          {isApplied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
          {isApplied ? 'Tu paleta está en uso' : 'Usar esta paleta'}
        </button>
      </div>

      {/* Selector de color (el mismo para los cuatro): devuelve el color exacto elegido */}
      <M3ColorPickerModal
        isOpen={picker !== null}
        initialColor={pickerValue}
        onClose={() => setPicker(null)}
        onApply={(color) => {
          const value = color.toUpperCase();
          if (picker) update({ [picker]: value } as Partial<PaletteRecipe>);
          setPicker(null);
        }}
        title={picker ? PICKER_TITLES[picker] : 'Color'}
        showIconContrastHint={false}
      />
    </div>
  );
};
