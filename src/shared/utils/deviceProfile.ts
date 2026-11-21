import type { AppSettings } from '../../features/settings/types';

interface NavigatorWithMemory extends Navigator {
  /** GB de RAM aproximados (0.25, 0.5, 1, 2, 4, 8…), redondeados hacia abajo. Solo Chromium. */
  deviceMemory?: number;
}

/**
 * ¿Es un equipo modesto? Se usa la memoria que informa el navegador: 3 GB se informan como 2,
 * así que "2 o menos" agrupa los teléfonos de 3 GB o menos (gama de entrada, Helio y similares).
 * Si el navegador no lo informa (Firefox, Safari), se asume que no.
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const memory = (navigator as NavigatorWithMemory).deviceMemory;
  return typeof memory === 'number' && memory > 0 && memory <= 2;
}

/**
 * Modo Ultra Fluidez efectivo: el que eligió el estudiante o, si nunca lo tocó, activado de
 * fábrica en los equipos modestos.
 */
export function isPerformanceModeOn(settings: Pick<AppSettings, 'performanceMode' | 'performanceModeChosen'>): boolean {
  if (settings.performanceModeChosen) return settings.performanceMode;
  return settings.performanceMode || isLowEndDevice();
}

/** ¿Está activo solo porque el equipo es modesto (no porque el estudiante lo eligiera)? */
export function isPerformanceModeAuto(settings: Pick<AppSettings, 'performanceMode' | 'performanceModeChosen'>): boolean {
  return !settings.performanceModeChosen && !settings.performanceMode && isLowEndDevice();
}
