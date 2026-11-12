import React, { useRef, useState } from 'react';
import { Check, Frame, Layers, Monitor, Moon, Palette, Plus, Sparkles, Sun, X, Zap } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from '../../../shared/components/form';
import {
  MATERIAL_COLOR_PALETTES,
  isValidCustomPalette,
  paletteDisplayName,
  type ThemeTokenSet,
} from '../../../shared/utils/theme';
import { M3Switch } from './SettingsPrimitives';
import { CustomPaletteCreator } from './CustomPaletteCreator';
import type {
  AppSettings,
  CardSurfaceStyle,
  CustomPaletteSettings,
  MaterialColorTheme,
  PresetPalette,
  ThemeMode,
} from '../types';

const THEME_OPTIONS: SegmentedOption<ThemeMode>[] = [
  { value: 'light', label: 'Claro', icon: <Sun className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  { value: 'dark', label: 'Oscuro', icon: <Moon className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  { value: 'system', label: 'Auto', icon: <Monitor className="h-4 w-4 shrink-0" aria-hidden="true" /> },
];

const CARD_SURFACE_OPTIONS: (SegmentedOption<CardSurfaceStyle> & { description: string })[] = [
  {
    value: 'solid',
    label: 'Sólido',
    icon: <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />,
    description: 'Superficie limpia y opaca.',
  },
  {
    value: 'glass',
    label: 'Cristal',
    icon: <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />,
    description: 'Translúcido: deja ver el papel tapiz detrás de las tarjetas.',
  },
  {
    value: 'bordered',
    label: 'Bordeado',
    icon: <Frame className="h-4 w-4 shrink-0" aria-hidden="true" />,
    description: 'Plano, sin sombras y con bordes de alto contraste.',
  },
];

const PRESET_KEYS = Object.keys(MATERIAL_COLOR_PALETTES) as PresetPalette[];

/** Columnas de la cuadrícula de círculos (deben coincidir con grid-cols-6 / sm:grid-cols-8). */
const paletteColumns = () => (window.matchMedia('(min-width: 640px)').matches ? 8 : 6);

export function SectionHeader({ icon, title, aside }: { icon: React.ReactNode; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-xs font-bold text-[var(--color-md-on-surface)]">
        <span className="text-[var(--color-md-primary)]">{icon}</span>
        {title}
      </h3>
      {aside}
    </div>
  );
}

interface ThemeColorSectionProps {
  settings: AppSettings;
  onThemeChange: (theme: ThemeMode) => void;
  onPaletteChange: (palette: MaterialColorTheme) => void;
  /** Guarda y aplica la paleta creada a partir de un color propio. */
  onCustomPaletteApply: (palette: CustomPaletteSettings) => void;
}

/**
 * Bloque "Color": modo de luminosidad y paletas en círculos compactos (el nombre de la elegida va
 * en la etiqueta del encabezado). El círculo «+» abre "Crea tu paleta" debajo de la cuadrícula.
 */
export const ThemeColorSection: React.FC<ThemeColorSectionProps> = ({
  settings,
  onThemeChange,
  onPaletteChange,
  onCustomPaletteApply,
}) => {
  const paletteButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const currentPalette = settings.colorPalette || 'default';
  const customPalette = isValidCustomPalette(settings.customPalette) ? settings.customPalette : null;
  // "Tu paleta" aparece primero en cuanto existe
  const paletteKeys: MaterialColorTheme[] = customPalette ? ['custom', ...PRESET_KEYS] : PRESET_KEYS;
  const creatorSeed =
    customPalette?.seed ??
    (currentPalette !== 'custom' ? (MATERIAL_COLOR_PALETTES[currentPalette] ?? MATERIAL_COLOR_PALETTES.default).seed : '#00639B');
  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const activeSubtitle =
    currentPalette === 'custom'
      ? customPalette
        ? `Creada con ${customPalette.seed}`
        : ''
      : (MATERIAL_COLOR_PALETTES[currentPalette] ?? MATERIAL_COLOR_PALETTES.default).subtitle;

  // Navegación con flechas dentro del grupo de paletas (radiogroup con tabindex itinerante)
  const handlePaletteKeyDown = (event: React.KeyboardEvent, index: number) => {
    const columns = paletteColumns();
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? columns : event.key === 'ArrowUp' ? -columns : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + paletteKeys.length) % paletteKeys.length;
    onPaletteChange(paletteKeys[next]);
    paletteButtonsRef.current[next]?.focus();
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2" aria-label="Modo de luminosidad">
        <SectionHeader icon={<Sun className="h-3.5 w-3.5" aria-hidden="true" />} title="Modo de luminosidad" />
        <SegmentedControl value={settings.theme} onChange={onThemeChange} options={THEME_OPTIONS} ariaLabel="Modo de luminosidad" />
      </section>

      <section className="space-y-2.5 border-t border-[var(--color-md-outline-variant)] pt-3" aria-label="Paleta de color">
        <SectionHeader
          icon={<Palette className="h-3.5 w-3.5" aria-hidden="true" />}
          title="Paleta"
          aside={
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-[var(--color-md-primary-container)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-md-on-primary-container)]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-md-primary)]" aria-hidden="true" />
              <span className="truncate">{paletteDisplayName(currentPalette)}</span>
            </span>
          }
        />

        <div className="grid grid-cols-6 gap-x-2 gap-y-2.5 sm:grid-cols-8">
          <div role="radiogroup" aria-label="Paletas de color del tema" className="contents">
            {paletteKeys.map((key, index) => {
              const palette =
                key === 'custom' && customPalette
                  ? { name: 'Tu paleta', light: customPalette.light, dark: customPalette.dark }
                  : MATERIAL_COLOR_PALETTES[key === 'custom' ? 'default' : key];
              const tokens: ThemeTokenSet = isDark ? palette.dark : palette.light;
              const isSelected = currentPalette === key;
              return (
                <button
                  key={key}
                  ref={(el) => {
                    paletteButtonsRef.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={palette.name}
                  title={palette.name}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => onPaletteChange(key)}
                  onKeyDown={(e) => handlePaletteKeyDown(e, index)}
                  className={`mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90 ${
                    isSelected
                      ? 'ring-2 ring-[var(--color-md-primary)] ring-offset-2 ring-offset-[var(--color-md-card-bg)]'
                      : 'ring-1 ring-[var(--color-md-outline-variant)]'
                  }`}
                  style={{ backgroundColor: tokens.primaryContainer }}
                >
                  {/* Núcleo primary de la propia paleta; la elegida lleva la marca */}
                  <span
                    aria-hidden="true"
                    className="flex h-1/2 w-1/2 items-center justify-center rounded-full"
                    style={{ backgroundColor: tokens.primary, color: tokens.onPrimary }}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* «+»: crear o editar tu paleta */}
          <button
            type="button"
            onClick={() => setCreatorOpen((open) => !open)}
            aria-expanded={creatorOpen}
            aria-controls="custom-palette-creator"
            aria-label={customPalette ? 'Editar tu paleta' : 'Crea tu paleta'}
            title={customPalette ? 'Editar tu paleta' : 'Crea tu paleta'}
            className={`mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full border-2 border-dashed transition-all duration-150 ease-out active:scale-90 ${
              creatorOpen
                ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                : 'border-[var(--color-md-outline)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-primary)] hover:text-[var(--color-md-primary)]'
            }`}
          >
            {creatorOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        {activeSubtitle && !creatorOpen && (
          <p className="text-[11px] text-[var(--color-md-on-surface-variant)]" aria-live="polite">
            {activeSubtitle}
          </p>
        )}

        {creatorOpen && (
          <div
            id="custom-palette-creator"
            className="m3-tab-enter-right space-y-2 rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-3"
          >
            <p className="text-xs font-bold text-[var(--color-md-on-surface)]">{customPalette ? 'Editar tu paleta' : 'Crea tu paleta'}</p>
            <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">
              Elige un color y la app calcula el resto para claro y oscuro.
            </p>
            <CustomPaletteCreator
              initialRecipe={
                // La receta guardada; las paletas de 1.7.10.54 (solo color) o una nueva parten del estilo equilibrado
                (customPalette?.recipe && /^#[0-9a-f]{6}$/i.test(customPalette.recipe.seed) ? customPalette.recipe : null) ?? {
                  seed: creatorSeed,
                  style: 'balanced',
                  accent: null,
                  backgroundTint: 'neutral',
                  backgroundSource: 'primary',
                  backgroundColor: null,
                }
              }
              isActive={currentPalette === 'custom'}
              onApply={onCustomPaletteApply}
            />
          </div>
        )}
      </section>
    </div>
  );
};

interface CardStyleSectionProps {
  settings: AppSettings;
  onCardSurfaceChange: (style: CardSurfaceStyle) => void;
  onPerformanceModeChange: (enabled: boolean) => void;
}

/** Bloque "Tarjetas y rendimiento": acabado de tarjetas y Modo Ultra Fluidez. */
export const CardStyleSection: React.FC<CardStyleSectionProps> = ({ settings, onCardSurfaceChange, onPerformanceModeChange }) => {
  const surfaceOption = CARD_SURFACE_OPTIONS.find((o) => o.value === settings.cardSurfaceStyle) ?? CARD_SURFACE_OPTIONS[0];

  return (
    <div className="space-y-4">
      <section className="space-y-2" aria-label="Acabado de tarjetas">
        <SectionHeader icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />} title="Acabado de tarjetas" />
        <SegmentedControl
          value={settings.cardSurfaceStyle}
          onChange={onCardSurfaceChange}
          options={CARD_SURFACE_OPTIONS}
          ariaLabel="Acabado de tarjetas"
        />
        <p className="text-[11px] text-[var(--color-md-on-surface-variant)]" aria-live="polite">
          {settings.performanceMode && settings.cardSurfaceStyle === 'glass'
            ? 'Con el Modo Ultra Fluidez activo, el cristal se muestra como superficie sólida.'
            : surfaceOption.description}
        </p>
      </section>

      <section
        className="flex items-center justify-between gap-3 border-t border-[var(--color-md-outline-variant)] pt-3"
        aria-label="Rendimiento"
      >
        <div className="min-w-0">
          <SectionHeader icon={<Zap className="h-3.5 w-3.5" aria-hidden="true" />} title="Modo Ultra Fluidez (Bajo consumo)" />
          <p className="mt-0.5 text-[11px] text-[var(--color-md-on-surface-variant)]">
            Desactiva desenfoques pesados y sombras para máxima velocidad y ahorro de batería.
          </p>
        </div>
        <M3Switch
          checked={settings.performanceMode}
          onChange={onPerformanceModeChange}
          label="Modo Ultra Fluidez (Bajo consumo)"
        />
      </section>
    </div>
  );
};
