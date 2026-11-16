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

  const tokens = buildTokens(hex, { primary, accent, neutral, neutralVariant, primaryToneLight, primaryToneDark });

  // Colores exactos: el principal y el acento elegido se usan tal cual; solo en oscuro se aclaran
  // si se perderían sobre el fondo oscuro
  if (recipe.exactColors) {
    applyExactRole(tokens, 'primary', recipe.seed, primary, hex);
    if (recipe.accent && isHexColor(recipe.accent)) applyExactRole(tokens, 'accent', recipe.accent, accent, hex);
  }

  // Texto propio: exacto en claro; en oscuro, el mismo tono de color pero claro para que se lea
  if (recipe.textColor && isHexColor(recipe.textColor)) {
    const text = hctOf(recipe.textColor);
    const textPalette = TonalPalette.fromHueAndChroma(text.hue, Math.min(text.chroma, 16));
    tokens.light.onSurface = recipe.textColor.toUpperCase();
    tokens.light.onSurfaceVariant = hexFromArgb(Hct.from(text.hue, text.chroma, clamp(text.tone + 18, 0, 45)).toInt()).toUpperCase();
    tokens.dark.onSurface = hex(textPalette, 92);
    tokens.dark.onSurfaceVariant = hex(textPalette, 80);
  }

  return tokens;
}

/* ------------------------------------------------------------------ Contraste y colores exactos */

function relativeLuminance(color: string): number {
  const channel = (offset: number) => {
    const v = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Contraste WCAG entre dos colores #RRGGBB (1 a 21). Texto normal legible: 4.5 o más. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** El mismo color, más claro u oscuro (en HCT, así no cambia de tono ni de viveza). */
function shiftTone(color: string, delta: number): string {
  const h = hctOf(color);
  return hexFromArgb(Hct.from(h.hue, h.chroma, clamp(h.tone + delta, 0, 100)).toInt()).toUpperCase();
}

/** Texto sobre un color: blanco o el tono más oscuro de su paleta, el que más contraste dé. */
function onColorFor(color: string, darkText: string): string {
  return contrastRatio('#FFFFFF', color) >= contrastRatio(darkText, color) ? '#FFFFFF' : darkText;
}

type HexFn = (palette: TonalPalette, tone: number) => string;

function applyExactRole(tokens: GeneratedTokens, role: 'primary' | 'accent', chosen: string, palette: TonalPalette, hex: HexFn): void {
  const exact = chosen.toUpperCase();
  const darkText = hex(palette, 10);
  const lightHover = shiftTone(exact, hctOf(exact).tone < 15 ? 8 : -7);
  // En oscuro: el color tal cual si destaca sobre el fondo (3:1, lo mínimo para botones e íconos)
  const darkColor = contrastRatio(exact, tokens.dark.surface) >= 3 ? exact : hex(palette, 80);

  if (role === 'primary') {
    tokens.light.primary = exact;
    tokens.light.primaryHover = lightHover;
    tokens.light.onPrimary = onColorFor(exact, darkText);
    tokens.dark.primary = darkColor;
    tokens.dark.primaryHover = shiftTone(darkColor, -8);
    tokens.dark.onPrimary = onColorFor(darkColor, darkText);
  } else {
    tokens.light.accent = exact;
    tokens.light.onAccent = onColorFor(exact, darkText);
    tokens.dark.accent = darkColor;
    tokens.dark.onAccent = onColorFor(darkColor, darkText);
  }
}

interface ToneSources {
  primary: TonalPalette;
  accent: TonalPalette;
  neutral: TonalPalette;
  neutralVariant: TonalPalette;
  primaryToneLight: number;
  primaryToneDark: number;
}

/** Tokens de Material 3 a partir de las paletas tonales (niveles fijos, contraste garantizado). */
function buildTokens(hex: HexFn, { primary, accent, neutral, neutralVariant, primaryToneLight, primaryToneDark }: ToneSources): GeneratedTokens {
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
