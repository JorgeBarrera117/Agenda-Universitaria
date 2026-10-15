/**
 * QUARKS: Design Tokens del Sistema de Diseño "Campus Cove"
 * Brad Frost Atomic Design (Sub-Atomic Foundation Level)
 * 
 * Define los valores primitivos, escalas semánticas y constantes
 * consumidas por los componentes atómicos (Atoms) y organismos.
 */

export const quarks = {
  // 1. PALETA CROMÁTICA
  colors: {
    brand: {
      coveBlue: '#006BBB',
      coveSky: '#30A0E0',
      coveGold: '#FFC872',
      coveSand: '#FFE3B3',
      coveDeep: '#004d88',
      coveNavy: '#081d33',
    },
    semantic: {
      success: {
        light: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 0.25)',
      },
      warning: {
        light: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(245, 158, 11, 0.25)',
      },
      danger: {
        light: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.25)',
      },
      info: {
        light: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(59, 130, 246, 0.25)',
      },
    },
    neutral: {
      lightBg: '#f8fafc',
      lightCard: '#ffffff',
      lightBorder: '#e2e8f0',
      lightTextPrimary: '#0f172a',
      lightTextSecondary: '#64748b',
      darkBg: '#020617',
      darkCard: '#0f172a',
      darkBorder: '#1e293b',
      darkTextPrimary: '#f8fafc',
      darkTextSecondary: '#94a3b8',
    },
  },

  // 2. ESCALA DE RADIOS DE BORDE (BORDER RADIUS)
  borderRadius: {
    badge: 'rounded-xl',       // 12px - Micro-pills, badges, chips
    control: 'rounded-2xl',     // 16px - Botones, inputs, switches, celdas
    card: 'rounded-3xl',        // 24px - Tarjetas principales, modales, paneles
    full: 'rounded-full',       // 9999px - Avatares, switches circulares
  },

  // 3. ESCALA DE SOMBRAS PROFESIONALES (ELEVATION)
  shadows: {
    subtle: 'shadow-2xs',
    xs: 'shadow-xs',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
  },

  // 4. TRANSICIONES Y FEEDBACK TÁCTIL (MICRO-INTERACTIONS)
  transitions: {
    tactileButton: 'transition-all duration-200 active:scale-95 cursor-pointer',
    tactileCard: 'transition-all duration-200 active:scale-[0.99] cursor-pointer',
    hoverElevation: 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200',
  },
} as const;

export type Quarks = typeof quarks;
