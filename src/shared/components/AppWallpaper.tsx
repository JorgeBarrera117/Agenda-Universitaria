import React, { useEffect, useState, useMemo } from 'react';
import { useAppSettings } from '../../features/settings/hooks/useAppSettings';
import type { WallpaperStyle } from '../../features/settings/types';
import { getPatternMask, getSeasonalMask, isPatternWallpaper, patternMaskSize } from '../wallpapers/wallpaperPatterns';
import { useSeason } from '../seasons/useSeason';

export const CUSTOM_WALLPAPER_STORAGE_KEY = 'agenda_custom_wallpaper_v1';

/**
 * Capa de composición propia para el fondo: translate3d + will-change la promueven a textura de
 * GPU y contain: strict aísla su layout y pintado, así que los cambios del resto de la página no
 * invalidan el fondo y el compositor lo reutiliza tal cual al hacer scroll.
 */
const WALLPAPER_LAYER_STYLE: React.CSSProperties = {
  transform: 'translate3d(0, 0, 0)',
  willChange: 'transform',
  contain: 'strict',
  backfaceVisibility: 'hidden',
};

/**
 * Helper para guardar o eliminar la foto de papel tapiz personalizada en almacenamiento local
 * y notificar en tiempo real al motor de fondo.
 */
export function saveCustomWallpaperDataUrl(dataUrl: string | null) {
  try {
    if (dataUrl) {
      localStorage.setItem(CUSTOM_WALLPAPER_STORAGE_KEY, dataUrl);
    } else {
      localStorage.removeItem(CUSTOM_WALLPAPER_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('agenda_wallpaper_image_updated', { detail: dataUrl }));
  } catch (e) {
    console.warn('No se pudo guardar el papel tapiz personalizado:', e);
  }
}

export function getCustomWallpaperDataUrl(): string | null {
  try {
    return localStorage.getItem(CUSTOM_WALLPAPER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Capa de Papel Tapiz Fija y Desacoplada en GPU (`position: fixed; inset: 0; pointer-events: none`).
 * - Se adapta en 0ms al color del tema (`var(--color-md-primary)`) y al modo Claro/Oscuro.
 * - Soporta patrones vectoriales o foto personalizada con opacidad, escala y desenfoque configurables.
 */
export const AppWallpaper: React.FC = () => {
  const { settings } = useAppSettings();
  const [customImage, setCustomImage] = useState<string | null>(() => getCustomWallpaperDataUrl());

  useEffect(() => {
    const handleCustomImageUpdate = (e: Event) => {
      const custom = e as CustomEvent<string | null>;
      if (custom.detail !== undefined) {
        setCustomImage(custom.detail);
      } else {
        setCustomImage(getCustomWallpaperDataUrl());
      }
    };

    window.addEventListener('agenda_wallpaper_image_updated', handleCustomImageUpdate);
    window.addEventListener('storage', handleCustomImageUpdate);
    return () => {
      window.removeEventListener('agenda_wallpaper_image_updated', handleCustomImageUpdate);
      window.removeEventListener('storage', handleCustomImageUpdate);
    };
  }, []);

  const style: WallpaperStyle = settings.wallpaperStyle || 'campus';
  const opacity = Math.max(0, Math.min(100, settings.wallpaperOpacity ?? 18)) / 100;
  const scale = Math.max(40, Math.min(250, settings.wallpaperScale ?? 100)) / 100;
  const blurPx = Math.max(0, Math.min(20, settings.wallpaperBlur ?? 0));
  const tintWithTheme = settings.wallpaperTintWithTheme ?? true;

  // En temporada (Navidad) el patrón elegido se cambia por el de la temporada; la foto propia y
  // el fondo liso se respetan
  const season = useSeason();
  const patternData = useMemo(() => {
    if (!isPatternWallpaper(style)) return null;
    return season ? getSeasonalMask(season) : getPatternMask(style);
  }, [style, season]);

  if (style === 'none') return null;

  // Renderizado de Foto Personalizada
  if (style === 'custom') {
    const activeSrc = customImage;
    if (!activeSrc) return null;

    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
        style={WALLPAPER_LAYER_STYLE}
      >
        <div
          style={{
            backgroundImage: `url("${activeSrc}")`,
            backgroundSize: scale <= 1.02 ? 'cover' : `${Math.round(scale * 100)}%`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity,
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
            transform: blurPx > 0 ? 'scale(1.06)' : undefined,
          }}
          className="w-full h-full transition-opacity duration-300"
        />
        {/* Tinte adaptativo opcional con el color primario del tema */}
        {tintWithTheme && (
          <div
            style={{
              backgroundColor: 'var(--color-md-primary)',
              opacity: Math.min(0.22, opacity * 0.35),
              mixBlendMode: 'color',
            }}
            className="absolute inset-0"
          />
        )}
        {/* Velo de legibilidad: una foto puede tener zonas muy claras u oscuras bajo el texto.
            Se usa el color de superficie del tema (negro puro en OLED, crema en Matcha…) */}
        <div className="absolute inset-0 bg-[var(--color-md-surface)]/45 dark:bg-[var(--color-md-surface)]/50" />
      </div>
    );
  }

  // Renderizado de Papel Tapiz Vectorial Adaptativo al Tema (M3 Primary Color)
  if (!patternData) return null;
  const maskSize = patternMaskSize(patternData, scale, 20);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      style={WALLPAPER_LAYER_STYLE}
    >
      {/* Resplandor ambiental suave del tema en las esquinas */}
      <div
        style={{
          background:
            'radial-gradient(circle at 15% 15%, var(--color-md-primary-container) 0%, transparent 55%), radial-gradient(circle at 85% 85%, var(--color-md-primary-container) 0%, transparent 55%)',
          opacity: Math.min(0.45, opacity * 1.4),
        }}
        className="absolute inset-0"
      />

      {/* Patrón Vectorial Coloreado Dinámicamente con var(--color-md-primary) */}
      <div
        style={{
          backgroundColor: 'var(--color-md-primary)',
          WebkitMaskImage: patternData.dataUri,
          maskImage: patternData.dataUri,
          WebkitMaskRepeat: 'repeat',
          maskRepeat: 'repeat',
          WebkitMaskSize: maskSize,
          maskSize,
          WebkitMaskPosition: 'center top',
          maskPosition: 'center top',
          opacity,
          filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
        }}
        className="w-full h-full transition-opacity duration-200"
      />
    </div>
  );
};
