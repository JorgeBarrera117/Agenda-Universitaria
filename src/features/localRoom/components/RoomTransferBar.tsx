import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { formatRoomBytes } from '../services/roomItems';
import type { RoomTransfer } from '../types/room';

interface RoomTransferBarProps {
  transfer: RoomTransfer;
  onCancel: () => void;
  /** Error: volver a intentar (descargas). */
  onRetry?: () => void;
}

/** Barra de progreso de una subida o descarga: porcentaje, peso transferido, velocidad y cancelar. */
export const RoomTransferBar: React.FC<RoomTransferBarProps> = ({ transfer, onCancel, onRetry }) => {
  const percent = transfer.totalBytes > 0 ? Math.min(100, Math.round((transfer.doneBytes / transfer.totalBytes) * 100)) : 0;
  const verb = transfer.direction === 'up' ? 'Enviando' : 'Descargando';

  if (transfer.status === 'error') {
    return (
      <div className="mt-3 rounded-2xl bg-red-500/10 p-2.5" role="alert">
        <p className="text-xs font-semibold text-red-700 dark:text-red-200">{transfer.error ?? 'La transferencia falló.'}</p>
        <div className="mt-2 flex justify-end gap-1">
          <button type="button" onClick={onCancel} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/8 [&>svg]:h-3.5 [&>svg]:w-3.5">
            <X aria-hidden="true" />
            Descartar
          </button>
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--color-md-secondary-container)] px-3 text-xs font-bold text-[var(--color-md-on-secondary-container)] [&>svg]:h-3.5 [&>svg]:w-3.5">
              <RotateCcw aria-hidden="true" />
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <div
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-md-surface-container-high)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`${verb}: ${percent} %`}
        >
          <div className="h-full rounded-full bg-[var(--color-md-primary)] transition-[width] duration-150 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label={transfer.direction === 'up' ? 'Cancelar envío' : 'Cancelar descarga'}
          title="Cancelar"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/8 active:scale-95"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1 flex flex-wrap justify-between gap-x-2 text-11px font-semibold text-[var(--color-md-on-surface-variant)]">
        <span className="whitespace-nowrap">
          {verb} · {percent} %
        </span>
        <span className="whitespace-nowrap tabular-nums">
          {formatRoomBytes(transfer.doneBytes)} de {formatRoomBytes(transfer.totalBytes)}
          {transfer.bytesPerSecond > 0 ? ` · ${formatRoomBytes(Math.round(transfer.bytesPerSecond))}/s` : ''}
        </span>
      </p>
    </div>
  );
};
