import React, { useEffect, useState, useMemo } from 'react';
import { useAppSettings } from '../../features/settings/hooks/useAppSettings';
import type { WallpaperStyle } from '../../features/settings/types';

export const CUSTOM_WALLPAPER_STORAGE_KEY = 'agenda_custom_wallpaper_v1';

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
 * Catálogo de patrones vectoriales SVG sin costuras (Seamless Tiles).
 * Se renderizan mediante `mask-image` sobre `background-color: var(--color-md-primary)`,
 * por lo que heredan instantáneamente el color del tema Material You elegido en claro y oscuro.
 */
const SVG_PATTERNS: Record<
  Exclude<WallpaperStyle, 'custom' | 'none'>,
  { baseSize: number; svg: string }
> = {
  // 1. Campus Universitario (Doodles estilo Telegram/WhatsApp: birrete, átomo, libro, código, bombilla, taza, fórmula, estrella)
  campus: {
    baseSize: 220,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <!-- Birrete de graduación -->
      <g transform="translate(18, 20) rotate(-10)">
        <path d="M22 10L2 20L22 30L42 20L22 10Z"/>
        <path d="M8 23V34C8 38 14 42 22 42C30 42 36 38 36 34V23"/>
        <path d="M40 21V35"/>
      </g>
      <!-- Átomo / Ciencia -->
      <g transform="translate(135, 18) rotate(12)">
        <ellipse cx="22" cy="22" rx="20" ry="8" transform="rotate(30 22 22)"/>
        <ellipse cx="22" cy="22" rx="20" ry="8" transform="rotate(-30 22 22)"/>
        <circle cx="22" cy="22" r="3" fill="black"/>
      </g>
      <!-- Símbolo de Código </> -->
      <g transform="translate(78, 72) rotate(-6)">
        <polyline points="12 8 2 18 12 28"/>
        <polyline points="32 8 42 18 32 28"/>
        <line x1="25" y1="4" x2="19" y2="32"/>
      </g>
      <!-- Libro Abierto -->
      <g transform="translate(16, 112) rotate(8)">
        <path d="M4 8C10 6 18 6 22 10C26 6 34 6 40 8V32C34 30 26 30 22 34C18 30 10 30 4 32V8Z"/>
        <line x1="22" y1="10" x2="22" y2="34"/>
      </g>
      <!-- Taza de Café de Estudio -->
      <g transform="translate(154, 102) rotate(-8)">
        <path d="M6 12H30V26C30 33 25 38 18 38C11 38 6 33 6 26V12Z"/>
        <path d="M30 15H35C38 15 40 17 40 20C40 23 38 25 35 25H30"/>
        <path d="M13 4C13 7 16 7 16 10"/>
        <path d="M21 4C21 7 24 7 24 10"/>
      </g>
      <!-- Bombilla / Idea -->
      <g transform="translate(86, 152) rotate(10)">
        <path d="M14 28H26"/>
        <path d="M16 33H24"/>
        <path d="M12 20C9 17 8 12 11 8C14 4 20 3 25 5C30 7 32 13 29 18C28 20 26 22 26 24H14C14 22 13 21 12 20Z"/>
      </g>
      <!-- Integral / Matemática y Compás -->
      <g transform="translate(26, 178) rotate(-14)">
        <path d="M14 4C10 4 9 8 9 14V24C9 30 8 34 4 34"/>
        <text x="16" y="25" font-family="monospace" font-size="14" stroke-width="1">dx</text>
      </g>
      <!-- Birrete / Diploma secundario -->
      <g transform="translate(152, 174) rotate(6)">
        <rect x="4" y="8" width="34" height="22" rx="4"/>
        <circle cx="21" cy="19" r="4"/>
        <path d="M18 23L15 34L21 31L27 34L24 23"/>
      </g>
      <!-- Destellos decorativos -->
      <path d="M95 25L97 31L103 33L97 35L95 41L93 35L87 33L93 31Z" stroke-width="1.3"/>
      <path d="M198 68L200 73L205 75L200 77L198 82L196 77L191 75L196 73Z" stroke-width="1.3"/>
      <circle cx="64" cy="132" r="2.2"/>
      <circle cx="136" cy="82" r="2.2"/>
      <circle cx="195" cy="152" r="2.2"/>
    </svg>`,
  },

  // 2. Plano de Ingeniería (Blueprint Grid Técnico)
  blueprint: {
    baseSize: 100,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="none">
      <path d="M100 0H0V100" stroke="black" stroke-width="1.5"/>
      <path d="M20 0V100M40 0V100M60 0V100M80 0V100M0 20H100M0 40H100M0 60H100M0 80H100" stroke="black" stroke-width="0.6" stroke-dasharray="2 2"/>
      <circle cx="0" cy="0" r="3" stroke="black" stroke-width="1.2"/>
      <circle cx="100" cy="0" r="3" stroke="black" stroke-width="1.2"/>
      <circle cx="0" cy="100" r="3" stroke="black" stroke-width="1.2"/>
      <circle cx="100" cy="100" r="3" stroke="black" stroke-width="1.2"/>
      <path d="M46 50H54M50 46V54" stroke="black" stroke-width="1.2"/>
    </svg>`,
  },

  // 3. Red de Nodos y Constelaciones (Grafo de Software)
  constellation: {
    baseSize: 160,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" fill="none" stroke="black">
      <line x1="24" y1="28" x2="82" y2="52" stroke-width="1.1"/>
      <line x1="82" y1="52" x2="136" y2="26" stroke-width="1.1"/>
      <line x1="82" y1="52" x2="64" y2="118" stroke-width="1.1"/>
      <line x1="24" y1="28" x2="30" y2="96" stroke-width="1.1"/>
      <line x1="30" y1="96" x2="64" y2="118" stroke-width="1.1"/>
      <line x1="64" y1="118" x2="128" y2="106" stroke-width="1.1"/>
      <line x1="136" y1="26" x2="128" y2="106" stroke-width="1.1"/>
      <line x1="128" y1="106" x2="144" y2="146" stroke-width="1.1"/>
      <line x1="64" y1="118" x2="24" y2="148" stroke-width="1.1"/>
      <circle cx="24" cy="28" r="4" fill="black"/>
      <circle cx="82" cy="52" r="5" fill="black"/>
      <circle cx="136" cy="26" r="3.5" fill="black"/>
      <circle cx="30" cy="96" r="3.5" fill="black"/>
      <circle cx="64" cy="118" r="4.5" fill="black"/>
      <circle cx="128" cy="106" r="4" fill="black"/>
      <circle cx="24" cy="148" r="3" fill="black"/>
      <circle cx="144" cy="146" r="3" fill="black"/>
    </svg>`,
  },

  // 4. Ondas Topográficas Orgánicas
  topographic: {
    baseSize: 180,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180" fill="none" stroke="black" stroke-width="1.4">
      <path d="M0 30C45 10 90 50 135 30C157 20 168 25 180 30"/>
      <path d="M0 65C40 45 85 85 130 65C155 55 168 60 180 65"/>
      <path d="M0 105C50 85 95 125 140 105C160 95 170 100 180 105"/>
      <path d="M0 145C45 125 90 165 135 145C157 135 168 140 180 145"/>
      <ellipse cx="90" cy="85" rx="32" ry="14" transform="rotate(-8 90 85)"/>
      <ellipse cx="90" cy="85" rx="14" ry="6" transform="rotate(-8 90 85)"/>
    </svg>`,
  },

  // 5. Puntos Minimalistas (Bullet Journal)
  dots: {
    baseSize: 36,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" fill="black">
      <circle cx="9" cy="9" r="2"/>
      <circle cx="27" cy="27" r="2"/>
    </svg>`,
  },
};

export function getPatternMaskDataUri(style: Exclude<WallpaperStyle, 'custom' | 'none'>): {
  dataUri: string;
  baseSize: number;
} {
  const entry = SVG_PATTERNS[style] || SVG_PATTERNS.campus;
  const encoded = encodeURIComponent(entry.svg.replace(/\s+/g, ' ').trim());
  return {
    dataUri: `url("data:image/svg+xml,${encoded}")`,
    baseSize: entry.baseSize,
  };
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

  const patternData = useMemo(() => {
    if (style === 'none' || style === 'custom') return null;
    return getPatternMaskDataUri(style);
  }, [style]);

  if (style === 'none') return null;

  // Renderizado de Foto Personalizada
  if (style === 'custom') {
    const activeSrc = customImage;
    if (!activeSrc) return null;

    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
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
      </div>
    );
  }

  // Renderizado de Papel Tapiz Vectorial Adaptativo al Tema (M3 Primary Color)
  if (!patternData) return null;
  const tileSizePx = Math.max(20, Math.round(patternData.baseSize * scale));

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
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
          WebkitMaskSize: `${tileSizePx}px ${tileSizePx}px`,
          maskSize: `${tileSizePx}px ${tileSizePx}px`,
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
