import React, { useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useIsStuck } from '../hooks/useIsStuck';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  onBack: () => void;
  backLabel: string;
  /** Acciones propias de la pantalla (Guardar, deshacer, compartir…), a la derecha. */
  actions?: React.ReactNode;
  /** h1 en pantallas principales (Ajustes); h2 en formularios y sub-páginas. */
  titleAs?: 'h1' | 'h2';
  /** Para anular el ancho de borde a borde (-mx-4/px-4) donde el contenedor no tiene margen. */
  className?: string;
  style?: React.CSSProperties;
}

/** Botón de icono para las acciones del encabezado (deshacer, compartir…), 36px como el de volver. */
export const PAGE_HEADER_ICON_BUTTON =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-colors duration-150 hover:bg-[var(--color-md-surface-container-high)] hover:text-[var(--color-md-on-surface)] active:scale-95 disabled:pointer-events-none disabled:opacity-40';

/** Acción principal del encabezado (Guardar). */
export const PAGE_HEADER_PRIMARY_BUTTON =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-md-primary)] px-4 text-xs font-bold text-[var(--color-md-on-primary)] shadow-xs transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-95 disabled:pointer-events-none disabled:opacity-50';

/** Estas pantallas ocultan el Navbar: el encabezado se pega al borde superior. */
const topEdge = () => 0;

/** Cápsula del encabezado (mismo estilo que HEADER_SCRIM_CLASS), con su fondo según el estado. */
const CAPSULE_CLASS =
  'flex items-center gap-2.5 rounded-2xl border border-[var(--color-md-outline-variant)]/30 p-3 backdrop-blur-md transition-[background-color,box-shadow] duration-200';

/**
 * Encabezado de pantalla con el estilo de Ajustes: cápsula translúcida con botón de volver
 * (cuadrado, flecha en color primario), título y subtítulo, y las acciones de cada pantalla.
 * Se queda fijo arriba al hacer scroll como una cápsula flotante: no hay franja detrás (solo se
 * ve la cápsula con sus esquinas redondeadas); al quedar pegada se vuelve más opaca y gana
 * sombra para que el contenido que pasa por debajo no estorbe la lectura.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backLabel,
  actions,
  titleAs: Title = 'h2',
  className = '-mx-4 px-4',
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isStuck = useIsStuck(ref, topEdge);

  return (
    <div
      ref={ref}
      style={style}
      data-stuck={isStuck || undefined}
      className={`sticky top-0 z-40 py-2 ${className}`}
    >
      <div
        className={`${CAPSULE_CLASS} ${
          isStuck ? 'bg-[var(--color-md-surface)]/90 shadow-md' : 'bg-[var(--color-md-surface)]/70 shadow-2xs'
        }`}
      >
        <button
          type="button"
          onClick={onBack}
          title={backLabel}
          aria-label={backLabel}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] text-[var(--color-md-on-surface)] shadow-2xs transition-all active:scale-95"
        >
          <ArrowLeft className="h-4.5 w-4.5 text-[var(--color-md-primary)]" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <Title className="truncate text-base font-black tracking-tight text-[var(--color-md-on-surface)] sm:text-lg">{title}</Title>
          {subtitle && (
            <p className="truncate text-[11px] font-medium text-[var(--color-md-on-surface-variant)]">{subtitle}</p>
          )}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
      </div>
    </div>
  );
};
