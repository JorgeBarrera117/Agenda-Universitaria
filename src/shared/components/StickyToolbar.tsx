import React, { useRef } from 'react';
import { useIsStuck } from '../hooks/useIsStuck';

interface StickyToolbarProps {
  children: React.ReactNode;
  className?: string;
}

/** Línea donde se pega: el borde inferior del Navbar (se mide en cada comprobación). */
const navbarBottom = () => document.querySelector('header')?.getBoundingClientRect().bottom ?? 56;

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
  const isStuck = useIsStuck(ref, navbarBottom);

  return (
    <div
      ref={ref}
      data-stuck={isStuck || undefined}
      className={`sticky top-14 sm:top-16 lg:top-[76px] xl:top-20 landscape:max-lg:top-14 z-30 -mx-4 px-4 py-2 border-b transition-[background-color,border-color,box-shadow] duration-200 ${
        isStuck
          ? // Mismo fondo y borde que el Navbar: se lee como una sola barra superior
            'bg-[var(--color-md-surface-container)]/95 backdrop-blur-md border-[var(--color-md-outline-variant)]/35 shadow-xs'
          : 'bg-transparent border-transparent'
      } ${className}`}
    >
      {children}
    </div>
  );
};
