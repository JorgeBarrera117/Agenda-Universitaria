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
 *   pegada toma el mismo fondo y borde que el Navbar, así se ve como una extensión de la barra
 *   superior y las tarjetas pasan por detrás difuminadas.
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

    let frame = 0;
    const check = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      // Pestaña oculta (display: none): mide 0×0 y top 0, lo que parecería "pegada". Nunca lo está.
      if (rect.width === 0 && rect.height === 0) {
        setIsStuck(false);
        return;
      }
      const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 56;
      // Pegada = su borde superior llegó al borde inferior del Navbar (1px de tolerancia por el borde)
      setIsStuck(rect.top <= headerBottom + 1);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };

    // El scroll mueve la barra; el ResizeObserver avisa cuando la pestaña vuelve a mostrarse
    // (pasa de 0×0 a su tamaño real) o cambia el ancho, casos en los que no hay evento de scroll
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
  }, []);

  return (
    <div
      ref={ref}
      data-stuck={isStuck || undefined}
      className={`sticky top-14 sm:top-16 lg:top-[76px] xl:top-20 landscape:max-lg:top-14 z-30 -mx-4 px-4 py-2 border-b transition-[background-color,border-color,box-shadow] duration-200 ${
        isStuck
          ? // Mismo fondo y borde que el Navbar: se lee como una sola barra superior
            'bg-[#F1F4FA]/95 dark:bg-[#1D2024]/95 backdrop-blur-md border-[#C2C7CE]/35 dark:border-[#42474E]/35 shadow-xs'
          : 'bg-transparent border-transparent'
      } ${className}`}
    >
      {children}
    </div>
  );
};
