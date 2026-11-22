import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { Modal } from './Modal';
import type { KebabMenuItem } from './M3KebabMenu';
import { useAboveFabSlot } from '../hooks/useBelowFabSlot';
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
  items: FloatingMenuItem[];
}

/** Mini-FAB de M3 (42 px): acción secundaria junto al botón de agregar de 56 px. */
const MINI_FAB_SIZE = 42;

/**
 * Mini-FAB secundario centrado encima del botón de agregar (solo en el teléfono). En reposo solo
 * el ícono; al tocarlo se extiende con su nombre y abre una hoja con las opciones grandes y
 * explicadas. Usa el tono Secondary Container de la paleta (no un color fijo), así queda por
 * debajo del botón principal en jerarquía y combina con cualquier tema, claro u oscuro. Se oculta
 * al desplazarse hacia abajo junto con el botón de agregar (.fab-autohide). En tableta y PC no se muestra.
 */
export const FloatingMenuButton: React.FC<FloatingMenuButtonProps> = ({ label, sheetTitle, icon, items }) => {
  const slot = useAboveFabSlot(MINI_FAB_SIZE);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    []
  );

  if (!slot) return null;

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
        <div
          className="fab-autohide fixed z-40"
          style={{ top: slot.top, [slot.onRight ? 'right' : 'left']: slot.edge }}
        >
          <button
            type="button"
            onClick={press}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            style={{ height: MINI_FAB_SIZE, minWidth: MINI_FAB_SIZE }}
            className={`flex items-center justify-center gap-2 rounded-xl border border-[var(--color-md-outline-variant)]/40 bg-[var(--color-md-secondary-container)] text-sm font-bold text-[var(--color-md-on-secondary-container)] ${FLOATING_BUTTON_SHADOW} transition-[padding,filter,transform] duration-200 ease-out hover:brightness-95 active:scale-95 [&>svg]:h-[18px] [&>svg]:w-[18px] ${
              isExpanded ? 'px-3.5' : ''
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
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => choose(item)}
                disabled={item.disabled}
                className="group flex min-h-16 w-full items-center gap-3.5 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] px-3 py-2.5 text-left transition-[background-color,border-color,transform] duration-150 ease-out hover:border-[var(--color-md-outline)] hover:bg-[var(--color-md-surface-container)] active:scale-[0.98] active:bg-[var(--color-md-surface-container-high)] disabled:opacity-40"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-current"
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
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)] transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
};
