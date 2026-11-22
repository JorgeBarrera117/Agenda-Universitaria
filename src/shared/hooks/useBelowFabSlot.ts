import { useEffect, useState } from 'react';
import {
  FAB_BUTTON_SIZE,
  FAB_DOCK_EVENT,
  fabDockedPosition,
  readFabDock,
  setFabBottomReserve,
  type DockPosition,
} from '../components/fabLayout';

const GAP_BELOW_FAB = 12;
const PHONE_QUERY = '(max-width: 767px)';

export interface BelowFabSlot {
  /** Borde superior del espacio libre bajo el botón de agregar (px desde arriba). */
  top: number;
  /** El botón de agregar está a la derecha (lo que va debajo se alinea a ese lado). */
  onRight: boolean;
}

/**
 * Espacio para botones flotantes justo debajo del botón de agregar, del mismo lado (solo en el
 * teléfono). Reserva `height` px para que el botón de agregar no baje encima y sigue su posición
 * si el estudiante lo arrastra. Devuelve null en tableta y PC.
 */
export function useBelowFabSlot(height: number): BelowFabSlot | null {
  const reserve = height + GAP_BELOW_FAB;
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches);
  const [dock, setDock] = useState<DockPosition>(readFabDock);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));

  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const onMedia = () => setIsPhone(media.matches);
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const onDock = (event: Event) => setDock((event as CustomEvent<DockPosition>).detail ?? readFabDock());
    media.addEventListener('change', onMedia);
    window.addEventListener('resize', onResize);
    window.addEventListener(FAB_DOCK_EVENT, onDock);
    return () => {
      media.removeEventListener('change', onMedia);
      window.removeEventListener('resize', onResize);
      window.removeEventListener(FAB_DOCK_EVENT, onDock);
    };
  }, []);

  // El botón de agregar deja este espacio libre debajo mientras lo flotante se muestra
  useEffect(() => {
    if (!isPhone) return;
    setFabBottomReserve(reserve);
    return () => setFabBottomReserve(0);
  }, [isPhone, reserve]);

  if (!isPhone) return null;
  const fab = fabDockedPosition(dock, viewport.width, viewport.height, reserve);
  return { top: fab.y + FAB_BUTTON_SIZE + GAP_BELOW_FAB, onRight: dock.side === 'right' };
}
