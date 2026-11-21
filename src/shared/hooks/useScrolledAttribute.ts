import { useEffect } from 'react';

const THRESHOLD = 48;

/**
 * Marca en :root si la página ya se desplazó (data-scrolled="true" pasados 48 px).
 *
 * Antes, cada pestaña tenía su propio estado "desplazado" para encoger un botón de su cabecera.
 * Al cruzar el umbral se volvían a dibujar las cinco pestañas enteras, también las ocultas: en un
 * teléfono modesto eso daba un tirón al empezar a desplazarse. Ahora hay un solo escuchador que
 * cambia un atributo, y la variante CSS `scrolled:` hace el resto sin volver a dibujar nada.
 */
export function useScrolledAttribute(): void {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let current: boolean | null = null;

    const update = () => {
      frame = 0;
      const scrolled = (window.scrollY || root.scrollTop || 0) > THRESHOLD;
      if (scrolled === current) return;
      current = scrolled;
      root.setAttribute('data-scrolled', scrolled ? 'true' : 'false');
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
}
