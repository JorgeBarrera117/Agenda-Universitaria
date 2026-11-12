/**
 * Comprueba que cualquier receta de "Crea tu paleta" deja texto legible (WCAG ≥ 4.5:1) en los
 * pares texto/fondo principales, en claro y oscuro.
 *
 * Uso: node --experimental-strip-types scripts/check-palette-contrast.ts
 */
import { generatePaletteTokens } from '../src/shared/utils/paletteGenerator.ts';
import type { BackgroundSource, BackgroundTint, PaletteStyle } from '../src/features/settings/types.ts';
import type { ThemeTokenSet } from '../src/shared/utils/theme.ts';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const PAIRS: [keyof ThemeTokenSet, keyof ThemeTokenSet][] = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onAccent', 'accent'],
  ['onAccentContainer', 'accentContainer'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onSurface', 'surface'],
  ['onSurface', 'cardBg'],
  ['onSurfaceVariant', 'surfaceContainer'],
  ['onSurfaceVariant', 'surfaceContainerHigh'],
];

const SEEDS = ['#FFEB3B', '#00639B', '#E53935', '#7CB518', '#808080', '#000000', '#FFFFFF', '#FF00FF', '#00FFFF', '#3F48CC'];
const STYLES: PaletteStyle[] = ['balanced', 'vibrant', 'expressive', 'fidelity', 'monochrome'];
const TINTS: BackgroundTint[] = ['neutral', 'soft', 'strong'];
const SOURCES: BackgroundSource[] = ['primary', 'accent', 'custom'];
const ACCENTS = [null, '#FFEB3B', '#00BCD4', '#9E9E9E'];

let worst = Infinity;
let worstCase = '';
let checks = 0;
for (const seed of SEEDS)
  for (const style of STYLES)
    for (const backgroundTint of TINTS)
      for (const backgroundSource of SOURCES)
        for (const accent of ACCENTS) {
          const tokens = generatePaletteTokens({ seed, style, accent, backgroundTint, backgroundSource, backgroundColor: '#FF7262' });
          for (const mode of ['light', 'dark'] as const)
            for (const [fg, bg] of PAIRS) {
              const ratio = contrast(tokens[mode][fg] as string, tokens[mode][bg] as string);
              checks++;
              if (ratio < worst) {
                worst = ratio;
                worstCase = `${seed} ${style} ${backgroundTint}/${backgroundSource} acento=${accent} ${mode} ${String(fg)}/${String(bg)}`;
              }
            }
        }

console.log(`${checks} pares revisados. Peor contraste: ${worst.toFixed(2)}:1 (${worstCase})`);
if (worst < 4.5) process.exit(1);
