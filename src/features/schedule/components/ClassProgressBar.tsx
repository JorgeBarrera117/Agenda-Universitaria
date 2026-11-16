import React from 'react';
import { formatDuration } from '../utils/duration';

interface ClassProgressBarProps {
  /** Porcentaje transcurrido, de 0 a 100. */
  percent: number;
  minutesRemaining: number;
  /** Versión compacta para las columnas de la vista semanal. */
  compact?: boolean;
}

/**
 * Indicador de progreso lineal M3 para la clase en curso: pista tenue e indicador en el color
 * primario del tema, con el tiempo que queda debajo.
 */
export const ClassProgressBar: React.FC<ClassProgressBarProps> = ({ percent, minutesRemaining, compact = false }) => (
  <div className="space-y-1">
    <div
      role="progressbar"
      aria-label="Avance de la clase"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`Quedan ${formatDuration(minutesRemaining)}`}
      className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-md-primary)]/20"
    >
      <div
        className="h-full rounded-full bg-[var(--color-md-primary)] transition-[width] duration-700 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
    <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-medium tabular-nums text-[var(--color-md-on-surface-variant)]`}>
      Quedan {formatDuration(minutesRemaining)}
    </p>
  </div>
);
