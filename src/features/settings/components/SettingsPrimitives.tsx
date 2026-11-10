import React from 'react';
import { Check, ChevronRight } from 'lucide-react';

/** Superficie de una subvista de Ajustes: respeta el acabado de tarjetas (solid/glass/bordered). */
export const SettingsCard: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div
    className={`md-card space-y-4 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-4 text-[var(--color-md-on-surface)] shadow-2xs sm:rounded-3xl sm:p-5 ${className}`}
  >
    {children}
  </div>
);

/** Bloque con título en Sentence case y descripción opcional, separado por un divisor del anterior. */
export const SettingsBlock: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon, children }) => (
  <section className="space-y-2 border-t border-[var(--color-md-outline-variant)] pt-4 first:border-t-0 first:pt-0">
    <div>
      <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-md-on-surface)]">
        {icon && <span className="text-[var(--color-md-primary)]">{icon}</span>}
        {title}
      </h3>
      {description && <p className="mt-0.5 text-xs text-[var(--color-md-on-surface-variant)]">{description}</p>}
    </div>
    {children}
  </section>
);

/** Grupo del menú raíz: etiqueta de sección y lista continua de filas. */
export const SettingsGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-1.5" aria-label={title}>
    <h2 className="ml-1 inline-flex rounded-md border border-[var(--color-md-outline-variant)]/40 bg-[var(--color-md-surface-container-high)]/85 px-2.5 py-0.5 text-xs font-bold text-[var(--color-md-on-surface-variant)] backdrop-blur-sm">
      {title}
    </h2>
    <div className="md-card divide-y divide-[var(--color-md-outline-variant)] overflow-hidden rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] shadow-2xs sm:rounded-3xl">
      {children}
    </div>
  </section>
);

interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** Valor actual mostrado como píldora a la derecha. */
  value?: React.ReactNode;
  valueTone?: 'neutral' | 'active';
  onClick: () => void;
}

/** Fila navegable del menú raíz (ícono tonal · título y resumen · valor · chevron). */
export const SettingsRow: React.FC<SettingsRowProps> = ({ icon, title, subtitle, value, valueTone = 'neutral', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-[56px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-[var(--color-md-surface-container)] active:bg-[var(--color-md-surface-container-high)] sm:px-4"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-secondary-container)] text-[var(--color-md-primary)] transition-transform duration-150 ease-out group-hover:scale-105">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{title}</span>
      <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">{subtitle}</span>
    </span>
    {value !== undefined && (
      <span
        className={`max-w-[40%] shrink-0 truncate rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
          valueTone === 'active'
            ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
            : 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)]'
        }`}
      >
        {value}
      </span>
    )}
    <ChevronRight
      className="h-4 w-4 shrink-0 text-[var(--color-md-outline)] transition-transform duration-150 ease-out group-hover:translate-x-0.5"
      aria-hidden="true"
    />
  </button>
);

interface M3SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Interruptor M3 (role="switch"): pista primary con pulgar grande al activarse, contorno al desactivarse. */
export const M3Switch: React.FC<M3SwitchProps> = ({ checked, onChange, label, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 transition-colors duration-150 ease-out disabled:opacity-40 ${
      checked
        ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary)]'
        : 'border-[var(--color-md-outline)] bg-[var(--color-md-surface-container-high)]'
    }`}
  >
    <span
      aria-hidden="true"
      className={`absolute left-0 flex items-center justify-center rounded-full transition-all duration-150 ease-out ${
        checked
          ? 'h-6 w-6 translate-x-[22px] bg-[var(--color-md-on-primary)] text-[var(--color-md-primary)]'
          : 'h-4 w-4 translate-x-[6px] bg-[var(--color-md-outline)]'
      }`}
    >
      {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
    </span>
  </button>
);

interface ToggleChipProps {
  selected: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}

/** Chip de filtro M3: alterna una opción independiente y muestra un check al estar activo. */
export const ToggleChip: React.FC<ToggleChipProps> = ({ selected, onToggle, icon, label, disabled = false }) => (
  <button
    type="button"
    aria-pressed={selected}
    disabled={disabled}
    onClick={onToggle}
    className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${
      selected
        ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
        : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-outline)]'
    }`}
  >
    {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <span aria-hidden="true">{icon}</span>}
    {label}
  </button>
);
