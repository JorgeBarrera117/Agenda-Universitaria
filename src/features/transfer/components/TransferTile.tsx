import React from 'react';
import { ChevronRight } from 'lucide-react';

interface TransferTileProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

/**
 * Botón grande (52 px o más) de las opciones de transferencia: ícono tonal, título y descripción.
 * Borde definido, elevación sutil y chevron a la derecha para que se lea como botón y no como
 * un aviso; responde al toque con un leve encogimiento.
 */
export const TransferTile: React.FC<TransferTileProps> = ({ icon, title, subtitle, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-[var(--color-md-primary)]/35 bg-[var(--color-md-primary-container)] px-3 py-2 text-left text-[var(--color-md-on-primary-container)] shadow-2xs transition-[transform,box-shadow,border-color,filter] duration-150 ease-out hover:border-[var(--color-md-primary)]/70 hover:shadow-xs hover:brightness-[0.98] active:scale-[0.99]"
  >
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]"
    >
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-bold">{title}</span>
      <span className="block truncate text-11px opacity-80">{subtitle}</span>
    </span>
    <ChevronRight
      className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
      aria-hidden="true"
    />
  </button>
);
