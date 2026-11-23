import React, { useState } from 'react';
import { Trash2, UsersRound } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { roomContactRepository } from '../repositories/roomContactRepository';
import type { RoomContact } from '../types/room';
import { RoomAvatar } from './RoomAvatar';
import { ROOM_ICON_BUTTON, ROOM_SECTION_TITLE, ROOM_TEXT_BUTTON } from './roomStyles';

interface SavedCompanionsRowProps {
  contacts: RoomContact[];
  /** Huellas de compañeros detectados cerca ahora mismo (anfitriones de salas por Bluetooth). */
  nearbyIds: ReadonlySet<string>;
  onPick: (contact: RoomContact) => void;
  onShowToast: (message: string) => void;
}

const lastSeenFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/**
 * Fila horizontal de «Compañeros guardados» en la recepción. El punto verde indica que ese
 * compañero tiene una sala abierta cerca (detectada por Bluetooth); tocarlo la elige.
 */
export const SavedCompanionsRow: React.FC<SavedCompanionsRowProps> = ({ contacts, nearbyIds, onPick, onShowToast }) => {
  const [managing, setManaging] = useState(false);
  if (contacts.length === 0) return null;
  // Primero los que están cerca
  const ordered = [...contacts].sort((a, b) => Number(nearbyIds.has(b.deviceId)) - Number(nearbyIds.has(a.deviceId)));

  return (
    <section aria-labelledby="room-companions-title">
      <div className="flex items-center justify-between gap-2">
        <h3 id="room-companions-title" className={`${ROOM_SECTION_TITLE} flex items-center gap-1.5`}>
          <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
          Compañeros guardados
        </h3>
        <button type="button" className={`${ROOM_TEXT_BUTTON} min-h-8 px-2 text-xs`} onClick={() => setManaging(true)}>
          Administrar
        </button>
      </div>
      <ul className="-mx-1 mt-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Compañeros guardados">
        {ordered.map((contact) => {
          const near = nearbyIds.has(contact.deviceId);
          return (
            <li key={contact.deviceId} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(contact)}
                aria-label={`${contact.name}${near ? ', tiene una sala cerca' : ''}`}
                className="flex w-16 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-colors hover:bg-[var(--color-md-on-surface)]/5 active:scale-95"
              >
                <RoomAvatar name={contact.name} color={contact.color} photo={contact.avatarThumb} size="lg" online={near ? true : undefined} />
                <span className="w-full truncate text-center text-11px font-semibold text-[var(--color-md-on-surface)]">{contact.name.split(/\s+/)[0]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {managing && (
        <Modal isOpen onClose={() => setManaging(false)} title="Compañeros guardados" maxWidth="sm">
          <p className="text-sm text-[var(--color-md-on-surface-variant)]">Se guardan solo en este dispositivo. Si tienes «Admitir compañeros guardados sin espera» activado, entran directo a tus salas.</p>
          <ul className="mt-3 divide-y divide-[var(--color-md-outline-variant)]/40">
            {contacts.map((contact) => (
              <li key={contact.deviceId} className="flex min-h-14 items-center gap-3 py-1.5">
                <RoomAvatar name={contact.name} color={contact.color} photo={contact.avatarThumb} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{contact.name}</span>
                  <span className="block text-xs text-[var(--color-md-on-surface-variant)]">Visto el {lastSeenFormatter.format(new Date(contact.lastSeen))}</span>
                </span>
                <button
                  type="button"
                  className={ROOM_ICON_BUTTON}
                  aria-label={`Quitar a ${contact.name} de compañeros`}
                  title="Quitar"
                  onClick={() => {
                    void roomContactRepository.remove(contact.deviceId).then(() => onShowToast(`${contact.name} ya no está en tus compañeros.`));
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </section>
  );
};
