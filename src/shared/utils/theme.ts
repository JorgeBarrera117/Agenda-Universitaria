import type {
  CardSurfaceStyle,
  CustomPaletteSettings,
  MaterialColorTheme,
  PresetPalette,
  ThemeMode,
} from '../../features/settings/types';
import { GENERATED_PALETTES } from './generatedPalettes';

export interface ThemeTokenSet {
  /** Color principal (Botones "Aceptar", Switches activos, FABs, Íconos primarios) */
  primary: string;
  /** Estado hover del color principal */
  primaryHover: string;
  /** Texto/ícono sobre el color principal (alto contraste WCAG AAA) */
  onPrimary: string;
  /** Contenedor primario (Botones secundarios "Cancelar", Píldoras activas, Hero Card) */
  primaryContainer: string;
  /** Texto/ícono sobre contenedor primario */
  onPrimaryContainer: string;
  /**
   * Acento (opcional): botón flotante e indicador de la pestaña activa. Las paletas que no lo
   * traen usan el principal, así se ven igual que antes; la paleta propia puede elegir otro color.
   */
  accent?: string;
  onAccent?: string;
  accentContainer?: string;
  onAccentContainer?: string;
  /** Contenedor secundario (Acentos, Barras de menú, Badges tonales) */
  secondaryContainer: string;
  /** Texto/ícono sobre contenedor secundario */
  onSecondaryContainer: string;
  /** Fondo general de la aplicación */
  surface: string;
  /** Fondo de tarjetas ("Tarjeta") */
  cardBg: string;
  /** Fondo de barras de navegación, paneles y contenedores agrupados */
  surfaceContainer: string;
  /** Fondo de buscadores, inputs, selectores y chips inactivos */
  surfaceContainerHigh: string;
  /** Color de texto principal (Títulos y cuerpo de lectura de máxima legibilidad) */
  onSurface: string;
  /** Color de texto secundario (Subtítulos, etiquetas, metadatos legibles) */
  onSurfaceVariant: string;
  /** Bordes definidos y controles */
  outline: string;
  /** Bordes sutiles de tarjetas y divisores */
  outlineVariant: string;
}

export interface ColorThemeDefinition {
  id: PresetPalette;
  name: string;
  subtitle: string;
  seed: string;
  light: ThemeTokenSet;
  dark: ThemeTokenSet;
}

/**
 * REGISTRO CENTRAL DE PALETAS DE COLOR (MATERIAL YOU)
 * ============================================================================
 * Para agregar nuevas paletas en el futuro:
 * - Generadas (recomendado): súmala a PRESETS en scripts/generate-palettes.ts y ejecútalo; el
 *   tipo GeneratedPaletteId y GENERATED_PALETTES se actualizan solos.
 * - Hechas a mano: añade el identificador a `PresetPalette` en `src/features/settings/types.ts`
 *   y registra aquí su definición `light` y `dark`.
 * Toda la aplicación y el selector de Ajustes se adaptarán automáticamente.
 */
