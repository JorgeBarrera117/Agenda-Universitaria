/** Sombra de los botones flotantes bajo el botón de agregar: marcada para despegarlos de cualquier fondo. */
export const FLOATING_BUTTON_SHADOW = 'shadow-[0_6px_16px_rgba(0,0,0,0.32),0_2px_4px_rgba(0,0,0,0.24)]';

/**
 * Color propio de cada área para sus botones flotantes. No dependen del tema que elija el
 * estudiante, así cada área se reconoce siempre y el texto blanco se lee bien sobre ellos.
 */
export const AREA_COLOR = {
  subjects: '#5B4BC4',
  professors: '#00796B',
  notes: '#C2410C',
  documents: '#1565C0',
  schedule: '#AD1457',
} as const;
