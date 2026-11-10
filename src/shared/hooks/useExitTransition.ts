import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Duraciones de salida en ms. Deben coincidir con las animaciones .m3-*-exit de index.css:
 * el desmontaje real ocurre justo cuando termina la animación.
 */
export const MOTION_EXIT_MS = {
  sheet: 180,
  menu: 120,
  dialog: 150,
} as const;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fase de salida animada: `runExit(done)` marca `isClosing` (para aplicar la clase de salida) y
 * ejecuta `done` cuando termina la animación. Llamadas repetidas durante la salida se ignoran, y
 * con "reducir movimiento" `done` se ejecuta al instante.
 */
export function useExitTransition(durationMs: number) {
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const runExit = useCallback(
    (done: () => void) => {
      if (timerRef.current) return;
      if (durationMs <= 0 || prefersReducedMotion()) {
        done();
        return;
      }
      setIsClosing(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setIsClosing(false);
        done();
      }, durationMs);
    },
    [durationMs]
  );

  return { isClosing, runExit };
}
