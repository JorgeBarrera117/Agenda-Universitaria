import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import { useLocalRoom } from '../hooks/useLocalRoom';
import { setRoomScreenOpen, totalPrivateUnread } from '../services/roomStore';
import { isLocalRoomAvailable } from '../services/roomTransports';

/**
 * Acceso a la Sala de Intercambio Local en la barra superior, a la izquierda de Ajustes.
 * - Teléfono: botón circular tonal de 40 px. PC: píldora tonal «Sala Local».
 * - Punto pulsante con una sala abierta; insignia con los mensajes nuevos sin leer.
 * Solo aparece en la app de Android y de Windows (la web no puede abrir ni unirse a salas).
 */
export const LocalRoomButton: React.FC = () => {
  const [available] = useState(isLocalRoomAvailable);
  const { session, unread: roomUnread, privateUnread } = useLocalRoom();
  const unread = roomUnread + totalPrivateUnread(privateUnread);
  if (!available) return null;

  const inRoom = session.phase === 'active' || session.phase === 'waiting';
  const label = inRoom ? `Sala Local (abierta${unread > 0 ? `, ${unread} mensajes nuevos` : ''})` : 'Sala Local';

  return (
    <button
      type="button"
      onClick={() => setRoomScreenOpen(true)}
      title="Sala de Intercambio Local"
      aria-label={label}
      className="relative flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface)] shadow-2xs transition-all duration-200 hover:bg-[var(--color-md-secondary-container)] active:scale-95 lg:h-11 lg:w-auto lg:px-5 xl:h-12"
    >
      <Radio className="h-4 w-4 text-[var(--color-md-primary)] lg:h-5 lg:w-5" aria-hidden="true" />
      <span className="hidden text-sm font-bold lg:inline">Sala Local</span>
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-10px font-bold text-white" aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : (
        inRoom && (
          <span className="absolute right-0.5 top-0.5 flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
        )
      )}
    </button>
  );
};
