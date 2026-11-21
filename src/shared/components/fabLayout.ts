import { useSyncExternalStore } from 'react';

/**
 * Posición del botón flotante de agregar (DraggableFAB) compartida con lo que flota a su lado:
 * el selector Materias | Profesores y Apuntes | Archivos del teléfono va justo debajo y lo sigue
 * si el estudiante lo arrastra a la izquierda o más arriba.
 */

export interface DockPosition {
  side: 'left' | 'right';
  /** 0 a 1 respecto al alto de la ventana. */
  yRatio: number;
}

export const FAB_STORAGE_KEY = 'agenda_fab_dock_v1';
export const FAB_DOCK_EVENT = 'agenda_fab_dock_updated';
export const FAB_BUTTON_SIZE = 56;
export const FAB_EDGE_OFFSET = 16;
/** Debajo de la barra superior. */
export const FAB_SAFE_TOP = 72;
/** Margen inferior en el teléfono: sobre la barra de navegación. */
const PHONE_BOTTOM_MARGIN = 144;

export const DEFAULT_FAB_DOCK: DockPosition = { side: 'right', yRatio: 0.78 };

export function readFabDock(): DockPosition {
  try {
    const stored = localStorage.getItem(FAB_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        ((parsed as DockPosition).side === 'left' || (parsed as DockPosition).side === 'right') &&
        typeof (parsed as DockPosition).yRatio === 'number'
      ) {
        return parsed as DockPosition;
      }
    }
  } catch {
    // Sin almacenamiento: posición por defecto
  }
  return DEFAULT_FAB_DOCK;
}

/* Espacio reservado bajo el botón (lo que flota debajo); el botón no baja de ahí. */
let bottomReserve = 0;
const reserveListeners = new Set<() => void>();

export function setFabBottomReserve(px: number): void {
  if (px === bottomReserve) return;
  bottomReserve = px;
  reserveListeners.forEach((listener) => listener());
}

export function useFabBottomReserve(): number {
  return useSyncExternalStore(
    (listener) => {
      reserveListeners.add(listener);
      return () => reserveListeners.delete(listener);
    },
    () => bottomReserve
  );
}

/** Borde inferior más bajo para el botón (y en px desde arriba). */
export function fabSafeBottom(vh: number, vw: number, reserve: number): number {
  const bottomMargin = vw >= 768 ? FAB_BUTTON_SIZE + 24 : PHONE_BOTTOM_MARGIN + reserve;
  return Math.max(FAB_SAFE_TOP + FAB_BUTTON_SIZE, vh - bottomMargin);
}

/** Posición en reposo del botón (esquina superior izquierda, en px). */
export function fabDockedPosition(dock: DockPosition, vw: number, vh: number, reserve: number): { x: number; y: number } {
  const x = dock.side === 'left' ? FAB_EDGE_OFFSET : Math.max(FAB_EDGE_OFFSET, vw - FAB_BUTTON_SIZE - FAB_EDGE_OFFSET);
  const y = Math.min(Math.max(dock.yRatio * vh, FAB_SAFE_TOP), fabSafeBottom(vh, vw, reserve));
  return { x, y };
}
