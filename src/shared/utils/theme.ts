import type { ThemeMode } from '../../features/settings/types';

export function applyTheme(theme: ThemeMode = 'light'): void {
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
}

/**
 * Escucha cambios en el esquema de color del sistema operativo si el modo es 'system'
 */
export function setupSystemThemeListener(
  currentTheme: ThemeMode,
  onThemeChange: () => void
): () => void {
  if (typeof window === 'undefined' || currentTheme !== 'system') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    applyTheme('system');
    onThemeChange();
  };

  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}
