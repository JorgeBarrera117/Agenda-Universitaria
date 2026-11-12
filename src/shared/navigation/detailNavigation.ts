import { useState } from 'react';
import type { TabType } from '../components/Navbar';

/**
 * Navegación entre fichas de detalle de distintas pestañas (Horario → ficha de materia →
 * ficha del catedrático → …). App guarda la última petición; cada pestaña la atiende y, al cerrar
 * la ficha, devuelve al usuario a donde estaba (otra pestaña y, si venía de otra ficha, la reabre).
 */
export type DetailKind = 'subject' | 'professor';

export interface DetailTarget {
  kind: DetailKind;
  id: string;
}

/** A dónde volver al cerrar una ficha: una pestaña y, opcionalmente, la ficha que había abierta. */
export interface DetailReturn {
  tab: TabType;
  request?: DetailRequest;
}

export interface DetailRequest extends DetailTarget {
  /** Distingue dos peticiones iguales seguidas (abrir la misma ficha otra vez). */
  nonce: number;
  returnTo?: DetailReturn;
}

export const DETAIL_TAB: Record<DetailKind, TabType> = { subject: 'subjects', professor: 'professors' };

/**
 * Selección de la ficha abierta en una pestaña. Atiende las peticiones que llegan de App (se
 * aplican durante el render al cambiar el nonce, sin efectos) y recuerda por dónde se llegó para
 * volver ahí al cerrar.
 */
export function useDetailSelection(
  kind: DetailKind,
  request: DetailRequest | null | undefined,
  onReturn?: (to: DetailReturn) => void
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openedVia, setOpenedVia] = useState<DetailRequest | null>(null);
  const [seenNonce, setSeenNonce] = useState<number | null>(null);

  if (request && request.kind === kind && request.nonce !== seenNonce) {
    setSeenNonce(request.nonce);
    setSelectedId(request.id);
    setOpenedVia(request);
  }

  /** Abrir una ficha desde la propia lista (al cerrarla se vuelve a la lista). */
  const open = (id: string) => {
    setSelectedId(id);
    setOpenedVia(null);
  };

  /** Cerrar sin volver a ningún sitio (al saltar a otra pestaña o tras eliminar). */
  const dismiss = () => {
    setSelectedId(null);
    setOpenedVia(null);
  };

  /** Cerrar con "volver": regresa a la pestaña/ficha de origen si se llegó desde otra. */
  const close = () => {
    const via = openedVia;
    dismiss();
    if (via?.returnTo) onReturn?.(via.returnTo);
  };

  /** Para abrir otra ficha desde esta: cómo reabrir la actual al volver. */
  const returnPoint = (tab: TabType): DetailReturn | undefined =>
    selectedId ? { tab, request: openedVia ?? { kind, id: selectedId, nonce: 0 } } : undefined;

  return { selectedId, open, close, dismiss, returnPoint };
}
