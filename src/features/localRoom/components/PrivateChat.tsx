import React, { useMemo } from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import type { RoomMember, RoomMessage, RoomSnapshot, RoomTransfer } from '../types/room';
import { RoomAvatar } from './RoomAvatar';
import { SaveCompanionButton } from './SaveCompanionButton';
import { useRoomContacts } from '../hooks/useRoomContacts';
import { RoomThread } from './RoomThread';
import { ROOM_ICON_BUTTON } from './roomStyles';

interface PrivateChatProps {
  peerId: string;
  snapshot: RoomSnapshot;
  isHost: boolean;
  reconnecting: boolean;
  saved: ReadonlySet<string>;
  transfers: Readonly<Record<string, RoomTransfer>>;
  /** Mensajes nuevos del hilo de la sala (insignia en «Volver»). */
  roomUnread: number;
  onBack: () => void;
  onSave: (message: RoomMessage) => void;
  onAttach: () => void;
  onShowToast: (message: string) => void;
}

/**
 * Conversación privada 1 a 1 dentro de la sala. El anfitrión solo entrega estos mensajes y sus
 * elementos al autor y al destinatario: el resto de la sala no los recibe.
 */
export const PrivateChat: React.FC<PrivateChatProps> = ({ peerId, snapshot, isHost, reconnecting, saved, transfers, roomUnread, onBack, onSave, onAttach, onShowToast }) => {
  const peer: RoomMember | undefined = snapshot.members.find((m) => m.id === peerId);
  const { savedIds } = useRoomContacts();
  const selfId = snapshot.selfId;
  const messages = useMemo(
    () => snapshot.messages.filter((m) => m.to && ((m.authorId === selfId && m.to === peerId) || (m.authorId === peerId && m.to === selfId))),
    [snapshot.messages, selfId, peerId]
  );
  // Nombre aunque ya se haya ido (de sus mensajes)
  const peerName = peer?.name ?? messages.find((m) => m.authorId === peerId)?.authorName ?? 'Participante';
  const peerColor = peer?.color ?? messages.find((m) => m.authorId === peerId)?.authorColor ?? '#5b6b8c';
  const allowed = isHost || snapshot.rules.privateChat;
  const present = Boolean(peer && peer.status === 'active');

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`Chat privado con ${peerName}`}>
      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-[var(--color-md-outline-variant)]/50 bg-[var(--color-md-surface-container)]/70 px-2 sm:px-4">
        <button type="button" className={`${ROOM_ICON_BUTTON} relative`} onClick={onBack} aria-label={roomUnread > 0 ? `Volver a la sala (${roomUnread} mensajes nuevos)` : 'Volver a la sala'} title="Volver a la sala">
          <ArrowLeft aria-hidden="true" />
          {roomUnread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden="true" />}
        </button>
        <RoomAvatar name={peerName} color={peerColor} photo={snapshot.avatars[peerId]} size="sm" online={present ? peer?.online : undefined} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--color-md-on-surface)]">{peerName}</p>
          <p className="flex items-center gap-1 text-xs text-[var(--color-md-on-surface-variant)]">
            <LockKeyhole className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Chat privado · solo ustedes dos lo ven</span>
          </p>
        </div>
        {peer && <SaveCompanionButton member={peer} photo={snapshot.avatars[peerId]} saved={Boolean(peer.peerId && savedIds.has(peer.peerId))} onShowToast={onShowToast} />}
      </div>
      <RoomThread
        messages={messages}
        members={snapshot.members}
        avatars={snapshot.avatars}
        selfId={selfId}
        postTo={peerId}
        canPost={allowed && present}
        blockedNote={!present ? `${peerName} ya no está en la sala.` : 'El anfitrión desactivó los chats privados.'}
        textAllowed
        emptyTitle={`Escríbele a ${peerName}`}
        emptyText="Lo que envíes aquí, texto o elementos, solo lo recibe esta persona."
        reconnecting={reconnecting}
        saved={saved}
        transfers={transfers}
        onSave={onSave}
        onAttach={onAttach}
        onShowToast={onShowToast}
      />
    </section>
  );
};
