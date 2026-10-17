import type { ThemeMode, MaterialColorTheme } from '../../features/settings/types';

export interface ColorThemeDefinition {
  id: MaterialColorTheme;
  name: string;
  seed: string;
  light: {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    outline: string;
    surfaceContainer: string;
  };
  dark: {
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    outline: string;
    surfaceContainer: string;
  };
}

export const MATERIAL_COLOR_PALETTES: Record<MaterialColorTheme, ColorThemeDefinition> = {
  blue: {
    id: 'blue',
    name: 'Azul Océano (Google M3)',
    seed: '#00639B',
    light: {
      primary: '#00639B',
      onPrimary: '#FFFFFF',
      primaryContainer: '#D0E4FF',
      onPrimaryContainer: '#001D32',
      secondaryContainer: '#D8E3F8',
      onSecondaryContainer: '#101C2B',
      outline: '#72777F',
      surfaceContainer: '#F1F4FA',
    },
    dark: {
      primary: '#92CCFF',
      onPrimary: '#003353',
      primaryContainer: '#004B76',
      onPrimaryContainer: '#D0E4FF',
      secondaryContainer: '#3C4758',
      onSecondaryContainer: '#D8E3F8',
      outline: '#8C9199',
      surfaceContainer: '#1D2024',
    },
  },
  purple: {
    id: 'purple',
    name: 'Lavanda Iris (Material You)',
    seed: '#6750A4',
    light: {
      primary: '#6750A4',
      onPrimary: '#FFFFFF',
      primaryContainer: '#EADDFF',
      onPrimaryContainer: '#21005D',
      secondaryContainer: '#E8DEF8',
      onSecondaryContainer: '#1D192B',
      outline: '#79747E',
      surfaceContainer: '#F7F2FA',
    },
    dark: {
      primary: '#D0BCFF',
      onPrimary: '#381E72',
      primaryContainer: '#4F378B',
      onPrimaryContainer: '#EADDFF',
      secondaryContainer: '#4A4458',
      onSecondaryContainer: '#E8DEF8',
      outline: '#938F99',
      surfaceContainer: '#211F26',
    },
  },
  green: {
    id: 'green',
    name: 'Bosque Esmeralda (Naturaleza)',
    seed: '#006E1C',
    light: {
      primary: '#006E1C',
      onPrimary: '#FFFFFF',
      primaryContainer: '#B6F397',
      onPrimaryContainer: '#002203',
      secondaryContainer: '#D8E7CB',
      onSecondaryContainer: '#131F0E',
      outline: '#72796F',
      surfaceContainer: '#F1F5ED',
    },
    dark: {
      primary: '#9BD67E',
      onPrimary: '#003A08',
      primaryContainer: '#005312',
      onPrimaryContainer: '#B6F397',
      secondaryContainer: '#3D4B36',
      onSecondaryContainer: '#D8E7CB',
      outline: '#8C9388',
      surfaceContainer: '#1B2118',
    },
  },
  amber: {
    id: 'amber',
    name: 'Melocotón Cálido (Atardecer)',
    seed: '#8B5000',
    light: {
      primary: '#8B5000',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFDCC2',
      onPrimaryContainer: '#2D1600',
      secondaryContainer: '#F5DFD1',
      onSecondaryContainer: '#251A12',
      outline: '#85746B',
      surfaceContainer: '#F8F2EE',
    },
    dark: {
      primary: '#FFB77B',
      onPrimary: '#4A2800',
      primaryContainer: '#683D00',
      onPrimaryContainer: '#FFDCC2',
      secondaryContainer: '#504137',
      onSecondaryContainer: '#F5DFD1',
      outline: '#9F8D84',
      surfaceContainer: '#251F1B',
    },
  },
  rose: {
    id: 'rose',
    name: 'Cereza Carmesí (Coral)',
    seed: '#984061',
    light: {
      primary: '#984061',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFD9E2',
      onPrimaryContainer: '#3E001D',
      secondaryContainer: '#F2DDE2',
      onSecondaryContainer: '#25171B',
      outline: '#837377',
      surfaceContainer: '#FAF1F3',
    },
    dark: {
      primary: '#FFB0C8',
      onPrimary: '#5E1133',
      primaryContainer: '#7B2949',
      onPrimaryContainer: '#FFD9E2',
      secondaryContainer: '#544046',
      onSecondaryContainer: '#F2DDE2',
      outline: '#9D8C91',
      surfaceContainer: '#261E21',
    },
  },
  teal: {
    id: 'teal',
    name: 'Aqua Turquesa (Cian)',
    seed: '#006A6A',
    light: {
      primary: '#006A6A',
      onPrimary: '#FFFFFF',
      primaryContainer: '#70F5F5',
      onPrimaryContainer: '#002020',
      secondaryContainer: '#CCE8E7',
      onSecondaryContainer: '#052020',
      outline: '#6F7979',
      surfaceContainer: '#EDF5F5',
    },
    dark: {
      primary: '#4ED8D8',
      onPrimary: '#003737',
      primaryContainer: '#004F4F',
      onPrimaryContainer: '#70F5F5',
      secondaryContainer: '#334B4B',
      onSecondaryContainer: '#CCE8E7',
      outline: '#899393',
      surfaceContainer: '#172121',
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

  // Aplicar paleta de color Material You dinámica
  const paletteDef = MATERIAL_COLOR_PALETTES[colorPalette] || MATERIAL_COLOR_PALETTES.blue;
  const tokens = isDark ? paletteDef.dark : paletteDef.light;

  root.style.setProperty('--color-md-primary', tokens.primary);
  root.style.setProperty('--color-md-on-primary', tokens.onPrimary);
  root.style.setProperty('--color-md-primary-container', tokens.primaryContainer);
  root.style.setProperty('--color-md-on-primary-container', tokens.onPrimaryContainer);
  root.style.setProperty('--color-md-secondary-container', tokens.secondaryContainer);
  root.style.setProperty('--color-md-on-secondary-container', tokens.onSecondaryContainer);
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
