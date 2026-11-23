import React, { useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { roomContactRepository } from '../repositories/roomContactRepository';
import type { RoomMember } from '../types/room';

interface SaveCompanionButtonProps {
  member: RoomMember;
  photo?: string;
  saved: boolean;
  onShowToast: (message: string) => void;
  /** compact: solo ícono (filas estrechas). */
  compact?: boolean;
}

/**
 * «Guardar compañero» → «Guardado». Volver a tocarlo lo quita de los compañeros guardados.
 * Solo se ofrece si el participante firmó su entrada (tiene huella verificada).
 */
export const SaveCompanionButton: React.FC<SaveCompanionButtonProps> = ({ member, photo, saved, onShowToast, compact = false }) => {
  const [busy, setBusy] = useState(false);
  if (!member.peerId) return null;
  const first = member.name.split(/\s+/)[0];

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (saved) {
        await roomContactRepository.remove(member.peerId as string);
        onShowToast(`${first} ya no está en tus compañeros.`);
      } else {
        await roomContactRepository.saveMember(member, photo);
        onShowToast(`${first} quedó en tus compañeros guardados.`);
      }
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? `${member.name} está guardado como compañero (tocar para quitar)` : `Guardar a ${member.name} como compañero`}
      title={saved ? 'Guardado (tocar para quitar)' : 'Guardar compañero'}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-xs font-bold transition-all active:scale-95 disabled:opacity-60 [&>svg]:h-4 [&>svg]:w-4 ${
        compact ? 'h-10 w-10' : 'min-h-9 px-3'
      } ${
        saved
          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
          : 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] hover:brightness-95'
      }`}
    >
      {saved ? <Check aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
      {!compact && (saved ? 'Guardado' : 'Guardar compañero')}
    </button>
  );
};
