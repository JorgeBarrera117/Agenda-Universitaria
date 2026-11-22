import React from 'react';
import { createPortal } from 'react-dom';
import { M3KebabMenu, type KebabMenuItem } from './M3KebabMenu';
import { useBelowFabSlot } from '../hooks/useBelowFabSlot';
import { FLOATING_BUTTON_SHADOW } from './floatingStyles';

interface FloatingMenuButtonProps {
  label: string;
  ariaLabel: string;
  icon: React.ReactNode;
  /** Color propio del área. */
  color: string;
  items: KebabMenuItem[];
}

/**
 * Botón flotante con menú, justo debajo del botón de agregar (solo en el teléfono): por ejemplo
 * «Compartir» del Horario, con compartir, importar y pasar datos. En tableta y PC no se muestra.
 */
export const FloatingMenuButton: React.FC<FloatingMenuButtonProps> = ({ label, ariaLabel, icon, color, items }) => {
  const slot = useBelowFabSlot(48);
  if (!slot) return null;

  return createPortal(
    <div className={`fixed z-40 ${slot.onRight ? 'right-4' : 'left-4'}`} style={{ top: slot.top }}>
      <M3KebabMenu
        ariaLabel={ariaLabel}
        label={label}
        icon={icon}
        align={slot.onRight ? 'right' : 'left'}
        items={items}
        triggerClassName={`h-12 rounded-2xl px-4 text-sm font-bold text-white ${FLOATING_BUTTON_SHADOW} hover:brightness-110`}
        triggerStyle={{ backgroundColor: color }}
      />
    </div>,
    document.body
  );
};
