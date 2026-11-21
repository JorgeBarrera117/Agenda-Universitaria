import React from 'react';

interface StickyToolbarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Barra (búsqueda, orden…) que se queda fija justo debajo del Navbar al hacer scroll.
 *
 * - Desplazamientos = altura del Navbar en cada tamaño: h-14 (móvil y horizontal < lg), sm:h-16,
 *   lg:h-[76px], xl:h-20.
 * - Sin fondo propio: solo flotan las cápsulas (búsqueda, orden), que ya son opacas. Al bajar
 *   (variante scrolled:, ver useScrolledAttribute) su sombra crece para separarlas de las tarjetas
 *   que pasan por detrás. Lo decide el CSS: no hay que medir la barra en cada cuadro de scroll.
 * - pointer-events-none en la franja y auto en su contenido: los huecos entre cápsulas dejan
 *   tocar las tarjetas que pasan por debajo.
 * - Requiere que ningún ancestro tenga overflow hidden/auto (por eso <main> usa overflow-x-clip).
 */
export const StickyToolbar: React.FC<StickyToolbarProps> = ({ children, className = '' }) => (
  <div
    className={`sticky top-14 sm:top-16 lg:top-[76px] xl:top-20 landscape:max-lg:top-14 z-30 py-2 pointer-events-none [&>*]:pointer-events-auto scrolled:[&_.shadow-2xs]:shadow-md ${className}`}
  >
    {children}
  </div>
);
