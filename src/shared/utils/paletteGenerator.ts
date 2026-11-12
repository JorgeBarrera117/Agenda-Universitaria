import { argbFromHex, hexFromArgb, Hct, TonalPalette } from '@material/material-color-utilities';
import type { ThemeTokenSet } from './theme';
import type { BackgroundTint, PaletteRecipe, PaletteStyle } from '../../features/settings/types';

/**
 * Genera los tokens de la app (modo claro y oscuro) con el algoritmo oficial de Material You
 * (@material/material-color-utilities, el de Android 12+):
 * - Cada color se convierte en una paleta tonal en el espacio HCT (tono, viveza, luminosidad),
 *   que mantiene el contraste percibido entre niveles: el texto se lee bien aunque el color
 *   elegido sea difícil (un amarillo muy claro, por ejemplo).
 * - Los tokens toman niveles fijos de esas paletas como el esquema de Material 3 (primary 40/80,
 *   contenedores 90/30…). Por eso combinar colores "raros" nunca deja texto ilegible.
 *
 * Esta librería solo se carga en Temas (al crear tu paleta) y en scripts/generate-palettes.ts
 * (que precalcula las paletas fijas): la app guarda los colores ya calculados y no la necesita
 * al arrancar.
 */
export interface GeneratedTokens {
  light: ThemeTokenSet;
  dark: ThemeTokenSet;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** Bajo esta viveza un color se considera gris y se respeta como tal. */
const GRAY_CHROMA = 10;

interface StyleRule {
  /** Viveza mínima del principal (los grises se quedan grises). */
  primaryMinChroma: number;
  /** Acento automático: giro de tono respecto al principal y su viveza. */
  accentHueShift: number;
  accentChroma: number;
  /** Viveza de las superficies cuando el fondo es "Neutro". */
  neutralChroma: number;
  neutralVariantChroma: number;
}

const STYLE_RULES: Record<PaletteStyle, StyleRule> = {
  // Como el "Tonal Spot" de Material 3: suave y armónico
  balanced: { primaryMinChroma: 40, accentHueShift: 60, accentChroma: 36, neutralChroma: 4, neutralVariantChroma: 8 },
  // Todo más saturado
  vibrant: { primaryMinChroma: 72, accentHueShift: 60, accentChroma: 60, neutralChroma: 6, neutralVariantChroma: 10 },
  // Acento casi complementario: contraste llamativo entre principal y acento
  expressive: { primaryMinChroma: 48, accentHueShift: 150, accentChroma: 52, neutralChroma: 6, neutralVariantChroma: 10 },
  // Respeta la viveza exacta del color elegido
  fidelity: { primaryMinChroma: 0, accentHueShift: 60, accentChroma: 36, neutralChroma: 4, neutralVariantChroma: 8 },
  // Grises: el color solo vive en el acento
  monochrome: { primaryMinChroma: 0, accentHueShift: 0, accentChroma: 40, neutralChroma: 0, neutralVariantChroma: 0 },
};

/** Viveza de las superficies según cuánto color se quiere en el fondo. */
const BACKGROUND_CHROMA: Record<Exclude<BackgroundTint, 'neutral'>, { neutral: number; neutralVariant: number }> = {
  soft: { neutral: 10, neutralVariant: 14 },
  strong: { neutral: 20, neutralVariant: 26 },
};

export const DEFAULT_RECIPE: Omit<PaletteRecipe, 'seed'> = {
  style: 'balanced',
  accent: null,
  backgroundTint: 'neutral',
  backgroundSource: 'primary',
  backgroundColor: null,
};

const rotateHue = (hue: number, shift: number) => (((hue + shift) % 360) + 360) % 360;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const hctOf = (hex: string) => Hct.fromInt(argbFromHex(hex));

/**
 * Calcula los tokens a partir de la receta del estudiante: color principal, estilo, acento
 * (automático o elegido) y fondo (cuánto color y de qué tono).
 */
export function generatePaletteTokens(recipe: PaletteRecipe): GeneratedTokens {
  if (!isHexColor(recipe.seed)) throw new Error('El color debe tener el formato #RRGGBB.');
  const rule = STYLE_RULES[recipe.style] ?? STYLE_RULES.balanced;
  const seed = hctOf(recipe.seed);
  const seedIsGray = seed.chroma < GRAY_CHROMA;

  // Principal
  const primaryChroma =
    recipe.style === 'monochrome' ? 0 : seedIsGray ? seed.chroma : Math.max(seed.chroma, rule.primaryMinChroma);
  const primary = TonalPalette.fromHueAndChroma(seed.hue, primaryChroma);

  // Acento: el elegido (con la viveza mínima del estilo) o uno automático derivado del principal
  let accentHue: number;
  let accentChroma: number;
  if (recipe.accent && isHexColor(recipe.accent)) {
    const accent = hctOf(recipe.accent);
    accentHue = accent.hue;
    accentChroma = accent.chroma < GRAY_CHROMA ? accent.chroma : Math.max(accent.chroma, Math.min(rule.accentChroma, 48));
  } else {
    accentHue = rotateHue(seed.hue, rule.accentHueShift);
    accentChroma = seedIsGray ? seed.chroma : rule.accentChroma;
    if (recipe.style === 'monochrome' && !seedIsGray) accentChroma = Math.max(seed.chroma, rule.accentChroma);
  }
  const accent = TonalPalette.fromHueAndChroma(accentHue, accentChroma);

  // Fondo: tono del principal, del acento o de otro color; viveza según el tinte elegido
  const backgroundHue =
    recipe.backgroundSource === 'accent'
      ? accentHue
      : recipe.backgroundSource === 'custom' && recipe.backgroundColor && isHexColor(recipe.backgroundColor)
        ? hctOf(recipe.backgroundColor).hue
        : seed.hue;
  const tinted = recipe.backgroundTint === 'neutral' ? null : BACKGROUND_CHROMA[recipe.backgroundTint];
  // Un principal gris con fondo "Neutro" no recibe color de rebote
  const neutralChroma = tinted ? tinted.neutral : Math.min(rule.neutralChroma, seedIsGray ? seed.chroma : rule.neutralChroma);
  const neutralVariantChroma = tinted
    ? tinted.neutralVariant
    : Math.min(rule.neutralVariantChroma, seedIsGray ? seed.chroma : rule.neutralVariantChroma);
  const neutral = TonalPalette.fromHueAndChroma(backgroundHue, neutralChroma);
  const neutralVariant = TonalPalette.fromHueAndChroma(backgroundHue, neutralVariantChroma);

  // "Fiel": el principal usa la luminosidad real del color, dentro del rango que garantiza
  // contraste con su texto (52 niveles o más de diferencia ≥ 4.5:1)
  const primaryToneLight = recipe.style === 'fidelity' ? clamp(Math.round(seed.tone), 20, 48) : 40;
  const primaryToneDark = recipe.style === 'fidelity' ? clamp(Math.round(seed.tone), 70, 90) : 80;

  const hex = (palette: TonalPalette, tone: number) => hexFromArgb(palette.tone(tone)).toUpperCase();

  return {
    light: {
      primary: hex(primary, primaryToneLight),
      primaryHover: hex(primary, primaryToneLight - 7),
      onPrimary: hex(primary, 100),
      primaryContainer: hex(primary, 90),
      onPrimaryContainer: hex(primary, 10),
      accent: hex(accent, 40),
      onAccent: hex(accent, 100),
      accentContainer: hex(accent, 90),
      onAccentContainer: hex(accent, 10),
      // Los chips y etiquetas tonales llevan el acento
      secondaryContainer: hex(accent, 90),
      onSecondaryContainer: hex(accent, 10),
      surface: hex(neutral, 98),
      cardBg: hex(neutral, 99),
      surfaceContainer: hex(neutral, 95),
      surfaceContainerHigh: hex(neutralVariant, 90),
      onSurface: hex(neutral, 10),
      onSurfaceVariant: hex(neutralVariant, 30),
      outline: hex(neutralVariant, 50),
      outlineVariant: hex(neutralVariant, 80),
    },
    dark: {
      primary: hex(primary, primaryToneDark),
      primaryHover: hex(primary, primaryToneDark - 8),
      onPrimary: hex(primary, 20),
      primaryContainer: hex(primary, 30),
      onPrimaryContainer: hex(primary, 90),
      accent: hex(accent, 80),
      onAccent: hex(accent, 20),
      accentContainer: hex(accent, 30),
      onAccentContainer: hex(accent, 90),
      secondaryContainer: hex(accent, 30),
      onSecondaryContainer: hex(accent, 90),
      surface: hex(neutral, 6),
      cardBg: hex(neutral, 12),
      surfaceContainer: hex(neutral, 12),
      surfaceContainerHigh: hex(neutral, 17),
      onSurface: hex(neutral, 90),
      onSurfaceVariant: hex(neutralVariant, 80),
      outline: hex(neutralVariant, 60),
      outlineVariant: hex(neutralVariant, 30),
    },
  };
}

/**
 * Receta clásica de un solo color (la de las paletas precalculadas en generatedPalettes.ts).
 * Se mantiene tal cual para que volver a ejecutar el script no cambie esas paletas.
 */
export function generateThemeTokens(seedHex: string): GeneratedTokens {
  if (!isHexColor(seedHex)) throw new Error('El color debe tener el formato #RRGGBB.');
  const seed = hctOf(seedHex);
  // Un gris queda gris (paleta monocroma); cualquier otro color gana viveza mínima como en Material 3
  const primaryChroma = seed.chroma < GRAY_CHROMA ? seed.chroma : Math.max(seed.chroma, 40);
  const primary = TonalPalette.fromHueAndChroma(seed.hue, primaryChroma);
  const secondary = TonalPalette.fromHueAndChroma(seed.hue, Math.min(16, primaryChroma));
  const neutral = TonalPalette.fromHueAndChroma(seed.hue, Math.min(4, primaryChroma));
  const neutralVariant = TonalPalette.fromHueAndChroma(seed.hue, Math.min(8, primaryChroma));
  const hex = (palette: TonalPalette, tone: number) => hexFromArgb(palette.tone(tone)).toUpperCase();

  return {
    light: {
      primary: hex(primary, 40),
      primaryHover: hex(primary, 33),
      onPrimary: hex(primary, 100),
      primaryContainer: hex(primary, 90),
      onPrimaryContainer: hex(primary, 10),
      secondaryContainer: hex(secondary, 90),
      onSecondaryContainer: hex(secondary, 10),
      surface: hex(neutral, 98),
      cardBg: hex(neutral, 99),
      surfaceContainer: hex(neutral, 95),
      surfaceContainerHigh: hex(neutralVariant, 90),
      onSurface: hex(neutral, 10),
      onSurfaceVariant: hex(neutralVariant, 30),
      outline: hex(neutralVariant, 50),
      outlineVariant: hex(neutralVariant, 80),
    },
    dark: {
      primary: hex(primary, 80),
      primaryHover: hex(primary, 72),
      onPrimary: hex(primary, 20),
      primaryContainer: hex(primary, 30),
      onPrimaryContainer: hex(primary, 90),
      secondaryContainer: hex(secondary, 30),
      onSecondaryContainer: hex(secondary, 90),
      surface: hex(neutral, 6),
      cardBg: hex(neutral, 12),
      surfaceContainer: hex(neutral, 12),
      surfaceContainerHigh: hex(neutral, 17),
      onSurface: hex(neutral, 90),
      onSurfaceVariant: hex(neutralVariant, 80),
      outline: hex(neutralVariant, 60),
      outlineVariant: hex(neutralVariant, 30),
    },
  };
}
