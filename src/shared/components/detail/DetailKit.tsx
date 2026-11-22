import React, { useCallback } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { PageHeader } from '../PageHeader';
import { BACK_PRIORITY, useBackButton } from '../../hooks/useBackButton';
import { MOTION_EXIT_MS, useExitTransition } from '../../hooks/useExitTransition';

/**
 * Piezas comunes de las fichas (materia, catedrático, archivo, evento de la agenda) para que
 * todas se lean igual:
 * 1. Encabezado: volver · título · acción principal (Editar) y el resto en ⋮.
 * 2. Tarjeta de identidad con el color del elemento y, debajo, las acciones que más se usan en ese
 *    contexto como botones grandes (la principal rellena, las demás tonales).
 * 3. Secciones con título y filas de datos (ícono, etiqueta y valor; tocables cuando llevan a algo).
 */

/* -------------------------------------------------------------------------------------------- */

interface DetailScreenProps {
  title: string;
  subtitle?: React.ReactNode;
  backLabel: string;
  onBack: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Pantalla de ficha: animación de entrada y salida, botón atrás de Android y encabezado. */
export const DetailScreen: React.FC<DetailScreenProps> = ({ title, subtitle, backLabel, onBack, actions, children }) => {
  const { isClosing, runExit } = useExitTransition(MOTION_EXIT_MS.sheet);
  const exit = useCallback(() => runExit(onBack), [runExit, onBack]);
  useBackButton(() => {
    exit();
    return true;
  }, BACK_PRIORITY.SUBVIEW);

  return (
    <div className={`${isClosing ? 'm3-sheet-exit' : 'm3-sheet-enter'} mx-auto w-full max-w-3xl space-y-3 pb-10`}>
      <PageHeader title={title} subtitle={subtitle} onBack={exit} backLabel={backLabel} actions={actions} />
      {children}
    </div>
  );
};

/* -------------------------------------------------------------------------------------------- */

interface DetailIconTileProps {
  color: string;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}

/** Cuadro de ícono con el color del elemento (materia, tipo de archivo o evento). */
export const DetailIconTile: React.FC<DetailIconTileProps> = ({ color, children, size = 'lg' }) => (
  <div
    className={`flex shrink-0 items-center justify-center rounded-2xl text-white shadow-xs ring-1 ring-white/20 ${
      size === 'lg' ? 'h-16 w-16' : 'h-12 w-12'
    }`}
    style={{ backgroundColor: color }}
    aria-hidden="true"
  >
    {children}
  </div>
);

interface DetailHeroProps {
  /** Color del elemento: tiñe la tarjeta (variante tonal, como en las listas). */
  color?: string;
  /** Ícono o foto a la izquierda (DetailIconTile, avatar…). */
  leading: React.ReactNode;
  kicker?: React.ReactNode;
  title: React.ReactNode;
  titleId?: string;
  /** Tachado (tarea hecha). */
  strike?: boolean;
  /** Chips de datos: código, créditos, estado… */
  chips?: React.ReactNode;
  /** Acciones principales del contexto (DetailActions). */
  actions?: React.ReactNode;
  /** Más compacta, para la vista previa de los formularios. */
  compact?: boolean;
}

/** Tarjeta de identidad: quién es, sus datos clave y lo que más se hace con él. */
export const DetailHero: React.FC<DetailHeroProps> = ({ color, leading, kicker, title, titleId, strike, chips, actions, compact }) => (
  <section
    className={`md-card rounded-3xl border border-[var(--color-md-outline-variant)] ${compact ? 'p-3.5' : 'p-4 sm:p-5'} shadow-xs ${
      color ? 'card-tinted' : 'bg-[var(--md-card-surface)]'
    }`}
    style={color ? ({ '--card-tint': color } as React.CSSProperties) : undefined}
    aria-labelledby={titleId}
  >
    <div className="flex items-start gap-4">
      {leading}
      <div className="min-w-0 flex-1">
        {kicker && (
          <p className="truncate text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">{kicker}</p>
        )}
        <h2
          id={titleId}
          className={`break-words font-black leading-tight ${compact ? 'text-lg' : 'text-xl sm:text-2xl'} ${
            strike ? 'text-[var(--color-md-on-surface-variant)] line-through' : 'text-[var(--color-md-on-surface)]'
          } ${kicker ? 'mt-0.5' : ''}`}
        >
          {title}
        </h2>
        {chips && <div className="mt-2 flex flex-wrap items-center gap-1.5">{chips}</div>}
      </div>
    </div>
    {actions}
  </section>
);

interface DetailChipProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: 'neutral' | 'tonal' | 'mono';
  className?: string;
}

