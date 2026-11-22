import React, { useState } from 'react';
import { Palette } from 'lucide-react';
import { Modal, ModalActions } from '../Modal';
import { IdentityPicker, type IdentityIconOption } from './IdentityPicker';

interface AppearancePickerProps {
  /** Avatar o insignia actual: es el botón que abre la hoja. */
  children: React.ReactNode;
  /** Nombre que se muestra junto a la vista previa dentro de la hoja. */
  name: string;
  /** Vista previa grande dentro de la hoja (se actualiza al elegir). */
  preview: React.ReactNode;
  colors: string[];
  color: string;
  onColorChange: (color: string) => void;
  icons: IdentityIconOption[];
  icon: string;
  onIconChange: (iconId: string) => void;
}

/**
 * El avatar de la vista previa del formulario es un botón: al tocarlo se abre una hoja con los
 * colores y los íconos. Así el formulario queda corto y la apariencia se cambia donde se ve.
 * Un pincel sobre el avatar avisa que se puede tocar.
 */
export const AppearancePicker: React.FC<AppearancePickerProps> = ({
  children,
  name,
  preview,
  colors,
  color,
  onColorChange,
  icons,
  icon,
  onIconChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-label="Cambiar color e ícono"
        title="Cambiar color e ícono"
        className="relative shrink-0 rounded-2xl transition-transform duration-150 hover:scale-[1.03] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-md-primary)]"
      >
        {children}
        <span
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--md-card-surface)] bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-xs"
          aria-hidden="true"
        >
          <Palette className="h-3.5 w-3.5" />
        </span>
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Color e ícono" maxWidth="md">
        <div className="mb-4 flex items-center gap-3">
          {preview}
          <p className="min-w-0 flex-1 truncate text-base font-black text-[var(--color-md-on-surface)]">{name}</p>
        </div>
        <IdentityPicker
          colors={colors}
          color={color}
          onColorChange={onColorChange}
          icons={icons}
          icon={icon}
          onIconChange={onIconChange}
        />
        <ModalActions>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="h-10 rounded-full bg-[var(--color-md-primary)] px-6 text-sm font-bold text-[var(--color-md-on-primary)] transition-colors hover:bg-[var(--color-md-primary-hover)]"
          >
            Listo
          </button>
        </ModalActions>
      </Modal>
    </>
  );
};
