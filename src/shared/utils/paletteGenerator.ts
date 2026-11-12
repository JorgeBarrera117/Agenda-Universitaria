import { argbFromHex, hexFromArgb, Hct, TonalPalette } from '@material/material-color-utilities';
import type { ThemeTokenSet } from './theme';

/**
 * Genera los tokens de la app (modo claro y oscuro) a partir de un solo color, con el algoritmo
 * oficial de Material You (@material/material-color-utilities, el de Android 12+):
 * - Paletas tonales en el espacio HCT, que mantiene el contraste percibido entre tonos, así el
 *   texto se lee bien aunque el color elegido sea difícil (un amarillo muy claro, por ejemplo).
 * - Tonos como el esquema "tonal spot" de Material 3 (primary 40/80, contenedores 90/30…).
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

export function generateThemeTokens(seedHex: string): GeneratedTokens {
  if (!isHexColor(seedHex)) throw new Error('El color debe tener el formato #RRGGBB.');
  const seed = Hct.fromInt(argbFromHex(seedHex));
  // Un gris queda gris (paleta monocroma); cualquier otro color gana viveza mínima como en Material 3
  const primaryChroma = seed.chroma < 10 ? seed.chroma : Math.max(seed.chroma, 40);
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
