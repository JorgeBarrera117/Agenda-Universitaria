import React from 'react';
import { Sparkles, TrendingUp, Wrench } from 'lucide-react';
import { CHANGE_KIND_LABELS, type ChangeKind, type ChangelogEntry } from '../constants/changelog';

const KIND_STYLES: Record<ChangeKind, { icon: React.ReactNode; className: string }> = {
  nuevo: {
    icon: <Sparkles className="h-3 w-3" aria-hidden="true" />,
    className: 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]',
  },
  mejora: {
    icon: <TrendingUp className="h-3 w-3" aria-hidden="true" />,
    className: 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]',
  },
  correccion: {
    icon: <Wrench className="h-3 w-3" aria-hidden="true" />,
    className: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
};

const formatDate = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

interface ChangelogEntryCardProps {
  entry: ChangelogEntry;
  /** Marca la versión instalada. */
  isCurrent?: boolean;
  /** Sin borde ni fondo propios (dentro de un modal o de otra tarjeta). */
  plain?: boolean;
}

/** Una versión del historial: número, fecha, tema y cada cambio con su tipo (Nuevo, Mejora, Corrección). */
export const ChangelogEntryCard: React.FC<ChangelogEntryCardProps> = ({ entry, isCurrent = false, plain = false }) => (
  <article
    aria-label={`Versión ${entry.version}`}
    className={
      plain
        ? 'space-y-2'
        : `md-card space-y-2 rounded-3xl border bg-[var(--md-card-surface)] p-4 shadow-xs ${
            isCurrent ? 'border-[var(--color-md-primary)]' : 'border-[var(--color-md-outline-variant)]'
          }`
    }
  >
    <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h3 className="text-sm font-black text-[var(--color-md-on-surface)]">v{entry.version}</h3>
      {isCurrent && (
        <span className="rounded-full bg-[var(--color-md-primary)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-md-on-primary)]">
          Tu versión
        </span>
      )}
      <span className="text-[11px] text-[var(--color-md-on-surface-variant)]">{formatDate(entry.date)}</span>
    </header>
    <p className="text-xs font-bold text-[var(--color-md-on-surface)]">{entry.title}</p>
    <ul className="space-y-1.5">
      {entry.changes.map((change, index) => (
        <li key={index} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-md-on-surface)]">
          <span
            className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${KIND_STYLES[change.kind].className}`}
          >
            {KIND_STYLES[change.kind].icon}
            {CHANGE_KIND_LABELS[change.kind]}
          </span>
          <span className="min-w-0">{change.text}</span>
        </li>
      ))}
    </ul>
  </article>
);
