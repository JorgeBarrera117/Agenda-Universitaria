import { useEffect, useState } from 'react';
import {
  FAB_BUTTON_SIZE,
  FAB_DOCK_EVENT,
  fabDockedPosition,
  fabViewportWidth,
  readFabDock,
  setFabBottomReserve,
  type DockPosition,
} from '../components/fabLayout';

const GAP_BELOW_FAB = 12;

export interface BelowFabSlot {
  /** Borde superior del espacio libre bajo el botón de agregar (px desde arriba). */
  top: number;
  /** El botón de agregar está a la derecha (lo que va debajo se alinea a ese lado). */
  onRight: boolean;
}

/**
 * Espacio para botones flotantes justo debajo del botón de agregar, del mismo lado. Reserva
 * `height` px para que el botón de agregar no baje encima y sigue su posición si el estudiante lo
 * arrastra. En el teléfono se ven siempre; en tableta y PC aparecen al bajar, igual que el botón de
 * agregar (cuando los controles de la cabecera ya no se ven).
 */
export function useBelowFabSlot(height: number): BelowFabSlot {
  const reserve = height + GAP_BELOW_FAB;
  const [dock, setDock] = useState<DockPosition>(readFabDock);
  const [viewport, setViewport] = useState(() => ({ width: fabViewportWidth(), height: window.innerHeight }));

  useEffect(() => {
    const onResize = () => setViewport({ width: fabViewportWidth(), height: window.innerHeight });
    const onDock = (event: Event) => setDock((event as CustomEvent<DockPosition>).detail ?? readFabDock());
    window.addEventListener('resize', onResize);
    window.addEventListener(FAB_DOCK_EVENT, onDock);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener(FAB_DOCK_EVENT, onDock);
    };
  }, []);

  // El botón de agregar deja este espacio libre debajo mientras lo flotante se muestra
  useEffect(() => {
    setFabBottomReserve(reserve);
    return () => setFabBottomReserve(0);
  }, [reserve]);

  const fab = fabDockedPosition(dock, viewport.width, viewport.height, reserve);
  return { top: fab.y + FAB_BUTTON_SIZE + GAP_BELOW_FAB, onRight: dock.side === 'right' };
}
