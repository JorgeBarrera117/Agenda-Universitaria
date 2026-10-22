import type { ThemeMode, MaterialColorTheme } from '../../features/settings/types';

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
  id: MaterialColorTheme;
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
 * 1. Añade el identificador al tipo `MaterialColorTheme` en `src/features/settings/types.ts`
 * 2. Registra aquí su definición `light` y `dark`.
 * Toda la aplicación y el selector de Ajustes se adaptarán automáticamente.
 */
export const MATERIAL_COLOR_PALETTES: Record<MaterialColorTheme, ColorThemeDefinition> = {
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
};

export function applyTheme(
  theme: ThemeMode = 'light',
  colorPalette: MaterialColorTheme = 'blue'
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

  // Obtener definición de la paleta seleccionada (con fallback seguro a 'blue')
  const paletteDef = MATERIAL_COLOR_PALETTES[colorPalette] || MATERIAL_COLOR_PALETTES.blue;
  const tokens = isDark ? paletteDef.dark : paletteDef.light;

  // Inyectar tokens semánticos Material You en :root
  root.style.setProperty('--color-md-primary', tokens.primary);
  root.style.setProperty('--color-md-primary-hover', tokens.primaryHover);
  root.style.setProperty('--color-md-on-primary', tokens.onPrimary);
  root.style.setProperty('--color-md-primary-container', tokens.primaryContainer);
  root.style.setProperty('--color-md-on-primary-container', tokens.onPrimaryContainer);
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
  colorPalette: MaterialColorTheme = 'blue',
  onThemeChange?: () => void
): () => void {
  if (typeof window === 'undefined' || currentTheme !== 'system') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    applyTheme('system', colorPalette);
    onThemeChange?.();
  };

  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}
