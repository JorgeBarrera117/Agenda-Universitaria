import React, { useRef, useState } from 'react';
import { Check, ChevronDown, Frame, Layers, Monitor, Moon, Palette, Sparkles, Sun, Wand2, Zap } from 'lucide-react';
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

interface ThemeStudioProps {
  settings: AppSettings;
  onThemeChange: (theme: ThemeMode) => void;
  onPaletteChange: (palette: MaterialColorTheme) => void;
  onCardSurfaceChange: (style: CardSurfaceStyle) => void;
  onPerformanceModeChange: (enabled: boolean) => void;
  /** Guarda y aplica la paleta creada a partir de un color propio. */
  onCustomPaletteApply: (palette: CustomPaletteSettings) => void;
}

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

const THEME_LABEL: Record<ThemeMode, string> = { light: 'Claro', dark: 'Oscuro', system: 'Auto' };

const PRESET_KEYS = Object.keys(MATERIAL_COLOR_PALETTES) as PresetPalette[];

function SectionHeader({ icon, title, aside }: { icon: React.ReactNode; title: string; aside?: React.ReactNode }) {
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

/**
 * Apariencia en controles compactos: modo de luminosidad, paleta Material You, acabado de tarjetas
 * y Modo Ultra Fluidez. Las fichas de paleta muestran los colores reales de cada paleta en el modo activo.
 */
export const ThemeStudio: React.FC<ThemeStudioProps> = ({
  settings,
  onThemeChange,
  onPaletteChange,
  onCardSurfaceChange,
  onPerformanceModeChange,
  onCustomPaletteApply,
}) => {
  const paletteButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const currentPalette = settings.colorPalette || 'default';
  const customPalette = isValidCustomPalette(settings.customPalette) ? settings.customPalette : null;
  // "Tu paleta" aparece primero en la cuadrícula en cuanto existe
  const paletteKeys: MaterialColorTheme[] = customPalette ? ['custom', ...PRESET_KEYS] : PRESET_KEYS;
  const creatorSeed =
    customPalette?.seed ??
    (currentPalette !== 'custom' ? (MATERIAL_COLOR_PALETTES[currentPalette] ?? MATERIAL_COLOR_PALETTES.default).seed : '#00639B');
  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const surfaceOption = CARD_SURFACE_OPTIONS.find((o) => o.value === settings.cardSurfaceStyle) ?? CARD_SURFACE_OPTIONS[0];

  // Navegación con flechas dentro del grupo de paletas (radiogroup con tabindex itinerante)
  const handlePaletteKeyDown = (event: React.KeyboardEvent, index: number) => {
    const columns = window.matchMedia('(min-width: 640px)').matches ? 3 : 2;
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

      <section className="space-y-2 border-t border-[var(--color-md-outline-variant)] pt-3" aria-label="Color del tema">
        <SectionHeader
          icon={<Palette className="h-3.5 w-3.5" aria-hidden="true" />}
          title="Color del tema"
          aside={
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-[var(--color-md-primary-container)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-md-on-primary-container)]">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-md-primary)]"
                aria-hidden="true"
              />
              <span className="truncate">
                {paletteDisplayName(currentPalette)} · {THEME_LABEL[settings.theme]}
              </span>
            </span>
          }
        />

        <div role="radiogroup" aria-label="Paletas de color del tema" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {paletteKeys.map((key, index) => {
            const palette =
              key === 'custom' && customPalette
                ? { name: 'Tu paleta', subtitle: `Creada con ${customPalette.seed}`, light: customPalette.light, dark: customPalette.dark }
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
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onPaletteChange(key)}
                onKeyDown={(e) => handlePaletteKeyDown(e, index)}
                title={palette.subtitle}
                className={`flex h-11 min-w-0 items-center gap-2 rounded-xl border px-2.5 text-left transition-all duration-150 ease-out active:scale-[0.98] ${
                  isSelected
                    ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                    : 'border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] text-[var(--color-md-on-surface)] hover:border-[var(--color-md-outline)]'
                }`}
              >
                {/* Doble círculo: aro primaryContainer con núcleo primary de la propia paleta */}
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-[var(--color-md-outline-variant)]"
                  style={{ backgroundColor: tokens.primaryContainer }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tokens.primary }} />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold">{palette.name}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {/* Crea tu paleta: la librería de color solo se descarga al abrir esta sección */}
        <div className="rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)]">
          <button
            type="button"
            onClick={() => setCreatorOpen((open) => !open)}
            aria-expanded={creatorOpen}
            aria-controls="custom-palette-creator"
            className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left"
          >
            <Wand2 className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-[var(--color-md-on-surface)]">
                {customPalette ? 'Editar tu paleta' : 'Crea tu paleta'}
              </span>
              <span className="block text-[11px] text-[var(--color-md-on-surface-variant)]">
                Elige un color y la app calcula el resto para claro y oscuro.
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)] transition-transform duration-200 ${creatorOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {creatorOpen && (
            <div id="custom-palette-creator" className="border-t border-[var(--color-md-outline-variant)] p-3">
              <CustomPaletteCreator
                initialSeed={creatorSeed}
                isActive={currentPalette === 'custom'}
                onApply={onCustomPaletteApply}
              />
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2 border-t border-[var(--color-md-outline-variant)] pt-3" aria-label="Acabado de tarjetas">
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
