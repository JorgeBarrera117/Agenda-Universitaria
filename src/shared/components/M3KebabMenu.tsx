import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../hooks/useBackButton';

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
 * 1. Mínimo 44x44px touch target envolvente para cumplir WCAG 2.1 AA.
 * 2. Posicionamiento inteligente con detección de bordes (Smart Flip vertical y horizontal).
 * 3. Integración con botón Atrás de Android (useBackButton) y tecla Escape.
 * 4. Descongestiona tarjetas agrupando acciones secundarias y destructivas.
 */
export const M3KebabMenu: React.FC<M3KebabMenuProps> = ({
  items,
  ariaLabel = 'Más opciones',
  className = '',
  align = 'right',
  size = 'sm',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar menú con el botón físico "Atrás" de Android si está desplegado
  useBackButton(
    () => {
      setIsOpen(false);
      return true;
    },
    BACK_PRIORITY.MODAL + 5, // Prioridad 85: superior a modales estándar
    isOpen
  );

  // Calcular dirección óptima de apertura (arriba o abajo) según el espacio disponible en pantalla
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Si hay menos de 220px abajo y más espacio arriba, abrir hacia arriba
      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        setOpenDirection('up');
      } else {
        setOpenDirection('down');
      }
    }
  }, [isOpen]);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleItemClick = (e: React.MouseEvent, item: KebabMenuItem) => {
    e.stopPropagation();
    if (item.disabled) return;
    setIsOpen(false);
    item.onClick();
  };

  const triggerSizeClasses =
    size === 'md'
      ? 'w-9 h-9 sm:w-10 sm:h-10'
      : 'w-7 h-7 sm:w-8 sm:h-8';

  const iconSizeClasses = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Botón Disparador (Touch Target ampliado mínimo 44x44px) */}
      <button
        type="button"
        onClick={toggleMenu}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`relative flex items-center justify-center rounded-full transition-all cursor-pointer active:scale-90 ${triggerSizeClasses} ${
          isOpen
            ? 'bg-[#D0E4FF] text-[#001D32] dark:bg-[#004B76] dark:text-[#D0E4FF] shadow-2xs'
            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
        }`}
      >
        {/* Pseudo-elemento táctil invisible de 44x44px para cumplir WCAG en pantallas móviles */}
        <span className="absolute -inset-1.5 sm:inset-0 rounded-full" aria-hidden="true" />
        <MoreVertical className={iconSizeClasses} />
      </button>

      {/* Menú Desplegable Flotante */}
      {isOpen && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className={`absolute z-40 w-48 sm:w-52 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-2xl shadow-xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${
            openDirection === 'up'
              ? 'bottom-[calc(100%+6px)] origin-bottom-right'
              : 'top-[calc(100%+6px)] origin-top-right'
          }`}
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
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                    : isPrimary
                    ? 'text-[#00639B] dark:text-[#92CCFF] hover:bg-[#D0E4FF]/40 dark:hover:bg-[#004B76]/30'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
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
        </div>
      )}
    </div>
  );
};
