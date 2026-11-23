import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Download, Eye, LoaderCircle, MessageSquareOff, Paperclip, SendHorizontal, WifiOff } from 'lucide-react';
import { CARD_SURFACE_CLASS } from '../../../shared/styles/surfaces';
import { cancelTransfer, downloadTransferId, postToRoom } from '../services/roomStore';
import { ROOM_ITEM_LABEL, formatRoomBytes } from '../services/roomItems';
import { ROOM_TEXT_MAX, type RoomItemInfo, type RoomMessage, type RoomTransfer } from '../types/room';
import { ROOM_ICON_BUTTON, ROOM_ITEM_ICON } from './roomStyles';
import { RoomAvatar } from './RoomAvatar';
import { CompanionTag } from './CompanionTag';
import { useRoomContacts } from '../hooks/useRoomContacts';
import type { RoomMember } from '../types/room';
import { RoomTransferBar } from './RoomTransferBar';

interface RoomThreadProps {
  /** Mensajes de este hilo (sala o chat privado), ya filtrados. */
  messages: RoomMessage[];
  /** Participantes (para la etiqueta «Compañero») y sus fotos. */
  members: RoomMember[];
  avatars: Readonly<Record<string, string>>;
  selfId: string;
  /** Chat privado: destinatario de lo que se escribe. */
  postTo?: string;
  canPost: boolean;
  /** Por qué no se puede publicar (cuando canPost es false). */
  blockedNote: string;
  textAllowed: boolean;
  emptyTitle: string;
  emptyText: string;
  reconnecting: boolean;
  saved: ReadonlySet<string>;
  transfers: Readonly<Record<string, RoomTransfer>>;
  onSave: (message: RoomMessage) => void;
  onAttach: () => void;
  /** Tocar el avatar o el nombre de otro abre el chat privado con esa persona. */
  onOpenChat?: (memberId: string) => void;
  onShowToast: (message: string) => void;
}

const timeFormatter = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

