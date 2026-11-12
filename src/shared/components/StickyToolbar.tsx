import React, { useEffect, useRef, useState } from 'react';

interface StickyToolbarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Barra (búsqueda, orden…) que se queda fija justo debajo del Navbar al hacer scroll.
 *
 * - Desplazamientos = altura del Navbar en cada tamaño: h-14 (móvil y horizontal < lg), sm:h-16,
 *   lg:h-[76px], xl:h-20.
 * - En reposo es transparente para no dibujar un rectángulo sobre el papel tapiz; al quedar
 *   pegada se vuelve una franja de cristal esmerilado de borde a borde (como una extensión del
 *   Navbar) para que las tarjetas pasen por detrás difuminadas.
 * - El ancho de borde a borde sale de -mx-4/px-4: el <main> de App tiene 16px de margen lateral
 *   (max(1rem, safe-area)), así que la franja cubre ese margen sin cambiar el ancho del contenido.
 * - Requiere que ningún ancestro tenga overflow hidden/auto (por eso <main> usa overflow-x-clip).
 */
export const StickyToolbar: React.FC<StickyToolbarProps> = ({ children, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let headerBottom = 0;
    let frame = 0;
    const measureHeader = () => {
      headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 56;
    };
    // Pegada = su borde superior llegó al borde inferior del Navbar (1px de tolerancia por el borde)
    const check = () => {
      frame = 0;
      setIsStuck(element.getBoundingClientRect().top <= headerBottom + 1);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    const onResize = () => {
      measureHeader();
      onScroll();
    };

    measureHeader();
    onScroll(); // primera medición en el siguiente cuadro (la vista puede abrirse ya desplazada)
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-stuck={isStuck || undefined}
      className={`sticky top-14 sm:top-16 lg:top-[76px] xl:top-20 landscape:max-lg:top-14 z-30 -mx-4 px-4 py-2 border-b transition-[background-color,border-color,box-shadow] duration-200 ${
        isStuck
          ? 'bg-[var(--color-md-surface)]/90 backdrop-blur-md border-[var(--color-md-outline-variant)]/40 shadow-xs'
          : 'bg-transparent border-transparent'
      } ${className}`}
    >
      {children}
    </div>
  );
};
