/**
 * Precalcula las paletas fijas generadas con Material You y las escribe en
 * src/shared/utils/generatedPalettes.ts (así la app no carga la librería de color al arrancar).
 *
 * Uso: node --experimental-strip-types scripts/generate-palettes.ts
 * Para agregar una paleta: súmala a PRESETS y vuelve a ejecutar el script.
 */
import { writeFileSync } from 'node:fs';
import { generateThemeTokens } from '../src/shared/utils/paletteGenerator.ts';

const PRESETS = [
  { id: 'coral', name: 'Coral Tropical', subtitle: 'Cálido y vibrante', seed: '#FF7262' },
  { id: 'mustard', name: 'Mostaza Retro', subtitle: 'Dorado y acogedor', seed: '#C9A227' },
  { id: 'lime', name: 'Lima Neón', subtitle: 'Verde enérgico', seed: '#7CB518' },
  { id: 'mint', name: 'Menta Fresca', subtitle: 'Fresco y relajante', seed: '#26B5A0' },
  { id: 'sky', name: 'Cielo Glaciar', subtitle: 'Azul claro y luminoso', seed: '#3AA0E0' },
  { id: 'indigo', name: 'Índigo Nocturno', subtitle: 'Profundo y concentrado', seed: '#3F48CC' },
  { id: 'orchid', name: 'Orquídea', subtitle: 'Magenta floral', seed: '#B04FC4' },
  { id: 'mocha', name: 'Mocha Café', subtitle: 'Marrón cálido de cafetería', seed: '#7A5543' },
  { id: 'sand', name: 'Arena del Desierto', subtitle: 'Beige suave y natural', seed: '#C2A57A' },
  { id: 'stone', name: 'Piedra Cálida', subtitle: 'Gris cálido y sobrio', seed: '#6E6259' },
] as const;

const entries = PRESETS.map((preset) => {
  const { light, dark } = generateThemeTokens(preset.seed);
  return `  ${preset.id}: ${JSON.stringify({ id: preset.id, name: preset.name, subtitle: preset.subtitle, seed: preset.seed, light, dark }, null, 2)
    .split('\n')
    .join('\n  ')},`;
});

const output = `// ARCHIVO GENERADO por scripts/generate-palettes.ts — no editar a mano.
// Paletas calculadas con el algoritmo de Material You a partir de un color semilla.
import type { ColorThemeDefinition } from './theme';

export type GeneratedPaletteId = ${PRESETS.map((p) => `'${p.id}'`).join(' | ')};

export const GENERATED_PALETTES: Record<GeneratedPaletteId, ColorThemeDefinition> = {
${entries.join('\n')}
};
`;

writeFileSync(new URL('../src/shared/utils/generatedPalettes.ts', import.meta.url), output);
console.log(`Paletas generadas: ${PRESETS.length}`);
