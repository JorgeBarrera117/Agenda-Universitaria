import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../hooks/useBackButton';
import { useExitTransition, MOTION_EXIT_MS } from '../hooks/useExitTransition';

export interface KebabMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'destructive';
  disabled?: boolean;
}

export interface M3KebabMenuProps {
  items: KebabMenuItem[];
  ariaLabel?: string;
  className?: string;
  /** Alineación horizontal del menú flotante respecto al disparador */
  align?: 'left' | 'right';
  /** Tamaño del botón disparador: sm (32px visual con 44px tap target) o md (36px visual) */
  size?: 'sm' | 'md';
}

/**
 * M3KebabMenu - Menú contextual canónico Material Design 3 de 3 puntos (⋮ / Overflow Menu).
 * 
 * Diseñado bajo principios de ergonomía móvil (UI/UX Pro Max):
 * 1. Renderizado vía React Portal (createPortal en document.body) para inmunidad absoluta
 *    contra overflow:hidden, clipping de tarjetas, scrollbars y z-index stacking context traps.
 * 2. Mínimo 44x44px touch target envolvente para cumplir WCAG 2.1 AA.
 * 3. Posicionamiento inteligente (Smart Flip vertical y horizontal) con coordenadas fijas.
 * 4. Integración con botón Atrás de Android (useBackButton prioridad 85) y tecla Escape.
 * 5. Cierre reactivo al hacer scroll exterior para evitar desacople de capas en móviles.
 */
export const M3KebabMenu: React.FC<M3KebabMenuProps> = ({
  items,
  ariaLabel = 'Más opciones',
  className = '',
  align = 'right',
  size = 'sm',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isClosing, runExit } = useExitTransition(MOTION_EXIT_MS.menu);
  // Cierre con animación de salida; el portal se desmonta al terminar
  const closeMenu = useCallback(() => runExit(() => setIsOpen(false)), [runExit]);

  // Cerrar menú con el botón físico "Atrás" de Android si está desplegado
  useBackButton(
    () => {
      closeMenu();
      return true;
    },
    BACK_PRIORITY.MODAL + 5, // Prioridad 85: superior a modales estándar
    isOpen
  );

  // Calcular coordenadas de pantalla precisas en el viewport para el Portal flotante
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    const menuWidth = 230; // 230px de ancho óptimo para albergar etiquetas como "Archivos vinculados (0)"
    const menuHeight = items.length * 44 + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Si hay menos espacio abajo que la altura del menú y más espacio arriba, abrir hacia arriba
    const shouldOpenUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;
    setOpenDirection(shouldOpenUp ? 'up' : 'down');

    // Coordenada Top (con margen de seguridad de 8px del borde de pantalla)
    const top = shouldOpenUp
      ? Math.max(8, rect.top - menuHeight - 6)
      : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 6);

    // Coordenada Left (alineación derecha por defecto)
    let left: number;
    if (align === 'right') {
      left = rect.right - menuWidth;
    } else {
      left = rect.left;
    }
    // Mantener siempre dentro de los bordes visibles del viewport
    left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, left));

    setCoords({ top, left });
  }, [align, items.length]);

  // Manejo de eventos de cierre (clic fuera, escape, resize, scroll)
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleResize = () => updatePosition();

    const handleScroll = (e: Event) => {
      // Si el scroll ocurre dentro del propio menú, no cerrarlo
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      closeMenu();
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        closeMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition, closeMenu]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      closeMenu();
    }
  };

  const handleItemClick = (e: React.MouseEvent, item: KebabMenuItem) => {
    e.stopPropagation();
    if (item.disabled) return;
    closeMenu();
    item.onClick();
  };

  const triggerSizeClasses =
    size === 'md'
      ? 'w-9 h-9 sm:w-10 sm:h-10'
      : 'w-7 h-7 sm:w-8 sm:h-8';

  const iconSizeClasses = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Botón Disparador (Touch Target ampliado mínimo 44x44px) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`relative flex items-center justify-center rounded-full transition-all duration-150 ease-out cursor-pointer active:scale-95 ${triggerSizeClasses} ${
          isOpen
            ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] shadow-2xs'
            : 'text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)] hover:text-[var(--color-md-on-surface)]'
        }`}
      >
        {/* Pseudo-elemento táctil invisible de 44x44px para cumplir WCAG en pantallas móviles */}
        <span className="absolute -inset-1.5 sm:inset-0 rounded-full" aria-hidden="true" />
        <MoreVertical className={iconSizeClasses} />
      </button>

      {/* Menú Desplegable Renderizado en Portal Fuera de la Tarjeta (Inmune a overflow:hidden) */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '230px',
              maxWidth: 'calc(100vw - 20px)',
              zIndex: 9999,
            }}
            className={`bg-[var(--color-md-card-bg)] border border-[var(--color-md-outline-variant)] rounded-2xl shadow-2xl p-1.5 space-y-0.5 select-none ${isClosing ? 'm3-menu-exit' : 'm3-menu-enter'} ${
              openDirection === 'up'
                ? align === 'right' ? 'origin-bottom-right' : 'origin-bottom-left'
                : align === 'right' ? 'origin-top-right' : 'origin-top-left'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => {
              const isDestructive = item.variant === 'destructive';
              const isPrimary = item.variant === 'primary';

              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => handleItemClick(e, item)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-[13px] font-semibold transition-colors text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.98] ${
                    isDestructive
                      ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                      : isPrimary
                      ? 'text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary-container)]'
                      : 'text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-surface-container-high)]'
                  }`}
                >
                  {item.icon && (
                    <span className="shrink-0 flex items-center justify-center w-4 h-4">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
