import { useEffect, useRef } from 'react';
import type { TabType } from '../components/Navbar';

interface UseSwipeNavigationOptions {
  activeTab: TabType;
  tabOrder: readonly TabType[];
  onTabChange: (tab: TabType) => void;
  enabled: boolean;
}

/**
 * Hook de navegación táctil horizontal estilo WhatsApp (ViewPager2).
 * - Deslizar el dedo hacia la izquierda (←, dx < 0) avanza al siguiente apartado de la derecha.
 * - Deslizar el dedo hacia la derecha (→, dx > 0) regresa al apartado anterior de la izquierda.
 * - Tope elástico en los extremos (Horario al inicio y Archivos al final).
 * - Bloqueo direccional de eje (Axis Lock) para no interferir jamás con el scroll vertical
 *   ni con contenedores internos con scroll horizontal activo (ej. tabla semanal o chips).
 */
export function useSwipeNavigation({
  activeTab,
  tabOrder,
  onTabChange,
  enabled,
}: UseSwipeNavigationOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isTracking = false;
    let axisLock: 'horizontal' | 'vertical' | null = null;

    const resetTransform = (animate: boolean) => {
      if (!el) return;
      if (animate) {
        el.style.transition = 'transform 220ms cubic-bezier(0.2, 0, 0, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
        const cleanup = () => {
          if (el) {
            el.style.transition = '';
            el.style.transform = '';
          }
        };
        setTimeout(cleanup, 230);
      } else {
        el.style.transition = '';
        el.style.transform = '';
      }
    };

    const shouldIgnoreTouchStart = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;

      // 1. Ignorar si hay algún modal, diálogo o lightbox abierto en el DOM
      if (document.querySelector('[role="dialog"]')) return true;

      // 2. Ignorar controles interactivos de entrada o el botón flotante reubicable (FAB)
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], [data-draggable-fab="true"], [data-no-swipe="true"]'
        )
      ) {
        return true;
      }

      // 3. Ignorar si el toque inicia dentro de un contenedor con scroll horizontal real activo
      let node: HTMLElement | null = target;
      while (node && node !== el && node !== document.body) {
        const style = window.getComputedStyle(node);
        const overflowX = style.overflowX;
        if (
          (overflowX === 'auto' || overflowX === 'scroll') &&
          node.scrollWidth > node.clientWidth + 6
        ) {
          return true;
        }
        node = node.parentElement;
      }

      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        isTracking = false;
        resetTransform(false);
        return;
      }

      if (shouldIgnoreTouchStart(e.target)) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();
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

      // Bloqueo de eje tras superar el umbral de intención táctil (10px)
      if (axisLock === null) {
        if (absX < 10 && absY < 10) return;

        // Si el movimiento tiene componente vertical predominante, liberar al scroll vertical nativo
        if (absY > absX * 0.8) {
          axisLock = 'vertical';
          isTracking = false;
          resetTransform(false);
          return;
        }

        // Si el movimiento es claramente horizontal (ángulo < ~33°), bloquear eje horizontal
        if (absX > absY * 1.35) {
          axisLock = 'horizontal';
        } else {
          return;
        }
      }

      if (axisLock === 'horizontal') {
        const currentIndex = tabOrder.indexOf(activeTab);
        const isAtFirstTabAndPullingPrev = currentIndex === 0 && dx > 0;
        const isAtLastTabAndPullingNext = currentIndex === tabOrder.length - 1 && dx < 0;

        // Feedback visual táctil en vivo: resistencia elástica en los topes extremos,
        // o acompañamiento suave cuando existe una pestaña adyacente disponible
        const resistance = isAtFirstTabAndPullingPrev || isAtLastTabAndPullingNext ? 0.12 : 0.32;
        const maxOffset = isAtFirstTabAndPullingPrev || isAtLastTabAndPullingNext ? 22 : 68;
        const rawOffset = dx * resistance;
        const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, rawOffset));

        el.style.transition = 'none';
        el.style.transform = `translate3d(${clampedOffset.toFixed(1)}px, 0, 0)`;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTracking) return;
      isTracking = false;

      if (axisLock !== 'horizontal' || e.changedTouches.length === 0) {
        resetTransform(true);
        return;
      }

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const dt = Math.max(1, performance.now() - startTime);
      const velocity = absX / dt; // px/ms

      // Condición de disparo estilo WhatsApp: distancia >= 54px o flick rápido (>= 32px con velocidad >= 0.35 px/ms)
      const isIntentionalHorizontalSwipe =
        absX > absY * 1.35 && (absX >= 54 || (absX >= 32 && velocity >= 0.35));

      if (!isIntentionalHorizontalSwipe) {
        resetTransform(true);
        return;
      }

      const currentIndex = tabOrder.indexOf(activeTab);

      // Gesto Carrusel Natural (WhatsApp):
      // dx < 0 (dedo hacia la izquierda ←) => avanza a la pestaña de la derecha (currentIndex + 1)
      // dx > 0 (dedo hacia la derecha →) => regresa a la pestaña de la izquierda (currentIndex - 1)
      if (dx < 0 && currentIndex < tabOrder.length - 1) {
        resetTransform(false);
        onTabChange(tabOrder[currentIndex + 1]);
      } else if (dx > 0 && currentIndex > 0) {
        resetTransform(false);
        onTabChange(tabOrder[currentIndex - 1]);
      } else {
        // En los extremos (Horario o Archivos): rebote suave al tope
        resetTransform(true);
      }
    };

    const handleTouchCancel = () => {
      if (!isTracking) return;
      isTracking = false;
      axisLock = null;
      resetTransform(true);
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
      resetTransform(false);
    };
  }, [activeTab, tabOrder, onTabChange, enabled]);

  return containerRef;
}
