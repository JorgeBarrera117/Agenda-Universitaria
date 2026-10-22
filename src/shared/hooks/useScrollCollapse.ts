import { useState, useEffect } from 'react';

/**
 * Hook reactivo ligero (passive scroll listener) que detecta cuando el usuario
 * hace scroll vertical superando el umbral especificado.
 * Permite contraer los botones primarios extendidos del encabezado y activar
 * el botón flotante compacto (FAB) que sigue al usuario durante el desplazamiento.
 */
export function useScrollCollapse(threshold = 48): boolean {
  const [isScrolled, setIsScrolled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (window.scrollY || document.documentElement.scrollTop || 0) > threshold;
  });

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY || document.documentElement.scrollTop || 0;
          setIsScrolled(currentY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  return isScrolled;
}