/** Hilo (de la sala o de un chat privado) en tiempo real y caja para escribir o adjuntar. */
export const RoomThread: React.FC<RoomThreadProps> = ({
  messages,
  members,
  avatars,
  selfId,
  postTo,
  canPost,
  blockedNote,
  textAllowed,
  emptyTitle,
  emptyText,
  reconnecting,
  saved,
  transfers,
  onSave,
  onAttach,
  onOpenChat,
  onShowToast,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const { savedIds } = useRoomContacts();
  const companionIds = new Set(members.filter((m) => m.peerId && savedIds.has(m.peerId)).map((m) => m.id));
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);
  const uploads = Object.values(transfers).filter((t) => t.direction === 'up' && t.chat === (postTo ?? null));

  // Si estaba al final, sigue al final cuando llegan mensajes o empieza un envío
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages.length, uploads.length]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => {
      stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => list.removeEventListener('scroll', onScroll);
  }, []);

  const send = async () => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await postToRoom({ text: clean, to: postTo });
      setText('');
      stickToBottom.current = true;
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'No se pudo enviar.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {reconnecting && (
        <p className="mx-3 mt-2 flex items-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200" role="status">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          Reconectando con el anfitrión…
        </p>
      )}

      <div ref={listRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5" aria-live="polite" aria-label={postTo ? 'Chat privado' : 'Hilo de la sala'}>
        {messages.length === 0 && uploads.length === 0 ? (
          <div className="mx-auto mt-10 max-w-sm text-center">
            <p className="text-sm font-bold text-[var(--color-md-on-surface)]">{emptyTitle}</p>
            <p className="mt-1 text-sm text-[var(--color-md-on-surface-variant)]">{emptyText}</p>
          </div>
        ) : (
          <ul className="mx-auto max-w-3xl space-y-3">
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                mine={message.authorId === selfId}
                saved={message.item ? saved.has(message.item.id) : false}
                transfer={message.item ? transfers[downloadTransferId(message.item.id)] : undefined}
                onSave={() => onSave(message)}
                onOpenChat={onOpenChat}
                photo={avatars[message.authorId]}
                companion={companionIds.has(message.authorId)}
              />
            ))}
            {uploads.map((transfer) => (
              <UploadRow key={transfer.id} transfer={transfer} />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--color-md-outline-variant)]/50 bg-[var(--color-md-surface-container)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 sm:px-5">
        {!canPost ? (
          <p className="flex items-center justify-center gap-2 py-2 text-sm text-[var(--color-md-on-surface-variant)]">
            <Eye className="h-4 w-4" aria-hidden="true" />
            {blockedNote}
          </p>
        ) : (
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <button type="button" className={ROOM_ICON_BUTTON} onClick={onAttach} aria-label="Adjuntar horario, materia, contacto, apunte o archivo" title="Adjuntar">
              <Paperclip aria-hidden="true" />
            </button>
            {textAllowed ? (
              <div className="min-w-0 flex-1">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, ROOM_TEXT_MAX))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder={postTo ? 'Mensaje privado' : 'Escribe un mensaje'}
                  aria-label="Mensaje"
                  className="block max-h-28 min-h-11 w-full resize-none rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] px-4 py-2.5 text-sm text-[var(--color-md-on-surface)] outline-none placeholder:text-[var(--color-md-on-surface-variant)]/70 focus:border-[var(--color-md-primary)]"
                />
                {text.length > ROOM_TEXT_MAX - 50 && (
                  <p className="mt-0.5 pr-2 text-right text-10px font-semibold text-[var(--color-md-on-surface-variant)]">
                    {text.length}/{ROOM_TEXT_MAX}
                  </p>
                )}
              </div>
            ) : (
              <p className="flex min-h-11 flex-1 items-center gap-2 text-sm text-[var(--color-md-on-surface-variant)]">
                <MessageSquareOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                El texto está desactivado: comparte con el clip.
              </p>
            )}
            {textAllowed && (
              <button
                type="button"
                onClick={() => void send()}
                disabled={!text.trim() || sending}
                aria-label="Enviar"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] transition-all active:scale-95 disabled:opacity-40"
              >
                {sending ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-5 w-5" aria-hidden="true" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ItemHeader: React.FC<{ info: RoomItemInfo; sizeBytes: number }> = ({ info, sizeBytes }) => (
  <div className="flex items-start gap-3">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] [&>svg]:h-5 [&>svg]:w-5">
      {ROOM_ITEM_ICON[info.kind]}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-11px font-bold uppercase tracking-wide text-[var(--color-md-primary)]">{ROOM_ITEM_LABEL[info.kind]}</span>
      <span className="block break-words text-sm font-bold leading-snug text-[var(--color-md-on-surface)]">{info.title}</span>
      {info.subtitle && <span className="block break-words text-xs text-[var(--color-md-on-surface-variant)]">{info.subtitle}</span>}
      {info.kind !== 'document' && sizeBytes > 0 && <span className="block text-11px text-[var(--color-md-on-surface-variant)]">{formatRoomBytes(sizeBytes)}</span>}
    </span>
  </div>
);

/** Elemento que este dispositivo está enviando: tarjeta con la barra de progreso. */
const UploadRow: React.FC<{ transfer: RoomTransfer }> = ({ transfer }) =>
  transfer.info ? (
    <li className="flex flex-row-reverse items-end gap-2">
      <div className="flex min-w-0 max-w-[85%] flex-col items-end gap-1 sm:max-w-[75%]">
        <div className={`${CARD_SURFACE_CLASS} w-72 max-w-full p-3`}>
          <ItemHeader info={transfer.info} sizeBytes={transfer.totalBytes} />
          <RoomTransferBar transfer={transfer} onCancel={() => cancelTransfer(transfer.id)} />
        </div>
      </div>
    </li>
  ) : null;

interface MessageRowProps {
  message: RoomMessage;
  mine: boolean;
  saved: boolean;
  transfer?: RoomTransfer;
  onSave: () => void;
  onOpenChat?: (memberId: string) => void;
  photo?: string;
  companion: boolean;
}

const MessageRow: React.FC<MessageRowProps> = ({ message, mine, saved, transfer, onSave, onOpenChat, photo, companion }) => {
  if (message.system) {
    return (
      <li className="text-center text-xs font-medium text-[var(--color-md-on-surface-variant)]">
        <span className="inline-block rounded-full bg-[var(--color-md-surface-container-high)]/85 px-3 py-1 backdrop-blur-sm">{message.text}</span>
      </li>
    );
  }
  const time = timeFormatter.format(new Date(message.createdAt));
  const item = message.item;
  const openChat = !mine && onOpenChat ? () => onOpenChat(message.authorId) : undefined;

  return (
    <li className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      {!mine &&
        (openChat ? (
          <button type="button" onClick={openChat} className="shrink-0 rounded-full active:scale-95" aria-label={`Chat privado con ${message.authorName}`} title="Chat privado">
            <RoomAvatar name={message.authorName} color={message.authorColor} photo={photo} size="sm" />
          </button>
        ) : (
          <RoomAvatar name={message.authorName} color={message.authorColor} photo={photo} size="sm" />
        ))}
      <div className={`flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[75%] ${mine ? 'items-end' : 'items-start'}`}>
        {!mine &&
          (openChat ? (
            <button type="button" onClick={openChat} className="px-2 text-left text-xs font-bold text-[var(--color-md-on-surface-variant)] hover:text-[var(--color-md-primary)]">
              {message.authorName}
              {companion && <CompanionTag />}
            </button>
          ) : (
            <span className="px-2 text-xs font-bold text-[var(--color-md-on-surface-variant)]">
              {message.authorName}
              {companion && <CompanionTag />}
            </span>
          ))}
        {item && (
          <div className={`${CARD_SURFACE_CLASS} w-72 max-w-full p-3`}>
            <ItemHeader info={item} sizeBytes={item.sizeBytes} />
            {!mine &&
              (transfer ? (
                <RoomTransferBar transfer={transfer} onCancel={() => cancelTransfer(transfer.id)} onRetry={onSave} />
              ) : (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saved}
                  className={`mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-all active:scale-[0.98] [&>svg]:h-4 [&>svg]:w-4 ${
                    saved
                      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                      : 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] hover:brightness-95'
                  }`}
                >
                  {saved ? <Check aria-hidden="true" /> : <Download aria-hidden="true" />}
                  {saved ? 'Guardado' : 'Guardar en mi agenda'}
                </button>
              ))}
          </div>
        )}
        {message.text && (
          <p
            className={`whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-sm ${
              mine
                ? 'rounded-br-lg bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                : 'rounded-bl-lg bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface)]'
            }`}
          >
            {message.text}
          </p>
        )}
        <span className="px-2 text-10px text-[var(--color-md-on-surface-variant)]">{time}</span>
      </div>
    </li>
  );
};
