import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Nombre accesible si el placeholder no basta (por defecto, el propio placeholder). */
  ariaLabel?: string;
  className?: string;
}

/**
 * Barra de búsqueda M3 (pastilla de 44px) común a Profesores, Apuntes y Archivos: misma altura,
 * colores del tema, foco visible y botón para limpiar. Solo usa tokens, así sigue a la paleta
 * elegida y al modo oscuro.
 */
export const SearchField: React.FC<SearchFieldProps> = ({ value, onChange, placeholder, ariaLabel, className = '' }) => (
  <div
    role="search"
    className={`flex h-11 min-w-0 items-center gap-2.5 rounded-full border border-transparent bg-[var(--color-md-surface-container-high)] pl-4 pr-1.5 shadow-2xs transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--color-md-primary)] focus-within:ring-2 focus-within:ring-[var(--color-md-primary)]/20 ${className}`}
  >
    <Search className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
    <input
      type="text"
      inputMode="search"
      enterKeyHint="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--color-md-on-surface)] placeholder:text-[var(--color-md-on-surface-variant)] placeholder:font-normal outline-none"
    />
    {value ? (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Limpiar búsqueda"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-on-surface)]/10 hover:text-[var(--color-md-on-surface)]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    ) : (
      // Reserva el hueco del botón para que el texto no salte al escribir
      <span className="h-8 w-1 shrink-0" aria-hidden="true" />
    )}
  </div>
);