export const DetailChip: React.FC<DetailChipProps> = ({ icon, children, tone = 'neutral', className = '' }) => (
  <span
    className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg px-2 py-1 text-xs ${
      tone === 'tonal'
        ? 'bg-[var(--color-md-secondary-container)] font-semibold text-[var(--color-md-on-secondary-container)]'
        : tone === 'mono'
          ? 'bg-black/[0.06] font-mono font-bold text-[var(--color-md-on-surface-variant)] dark:bg-white/10'
          : 'bg-white/60 font-medium text-[var(--color-md-on-surface-variant)] dark:bg-black/20'
    } ${className}`}
  >
    {icon}
    <span className="truncate">{children}</span>
  </span>
);

/* -------------------------------------------------------------------------------------------- */

/** Fila de acciones principales debajo de la identidad: botones grandes que se reparten el ancho. */
export const DetailActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-4 flex flex-wrap gap-2">{children}</div>
);

interface DetailActionProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'tonal' | 'outlined';
  disabled?: boolean;
  busy?: boolean;
  ariaLabel?: string;
}

export const DetailAction: React.FC<DetailActionProps> = ({ icon, label, onClick, href, variant = 'tonal', disabled, busy, ariaLabel }) => {
  const className = `flex h-12 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition-[transform,filter] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${
    variant === 'primary'
      ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-xs hover:brightness-110'
      : variant === 'outlined'
        ? 'border border-[var(--color-md-outline)] text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/[0.08]'
        : 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] hover:brightness-95'
  }`;
  const content = (
    <>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      <span className="truncate">{label}</span>
    </>
  );
  return href ? (
    <a href={href} className={className} aria-label={ariaLabel}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled || busy} className={className} aria-label={ariaLabel}>
      {content}
    </button>
  );
};

/* -------------------------------------------------------------------------------------------- */

interface DetailSectionProps {
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

/** Sección de la ficha: título pequeño en mayúsculas con ícono y su contenido. */
export const DetailSection: React.FC<DetailSectionProps> = ({ icon, title, trailing, children }) => (
  <section className="md-card rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-4 shadow-xs sm:p-5">
    <div className="mb-1.5 flex min-h-9 items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
        <span className="text-[var(--color-md-primary)]" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h3>
      {trailing}
    </div>
    {children}
  </section>
);

/** Lista de filas separadas por una línea fina. */
export const DetailRows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="divide-y divide-[var(--color-md-outline-variant)]/60">{children}</div>
);

interface DetailRowProps {
  icon: React.ReactNode;
  /** En lugar del círculo con ícono (insignia de materia, avatar…). */
  leading?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
  href?: string;
  /** Acción propia a la derecha (copiar, cambiar…), en vez de la flecha. */
  trailing?: React.ReactNode;
  /** Respeta los saltos de línea del valor (notas, asesorías). */
  multiline?: boolean;
}

/** Fila de dato: ícono en círculo, etiqueta y valor; con flecha si lleva a algún lado. */
export const DetailRow: React.FC<DetailRowProps> = ({ icon, leading, label, value, onClick, href, trailing, multiline }) => {
  const interactive = Boolean(onClick || href);
  const body = (
    <>
      {leading ?? (
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-11px font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">{label}</span>
        <span className={`block break-words text-sm text-[var(--color-md-on-surface)] ${multiline ? 'whitespace-pre-line' : ''}`}>{value}</span>
      </span>
      {interactive && !trailing && <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />}
    </>
  );
  const rowClass = '-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2.5 text-left';
  if (href) {
    return (
      <a href={href} className={`${rowClass} transition-colors hover:bg-[var(--color-md-surface-container)]`}>
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${rowClass} transition-colors hover:bg-[var(--color-md-surface-container)]`}>
        {body}
      </button>
    );
  }
  return (
    <div className={rowClass}>
      {body}
      {trailing}
    </div>
  );
};
