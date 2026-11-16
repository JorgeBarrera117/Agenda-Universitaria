import React from 'react';

interface TransferTileProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

/** Botón grande (52 px o más) de las opciones de transferencia: ícono tonal, título y descripción. */
export const TransferTile: React.FC<TransferTileProps> = ({ icon, title, subtitle, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-transparent bg-[var(--color-md-primary-container)] px-3 py-2 text-left text-[var(--color-md-on-primary-container)] transition-all duration-150 ease-out hover:brightness-[0.97] active:scale-[0.98]"
  >
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]"
    >
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block truncate text-xs font-bold">{title}</span>
      <span className="block truncate text-11px opacity-80">{subtitle}</span>
    </span>
  </button>
);