export const MATERIAL_COLOR_PALETTES: Record<PresetPalette, ColorThemeDefinition> = {
  default: {
    id: 'default',
    name: 'Clásico Pastel',
    subtitle: 'Predeterminado Original',
    seed: '#00639B',
    light: {
      primary: '#00639B',
      primaryHover: '#005282',
      onPrimary: '#FFFFFF',
      primaryContainer: '#D0E4FF',
      onPrimaryContainer: '#001D32',
      secondaryContainer: '#E2E7EF',
      onSecondaryContainer: '#191C20',
      surface: '#F8FAFC',
      cardBg: '#FDFBFF',
      surfaceContainer: '#F1F4FA',
      surfaceContainerHigh: '#E2E7EF',
      onSurface: '#191C20',
      onSurfaceVariant: '#43474E',
      outline: '#72777F',
      outlineVariant: '#C3C7D0',
    },
    dark: {
      primary: '#92CCFF',
      primaryHover: '#72BAF5',
      onPrimary: '#003353',
      primaryContainer: '#004B76',
      onPrimaryContainer: '#D0E4FF',
      secondaryContainer: '#272A2F',
      onSecondaryContainer: '#E2E2E6',
      surface: '#101418',
      cardBg: '#1D2024',
      surfaceContainer: '#1D2024',
      surfaceContainerHigh: '#272A2F',
      onSurface: '#E2E2E6',
      onSurfaceVariant: '#C3C7D0',
      outline: '#8C9199',
      outlineVariant: '#43474E',
    },
  },
  blue: {
    id: 'blue',
    name: 'Azul Océano',
    subtitle: 'Clásico Marino Profundo',
    seed: '#004A77',
    light: {
      primary: '#004A77',
      primaryHover: '#00385C',
      onPrimary: '#FFFFFF',
      primaryContainer: '#C6E0FF',
      onPrimaryContainer: '#001D32',
      secondaryContainer: '#D3E6F8',
      onSecondaryContainer: '#072138',
      surface: '#E4F1FC',
      cardBg: '#F6FAFF',
      surfaceContainer: '#D5E8FA',
      surfaceContainerHigh: '#C3DDF6',
      onSurface: '#071E33',
      onSurfaceVariant: '#1E4668',
      outline: '#4A7499',
      outlineVariant: '#A8C8E6',
    },
    dark: {
      primary: '#85C8FF',
      primaryHover: '#A6D8FF',
      onPrimary: '#002744',
      primaryContainer: '#004A77',
      onPrimaryContainer: '#D4EAFF',
      secondaryContainer: '#1D364F',
      onSecondaryContainer: '#D0E4FF',
      surface: '#0A1520',
      cardBg: '#112030',
      surfaceContainer: '#15273B',
      surfaceContainerHigh: '#1E354F',
      onSurface: '#E5F1FC',
      onSurfaceVariant: '#9EBCD8',
      outline: '#5C7D9C',
      outlineVariant: '#26425E',
    },
  },
  purple: {
    id: 'purple',
    name: 'Lavanda Iris',
    subtitle: 'Violeta Suave Material You',
    seed: '#654EA3',
    light: {
      primary: '#654EA3',
      primaryHover: '#513B8C',
      onPrimary: '#FFFFFF',
      primaryContainer: '#C8B5F2',
      onPrimaryContainer: '#20084E',
      secondaryContainer: '#BBA5EC',
      onSecondaryContainer: '#1E074B',
      surface: '#F2ECF9',
      cardBg: '#E6DCF5',
      surfaceContainer: '#DDD0F2',
      surfaceContainerHigh: '#CEBDEA',
      onSurface: '#1B0C38',
      onSurfaceVariant: '#463466',
      outline: '#76629B',
      outlineVariant: '#BCA8E0',
    },
    dark: {
      primary: '#D0BCFF',
      primaryHover: '#E2D4FF',
      onPrimary: '#321663',
      primaryContainer: '#4F378B',
      onPrimaryContainer: '#EFE6FF',
      secondaryContainer: '#362850',
      onSecondaryContainer: '#E8DEF8',
      surface: '#120D1D',
      cardBg: '#1B1429',
      surfaceContainer: '#231A34',
      surfaceContainerHigh: '#2F2345',
      onSurface: '#F2ECFA',
      onSurfaceVariant: '#C2B4D9',
      outline: '#8475A1',
      outlineVariant: '#3D2F59',
    },
  },
  green: {
    id: 'green',
    name: 'Bosque Esmeralda',
    subtitle: 'Verde Salvia y Naturaleza',
    seed: '#0D5624',
    light: {
      primary: '#0D5624',
      primaryHover: '#084019',
      onPrimary: '#FFFFFF',
      primaryContainer: '#BEEBC6',
      onPrimaryContainer: '#04260E',
      secondaryContainer: '#C5DEC8',
      onSecondaryContainer: '#0A3016',
      surface: '#ECF4EE',
      cardBg: '#E1EFE4',
      surfaceContainer: '#D1E3D5',
      surfaceContainerHigh: '#BDD4C2',
      onSurface: '#07220F',
      onSurfaceVariant: '#295035',
      outline: '#4C7759',
      outlineVariant: '#A9C6B0',
    },
    dark: {
      primary: '#8CE39F',
      primaryHover: '#A9EEB8',
      onPrimary: '#003312',
      primaryContainer: '#0D5624',
      onPrimaryContainer: '#C8F5D1',
      secondaryContainer: '#214029',
      onSecondaryContainer: '#C6DEC9',
      surface: '#0A160D',
      cardBg: '#112215',
      surfaceContainer: '#172D1C',
      surfaceContainerHigh: '#203C27',
      onSurface: '#E3F3E7',
      onSurfaceVariant: '#A5C4AD',
      outline: '#63876D',
      outlineVariant: '#2A4B33',
    },
  },
  amber: {
    id: 'amber',
    name: 'Melocotón Cálido',
    subtitle: 'Arena Dorada y Terracota',
    seed: '#88460C',
    light: {
      primary: '#88460C',
      primaryHover: '#6E3707',
      onPrimary: '#FFFFFF',
      primaryContainer: '#DDA46B',
      onPrimaryContainer: '#281100',
      secondaryContainer: '#E5CAA6',
      onSecondaryContainer: '#2E1500',
      surface: '#FCEEE0',
      cardBg: '#F1E1CB',
      surfaceContainer: '#E8D4B7',
      surfaceContainerHigh: '#DEC39E',
      onSurface: '#241000',
      onSurfaceVariant: '#573312',
      outline: '#8A5A2E',
      outlineVariant: '#CFAF86',
    },
    dark: {
      primary: '#FFB77B',
      primaryHover: '#FFCA9E',
      onPrimary: '#452200',
      primaryContainer: '#88460C',
      onPrimaryContainer: '#FFE3C8',
      secondaryContainer: '#45301C',
      onSecondaryContainer: '#F5DFC6',
      surface: '#181008',
      cardBg: '#24180D',
      surfaceContainer: '#2E2012',
      surfaceContainerHigh: '#3D2A18',
      onSurface: '#F9ECE0',
      onSurfaceVariant: '#D8BA9E',
      outline: '#967454',
      outlineVariant: '#4D3620',
    },
  },
  pink: {
    id: 'pink',
    name: 'Rosa Pastel',
    subtitle: 'Rosa Floral y Delicado',
    seed: '#B91C6B',
    light: {
      primary: '#B91C6B',
      primaryHover: '#9B1458',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFD8E8',
      onPrimaryContainer: '#3E001E',
      secondaryContainer: '#FAD0E3',
      onSecondaryContainer: '#3B0721',
      surface: '#FFF5F9',
      cardBg: '#FCE8F1',
      surfaceContainer: '#F8D8E7',
      surfaceContainerHigh: '#F2C4DA',
      onSurface: '#2B0718',
      onSurfaceVariant: '#662444',
      outline: '#994D72',
      outlineVariant: '#E4ADC7',
    },
    dark: {
      primary: '#FFAFD2',
      primaryHover: '#FFC8E0',
      onPrimary: '#5E0031',
      primaryContainer: '#890049',
      onPrimaryContainer: '#FFD8E8',
      secondaryContainer: '#4B1F35',
      onSecondaryContainer: '#FAD0E3',
      surface: '#190A12',
      cardBg: '#25101B',
      surfaceContainer: '#301624',
      surfaceContainerHigh: '#3F1D30',
      onSurface: '#FCE8F1',
      onSurfaceVariant: '#DFB5C9',
      outline: '#9E6E85',
      outlineVariant: '#53263B',
    },
  },
  rose: {
    id: 'rose',
    name: 'Cereza Carmesí',
    subtitle: 'Rosa Empolvado y Vino',
    seed: '#7D1D38',
    light: {
      primary: '#7D1D38',
      primaryHover: '#62142A',
      onPrimary: '#FFFFFF',
      primaryContainer: '#DC95A0',
      onPrimaryContainer: '#330310',
      secondaryContainer: '#E5B6BE',
      onSecondaryContainer: '#360412',
      surface: '#FCECEE',
      cardBg: '#F3D9DD',
      surfaceContainer: '#EAC8CE',
      surfaceContainerHigh: '#DFB3BC',
      onSurface: '#2B0510',
      onSurfaceVariant: '#632436',
      outline: '#965063',
      outlineVariant: '#D5A3AE',
    },
    dark: {
      primary: '#FFB1C5',
      primaryHover: '#FFC8D6',
      onPrimary: '#4E071E',
      primaryContainer: '#7D1D38',
      onPrimaryContainer: '#FFDCE4',
      secondaryContainer: '#4A212E',
      onSecondaryContainer: '#FADAE0',
      surface: '#1A0A0F',
      cardBg: '#261017',
      surfaceContainer: '#32161F',
      surfaceContainerHigh: '#421D29',
      onSurface: '#FCE8EC',
      onSurfaceVariant: '#DCB4BE',
      outline: '#9E6B78',
      outlineVariant: '#522533',
    },
  },
  teal: {
    id: 'teal',
    name: 'Aqua Turquesa (Cian)',
    subtitle: 'Agua Marina Refrescante',
    seed: '#004E52',
    light: {
      primary: '#004E52',
      primaryHover: '#003A3D',
      onPrimary: '#FFFFFF',
      primaryContainer: '#33D4C6',
      onPrimaryContainer: '#002022',
      secondaryContainer: '#8CEAE0',
      onSecondaryContainer: '#002426',
      surface: '#E6FAF7',
      cardBg: '#C8F5EE',
      surfaceContainer: '#AEEDE4',
      surfaceContainerHigh: '#8BE3D8',
      onSurface: '#002022',
      onSurfaceVariant: '#004A4D',
      outline: '#147A7E',
      outlineVariant: '#6AD1C7',
    },
    dark: {
      primary: '#45E3D6',
      primaryHover: '#74EFE5',
      onPrimary: '#002E30',
      primaryContainer: '#004E52',
      onPrimaryContainer: '#A6FAF2',
      secondaryContainer: '#17474B',
      onSecondaryContainer: '#BCEFEB',
      surface: '#061819',
      cardBg: '#0C2527',
      surfaceContainer: '#113134',
      surfaceContainerHigh: '#184246',
      onSurface: '#E0F7F5',
      onSurfaceVariant: '#96CECA',
      outline: '#4B8B88',
      outlineVariant: '#1E5255',
    },
  },
  oled: {
    id: 'oled',
    name: 'Cyberpunk OLED',
    subtitle: 'Negro puro y neón cian/violeta',
    seed: '#00E5FF',
    light: {
      primary: '#5B21B6',
      primaryHover: '#4C1D95',
      onPrimary: '#FFFFFF',
      primaryContainer: '#CCF7FF',
      onPrimaryContainer: '#002A33',
      secondaryContainer: '#EDE5FF',
      onSecondaryContainer: '#2A0E61',
      surface: '#F7F8FC',
      cardBg: '#FFFFFF',
      surfaceContainer: '#EEF0F7',
      surfaceContainerHigh: '#E2E5EF',
      onSurface: '#0B0D12',
      onSurfaceVariant: '#3E4454',
      outline: '#6B7280',
      outlineVariant: '#CDD2DE',
    },
    dark: {
      // Negro puro: en pantallas AMOLED los píxeles se apagan y ahorran batería
      primary: '#00E5FF',
      primaryHover: '#5CF0FF',
      onPrimary: '#00262E',
      primaryContainer: '#2A1260',
      onPrimaryContainer: '#E4D9FF',
      secondaryContainer: '#16122A',
      onSecondaryContainer: '#D9CCFF',
      surface: '#000000',
      cardBg: '#0D0F14',
      surfaceContainer: '#0D0F14',
      surfaceContainerHigh: '#171A22',
      onSurface: '#F2F5FA',
      onSurfaceVariant: '#A9B1C2',
      outline: '#6B7385',
      outlineVariant: '#262A36',
    },
  },
  matcha: {
    id: 'matcha',
    name: 'Matcha & Cream',
    subtitle: 'Papel crema lofi y verde orgánico',
    seed: '#4D6B2F',
    light: {
      primary: '#4D6B2F',
      primaryHover: '#3E5826',
      onPrimary: '#FFFFFF',
      primaryContainer: '#D9E8C4',
      onPrimaryContainer: '#16240A',
      secondaryContainer: '#EBE3D3',
      onSecondaryContainer: '#2E2717',
      surface: '#FAF7F2',
      cardBg: '#FFFDF9',
      surfaceContainer: '#F1ECE2',
      surfaceContainerHigh: '#E6DFD1',
      onSurface: '#22261C',
      onSurfaceVariant: '#4F5446',
      outline: '#7A7F6E',
      outlineVariant: '#D4CDBC',
    },
    dark: {
      primary: '#B5D68E',
      primaryHover: '#C8E3A7',
      onPrimary: '#1E3209',
      primaryContainer: '#35501A',
      onPrimaryContainer: '#D9EFC0',
      secondaryContainer: '#2C3326',
      onSecondaryContainer: '#E2E6D4',
      surface: '#0F130C',
      cardBg: '#181D14',
      surfaceContainer: '#1C2218',
      surfaceContainerHigh: '#262D20',
      onSurface: '#E8EBDF',
      onSurfaceVariant: '#BEC4B0',
      outline: '#868D79',
      outlineVariant: '#3A4232',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Horizon',
    subtitle: 'Terracota, coral y ámbar',
    seed: '#A93F22',
    light: {
      primary: '#A93F22',
      primaryHover: '#8C321A',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFD9C7',
      onPrimaryContainer: '#3A0E00',
      secondaryContainer: '#FFE3B0',
      onSecondaryContainer: '#2E1A00',
      surface: '#FFF6F1',
      cardBg: '#FFFBF8',
      surfaceContainer: '#FDE9DE',
      surfaceContainerHigh: '#F9D9C8',
      onSurface: '#2A1610',
      onSurfaceVariant: '#5E3F35',
      outline: '#8F6B5F',
      outlineVariant: '#E8C4B5',
    },
    dark: {
      primary: '#FFB59A',
      primaryHover: '#FFCAB6',
      onPrimary: '#5A1A06',
      primaryContainer: '#7A2E16',
      onPrimaryContainer: '#FFDBCC',
      secondaryContainer: '#4A3216',
      onSecondaryContainer: '#FFDDB0',
      surface: '#1A100C',
      cardBg: '#261813',
      surfaceContainer: '#2E1D17',
      surfaceContainerHigh: '#3B261E',
      onSurface: '#F9E7E0',
      onSurfaceVariant: '#DBBDB1',
      outline: '#A2867B',
      outlineVariant: '#523A31',
    },
  },
  slate: {
    id: 'slate',
    name: 'Minimalist Mono',
    subtitle: 'Monocromo de ultra-alto contraste',
    seed: '#18181B',
    light: {
      primary: '#18181B',
      primaryHover: '#000000',
      onPrimary: '#FFFFFF',
      primaryContainer: '#E4E4E7',
      onPrimaryContainer: '#09090B',
      secondaryContainer: '#F4F4F5',
      onSecondaryContainer: '#18181B',
      surface: '#FAFAFA',
      cardBg: '#FFFFFF',
      surfaceContainer: '#F4F4F5',
      surfaceContainerHigh: '#E4E4E7',
      onSurface: '#09090B',
      onSurfaceVariant: '#52525B',
      outline: '#71717A',
      outlineVariant: '#D4D4D8',
    },
    dark: {
      primary: '#FAFAFA',
      primaryHover: '#E4E4E7',
      onPrimary: '#09090B',
      primaryContainer: '#27272A',
      onPrimaryContainer: '#FAFAFA',
      secondaryContainer: '#1F1F23',
      onSecondaryContainer: '#E4E4E7',
      surface: '#09090B',
      cardBg: '#111113',
      surfaceContainer: '#18181B',
      surfaceContainerHigh: '#27272A',
      onSurface: '#FAFAFA',
      onSurfaceVariant: '#A1A1AA',
      outline: '#71717A',
      outlineVariant: '#2E2E33',
    },
  },
  // 10 paletas generadas con Material You (scripts/generate-palettes.ts)
  ...GENERATED_PALETTES,
};

const TOKEN_KEYS: readonly (keyof ThemeTokenSet)[] = [
  'primary',
  'primaryHover',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondaryContainer',
  'onSecondaryContainer',
  'surface',
  'cardBg',
  'surfaceContainer',
  'surfaceContainerHigh',
  'onSurface',
  'onSurfaceVariant',
  'outline',
  'outlineVariant',
];

/** ¿Tokens completos y válidos? (la paleta propia vive en localStorage y podría estar dañada). */
function isValidTokenSet(tokens: unknown): tokens is ThemeTokenSet {
  if (typeof tokens !== 'object' || tokens === null) return false;
  const record = tokens as Record<string, unknown>;
  const isHex = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const OPTIONAL_KEYS = ['accent', 'onAccent', 'accentContainer', 'onAccentContainer'] as const;
  return TOKEN_KEYS.every((key) => isHex(record[key])) && OPTIONAL_KEYS.every((key) => record[key] === undefined || isHex(record[key]));
}

export function isValidCustomPalette(custom: CustomPaletteSettings | undefined): custom is CustomPaletteSettings {
  return Boolean(custom && isValidTokenSet(custom.light) && isValidTokenSet(custom.dark));
}

/** Nombre visible de la paleta activa (la propia se llama "Tu paleta"). */
export function paletteDisplayName(palette: MaterialColorTheme): string {
  if (palette === 'custom') return 'Tu paleta';
  return (MATERIAL_COLOR_PALETTES[palette] ?? MATERIAL_COLOR_PALETTES.default).name;
}

/**
 * Aplica el acabado de tarjetas como atributo de :root. Los estilos viven en index.css
 * (variable --md-card-surface y reglas por [data-card-surface]), así que basta con cambiar el atributo.
 */
export function applyCardSurface(style: CardSurfaceStyle = 'solid'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-card-surface', style);
}

/**
 * Activa el Modo Ultra Fluidez como atributo de :root; las reglas viven en index.css bajo
 * [data-performance-mode='true']. Se quita el atributo (en vez de "false") para no dejar rastro.
 */
export function applyPerformanceMode(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  if (enabled) {
    document.documentElement.setAttribute('data-performance-mode', 'true');
  } else {
    document.documentElement.removeAttribute('data-performance-mode');
  }
}

export function applyTheme(
  theme: ThemeMode = 'light',
  colorPalette: MaterialColorTheme = 'default',
  customPalette?: CustomPaletteSettings
): void {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }

  // Paleta seleccionada: la propia si es válida; si no, la predefinida (fallback seguro a 'default')
  const custom = colorPalette === 'custom' && isValidCustomPalette(customPalette) ? customPalette : null;
  const paletteDef = custom
    ? { seed: custom.seed, light: custom.light, dark: custom.dark }
    : (colorPalette !== 'custom' && MATERIAL_COLOR_PALETTES[colorPalette]) || MATERIAL_COLOR_PALETTES.default;
  const tokens = isDark ? paletteDef.dark : paletteDef.light;

  // Inyectar tokens semánticos Material You en :root
  root.style.setProperty('--color-md-primary', tokens.primary);
  root.style.setProperty('--color-md-primary-hover', tokens.primaryHover);
  root.style.setProperty('--color-md-on-primary', tokens.onPrimary);
  root.style.setProperty('--color-md-primary-container', tokens.primaryContainer);
  root.style.setProperty('--color-md-on-primary-container', tokens.onPrimaryContainer);
  root.style.setProperty('--color-md-accent', tokens.accent ?? tokens.primary);
  root.style.setProperty('--color-md-on-accent', tokens.onAccent ?? tokens.onPrimary);
  root.style.setProperty('--color-md-accent-container', tokens.accentContainer ?? tokens.primaryContainer);
  root.style.setProperty('--color-md-on-accent-container', tokens.onAccentContainer ?? tokens.onPrimaryContainer);
  root.style.setProperty('--color-md-secondary-container', tokens.secondaryContainer);
  root.style.setProperty('--color-md-on-secondary-container', tokens.onSecondaryContainer);
  root.style.setProperty('--color-md-surface', tokens.surface);
  root.style.setProperty('--color-md-card-bg', tokens.cardBg);
  root.style.setProperty('--color-md-surface-container', tokens.surfaceContainer);
  root.style.setProperty('--color-md-surface-container-high', tokens.surfaceContainerHigh);
  root.style.setProperty('--color-md-on-surface', tokens.onSurface);
  root.style.setProperty('--color-md-on-surface-variant', tokens.onSurfaceVariant);
  root.style.setProperty('--color-md-outline', tokens.outline);
  root.style.setProperty('--color-md-outline-variant', tokens.outlineVariant);

  // Sincronizar alias legacy del proyecto (cove-* y card-*) para adaptación total
  root.style.setProperty('--color-cove-blue', tokens.primary);
  root.style.setProperty('--color-cove-sky', isDark ? tokens.primary : tokens.primaryContainer);
  root.style.setProperty('--color-cove-deep', tokens.primaryHover);
  root.style.setProperty('--color-cove-navy', tokens.onPrimaryContainer);
  root.style.setProperty('--card-bg', tokens.cardBg);
  root.style.setProperty('--card-border', tokens.outlineVariant);
  root.style.setProperty('--md-theme-seed', paletteDef.seed);

  root.setAttribute('data-color-palette', colorPalette);
}

/**
 * Escucha cambios en el esquema de color del sistema operativo si el modo es 'system'
 */
export function setupSystemThemeListener(
  currentTheme: ThemeMode,
  colorPalette: MaterialColorTheme = 'default',
  onThemeChange?: () => void,
  customPalette?: CustomPaletteSettings
): () => void {
  if (typeof window === 'undefined' || currentTheme !== 'system') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    applyTheme('system', colorPalette, customPalette);
    onThemeChange?.();
  };

  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}
