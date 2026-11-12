import { useEffect, useState, type RefObject } from 'react';

/**
 * ¿El elemento sticky ya está pegado? Compara su borde superior con la línea donde se pega
 * (getStickLine, en px desde arriba de la ventana) con 1px de tolerancia.
 *
 * - Se recalcula con el scroll y el tamaño de ventana (agrupado en un requestAnimationFrame).
 * - Un elemento oculto (pestaña con display: none) mide 0×0 y top 0, lo que parecería
 *   "pegado": se trata como no pegado, y un ResizeObserver avisa cuando vuelve a mostrarse
 *   (no hay evento de scroll en ese momento).
 * - getStickLine debe ser estable (definida fuera del componente o con useCallback).
 */
export function useIsStuck(ref: RefObject<HTMLElement | null>, getStickLine: () => number): boolean {
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let frame = 0;
    const check = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setIsStuck(false);
        return;
      }
      setIsStuck(rect.top <= getStickLine() + 1);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(element);
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref, getStickLine]);

  return isStuck;
}
