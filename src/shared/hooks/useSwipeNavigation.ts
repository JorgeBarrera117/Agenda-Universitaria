import { useEffect, useRef } from 'react';
import type { TabType } from '../components/Navbar';

interface UseSwipeNavigationOptions {
  activeTab: TabType;
  tabOrder: readonly TabType[];
  onTabChange: (tab: TabType) => void;
  enabled: boolean;
}

/**
 * Motor ligero de navegación táctil horizontal estilo WhatsApp (ViewPager2).
 *
 * Optimizaciones de Rendimiento (Anti-Jank / 60-120fps):
 * 1. Listeners estáticos (Zero Re-bind): Los listeners de touch se registran UNA SOLA VEZ
 *    al montar el contenedor usando referencias mutables (`stateRef`), evitando destruir
 *    y recrear eventos en medio de un gesto cuando React re-renderiza.
 * 2. Cero mutaciones de DOM en `touchmove`: No altera `style.transform` en cada frame de
 *    muestreo táctil (evita GPU layer thrashing y saltos bruscos al soltar el dedo).
 * 3. Delegación inteligente de Scroll Horizontal (`canScrollHorizontally`): Si el usuario
 *    desliza sobre una fila de chips o tabla horizontal, solo cede el gesto si ese contenedor
 *    realmente puede seguir desplazándose en esa dirección; si ya llegó a su tope, permite
 *    cambiar de apartado sin bloquearse.
 */
export function useSwipeNavigation({
  activeTab,
  tabOrder,
  onTabChange,
  enabled,
}: UseSwipeNavigationOptions) {
  const containerRef = useRef<HTMLElement | null>(null);

  // Referencia sincronizada para leer siempre el estado más reciente sin re-registrar listeners
  const stateRef = useRef({
    activeTab,
    tabOrder,
    onTabChange,
    enabled,
  });

  useEffect(() => {
    stateRef.current = {
      activeTab,
      tabOrder,
      onTabChange,
      enabled,
    };
  }, [activeTab, tabOrder, onTabChange, enabled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let startTarget: EventTarget | null = null;
    let isTracking = false;
    let axisLock: 'horizontal' | 'vertical' | null = null;

    /**
     * Verifica si el elemento tocado es un control de entrada, modal o FAB.
     */
    const isInteractiveExclusion = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;

      if (document.querySelector('[role="dialog"]')) return true;

      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], [data-draggable-fab="true"], [data-no-swipe="true"]'
        )
      ) {
        return true;
      }

      return false;
    };

    /**
     * Comprueba si algún contenedor ancestro tiene scroll horizontal activo Y todavía
     * tiene recorrido disponible en la dirección del gesto (`dx`).
     * - Si `dx < 0` (dedo hacia la izquierda ←, contenido se mueve a la derecha):
     *   verifica si `scrollLeft + clientWidth < scrollWidth - 4`.
     * - Si `dx > 0` (dedo hacia la derecha →, contenido se mueve a la izquierda):
     *   verifica si `scrollLeft > 4`.
     */
    const canAncestorScrollHorizontally = (
      target: EventTarget | null,
      dx: number
    ): boolean => {
      if (!(target instanceof HTMLElement)) return false;

      let node: HTMLElement | null = target;
      while (node && node !== el && node !== document.body) {
        if (node.scrollWidth > node.clientWidth + 8) {
          const overflowX = window.getComputedStyle(node).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll') {
            if (dx < 0 && node.scrollLeft + node.clientWidth < node.scrollWidth - 4) {
              return true;
            }
            if (dx > 0 && node.scrollLeft > 4) {
              return true;
            }
          }
        }
        node = node.parentElement;
      }

      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!stateRef.current.enabled || e.touches.length !== 1) {
        isTracking = false;
        return;
      }

      if (isInteractiveExclusion(e.target)) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();
      startTarget = e.target;
      isTracking = true;
      axisLock = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTracking || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (axisLock === null) {
        if (absX < 10 && absY < 10) return;

        // Prioridad al scroll vertical para que subir/bajar sea 100% libre
        if (absY >= absX * 0.85) {
          axisLock = 'vertical';
          isTracking = false;
          return;
        }

        if (absX > absY * 1.25) {
          // Verificar solo una vez al bloquear el eje si hay un sub-contenedor desplazable en esa dirección
          if (canAncestorScrollHorizontally(startTarget, dx)) {
            axisLock = 'vertical';
            isTracking = false;
            return;
          }
          axisLock = 'horizontal';
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTracking) return;
      isTracking = false;

      if (axisLock !== 'horizontal' || e.changedTouches.length === 0) {
        return;
      }

      const { activeTab: currentTab, tabOrder: order, onTabChange: changeTab, enabled: isEnabled } =
        stateRef.current;
      if (!isEnabled) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const dt = Math.max(1, performance.now() - startTime);
      const velocity = absX / dt; // px/ms

      // Umbral ergonómico: deslizamiento >= 48px o flick ágil (>= 28px con velocidad >= 0.30 px/ms)
      const isValidSwipe =
        absX > absY * 1.25 && (absX >= 48 || (absX >= 28 && velocity >= 0.3));

      if (!isValidSwipe) return;

      const currentIndex = order.indexOf(currentTab);
      if (currentIndex === -1) return;

      // Estilo WhatsApp (Carrusel natural con tope en los extremos):
      // dx < 0 (dedo hacia la izquierda ←) => siguiente pestaña (derecha)
      // dx > 0 (dedo hacia la derecha →) => pestaña anterior (izquierda)
      if (dx < 0 && currentIndex < order.length - 1) {
        changeTab(order[currentIndex + 1]);
      } else if (dx > 0 && currentIndex > 0) {
        changeTab(order[currentIndex - 1]);
      }
    };

    const handleTouchCancel = () => {
      isTracking = false;
      axisLock = null;
      startTarget = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, []);

  return containerRef;
}
