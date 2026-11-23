import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { Modal } from './Modal';
import type { KebabMenuItem } from './M3KebabMenu';
import { useBelowFabSlot } from '../hooks/useBelowFabSlot';
import { FLOATING_BUTTON_SHADOW } from './floatingStyles';

export interface FloatingMenuItem extends KebabMenuItem {
  /** Una línea que explica la opción (se ve en la hoja). */
  description?: string;
}

interface FloatingMenuButtonProps {
  label: string;
  /** Título de la hoja con las opciones. */
  sheetTitle: string;
  icon: React.ReactNode;
  /** Color propio del área. */
  color: string;
  items: FloatingMenuItem[];
}

/**
 * Botón flotante bajo el botón de agregar (solo en el teléfono), con la misma lógica que los de
 * sección: en reposo solo el ícono; al tocarlo se extiende con su nombre y abre una hoja con las
 * opciones grandes y explicadas (como la hoja de color e ícono). En tableta y PC no se muestra.
 */
export const FloatingMenuButton: React.FC<FloatingMenuButtonProps> = ({ label, sheetTitle, icon, color, items }) => {
  const slot = useBelowFabSlot(48);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    []
  );

  // Primero se extiende con su nombre (se alcanza a leer) y enseguida se abre la hoja
  const press = () => {
    if (isExpanded) return;
    setIsExpanded(true);
    openTimer.current = setTimeout(() => setIsOpen(true), 260);
  };

  const close = () => {
    setIsOpen(false);
    setIsExpanded(false);
  };

  const choose = (item: FloatingMenuItem) => {
    if (item.disabled) return;
    close();
    item.onClick();
  };

  return (
    <>
      {createPortal(
        // fab-autohide: se aparta al bajar por la lista junto con el botón de agregar (useAutoHideFabs)
        <div className={`fab-autohide transition-opacity duration-200 md:pointer-events-none md:opacity-0 scrolled:md:pointer-events-auto scrolled:md:opacity-100 fixed z-40 ${slot.onRight ? 'right-4' : 'left-4'}`} style={{ top: slot.top }}>
          <button
            type="button"
            onClick={press}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            style={{ backgroundColor: color }}
            className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white ${FLOATING_BUTTON_SHADOW} transition-[padding,filter] duration-200 ease-out hover:brightness-110 active:scale-95 [&>svg]:h-5 [&>svg]:w-5 ${
              isExpanded ? 'px-4' : 'w-12'
            }`}
          >
            {icon}
            {isExpanded && (
              <span className="whitespace-nowrap" aria-hidden="true">
                {label}
              </span>
            )}
          </button>
        </div>,
        document.body
      )}

      <Modal isOpen={isOpen} onClose={close} title={sheetTitle} maxWidth="md">
        <ul className="-mx-2 space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => choose(item)}
                disabled={item.disabled}
                className="flex min-h-16 w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-md-surface-container)] active:scale-[0.99] disabled:opacity-40"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-current"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">{item.label}</span>
                  {item.description && (
                    <span className="block text-xs text-[var(--color-md-on-surface-variant)]">{item.description}</span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
};
