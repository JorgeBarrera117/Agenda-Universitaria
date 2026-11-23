import { useEffect } from 'react';

/** Desplazamiento mínimo (px) para decidir la dirección: evita parpadeos con el temblor del dedo. */
const DELTA = 8;
/** Tras dejar de desplazarse, los botones vuelven a aparecer. */
const IDLE_MS = 700;
/** Cerca del inicio de la página siempre se ven. */
const TOP_ZONE = 80;

/**
 * Oculta los botones flotantes (los que llevan la clase .fab-autohide) mientras se desplaza la
 * página hacia abajo (en el teléfono y en PC), para que no tapen las tarjetas de abajo; reaparecen al
 * volver hacia arriba o al detenerse. Solo marca un atributo en :root (data-fabs-hidden): el CSS
 * hace la transición, así no se vuelve a dibujar ningún componente en cada evento de scroll.
 */
export function useAutoHideFabs(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    let lastY = window.scrollY;
    let hidden = false;
    let frame = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const setHidden = (value: boolean) => {
      if (value === hidden) return;
      hidden = value;
      if (value) root.setAttribute('data-fabs-hidden', 'true');
      else root.removeAttribute('data-fabs-hidden');
    };

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < DELTA) return;
      lastY = y;
      setHidden(delta > 0 && y > TOP_ZONE);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        lastY = window.scrollY;
        setHidden(false);
      }, IDLE_MS);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      if (idleTimer) clearTimeout(idleTimer);
      root.removeAttribute('data-fabs-hidden');
    };
  }, [active]);
}
