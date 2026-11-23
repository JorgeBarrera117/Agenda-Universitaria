import React, { Suspense, lazy, useState } from 'react';
import { Ban, Bluetooth, Copy, Crown, Eye, LockKeyhole, LogOut, MessageCircle, MessageSquareOff, Power, UserRoundCheck, UserRoundX, UsersRound } from 'lucide-react';
import { CARD_SURFACE_CLASS } from '../../../shared/styles/surfaces';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { M3Switch } from '../../settings/components/SettingsPrimitives';
import { buildRoomInviteText } from '../services/roomProtocol';
import { roomModeration } from '../services/roomStore';
import type { RoomInvite, RoomMember, RoomRules, RoomSnapshot } from '../types/room';
import { ROOM_DANGER_BUTTON, ROOM_FILLED_BUTTON, ROOM_ICON_BUTTON, ROOM_SECTION_TITLE, ROOM_TONAL_BUTTON, ROOM_TEXT_BUTTON } from './roomStyles';
import { RoomAvatar } from './RoomAvatar';
import { CompanionTag } from './CompanionTag';
import { SaveCompanionButton } from './SaveCompanionButton';
import { useRoomContacts } from '../hooks/useRoomContacts';

const QrCodeSvg = lazy(() => import('../../transfer/components/QrCodeSvg').then((m) => ({ default: m.QrCodeSvg })));

interface RoomSidebarProps {
  snapshot: RoomSnapshot;
  /** Solo el anfitrión: datos para invitar. */
  invite?: RoomInvite;
  onLeave: () => void;
  onShowToast: (message: string) => void;
  /** Mensajes privados sin leer por compañero (insignia sobre su avatar). */
  privateUnread: Readonly<Record<string, number>>;
  /** Tocar a un participante abre el chat privado con él. */
  onOpenChat: (memberId: string) => void;
}

const RULE_ROWS: { key: keyof RoomRules; title: string; description: string }[] = [
  { key: 'waitingRoom', title: 'Sala de espera', description: 'Apruebas a cada persona antes de que entre' },
  { key: 'locked', title: 'Bloquear la entrada', description: 'Nadie más puede unirse' },
  { key: 'readOnly', title: 'Solo lectura', description: 'Solo tú publicas; los demás miran y guardan' },
  { key: 'textEnabled', title: 'Permitir texto', description: 'Si lo apagas, solo se comparten elementos' },
  { key: 'privateChat', title: 'Chats privados', description: 'Los participantes pueden escribirse 1 a 1' },
  { key: 'trustedAutoAdmit', title: 'Admitir compañeros guardados sin espera', description: 'Tus compañeros guardados entran directo, sin aprobarlos' },
];

/**
 * Columna izquierda en la PC (y hoja de «Participantes» en el teléfono): datos para invitar,
 * participantes, sala de espera y controles del anfitrión.
 */
export const RoomSidebar: React.FC<RoomSidebarProps> = ({ snapshot, invite, onLeave, onShowToast, privateUnread, onOpenChat }) => {
  const { savedIds } = useRoomContacts();
  const isSaved = (member: RoomMember) => Boolean(member.peerId && savedIds.has(member.peerId));
  const isHost = Boolean(invite);
  const [toKick, setToKick] = useState<RoomMember | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const pending = snapshot.members.filter((m) => m.status === 'pending');
  const active = snapshot.members.filter((m) => m.status === 'active');
  const { rules } = snapshot;
  // El anfitrión siempre puede escribir en privado; los demás, si lo permite
  const canChat = isHost || rules.privateChat;

  const addresses = invite ? invite.hosts.filter((h) => h !== 'dev').map((h) => `${h}:${invite.port}`) : [];

  const copyAddress = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      onShowToast('Dirección copiada.');
    } catch {
      onShowToast(value);
    }
  };

  return (
    <div className="space-y-4">
      {/* Invitar */}
      {invite && (
        <section className={`${CARD_SURFACE_CLASS} p-4`} aria-labelledby="room-invite-title">
          <h3 id="room-invite-title" className={ROOM_SECTION_TITLE}>
            Invitar
          </h3>
          <div className="mt-3 flex flex-col items-center gap-3">
            {/* Sin red local (solo cercanía) no hay QR ni dirección: se entra desde «Salas cercanas» */}
            {invite.hosts.length > 0 && (
              <div className="rounded-2xl bg-white p-2 shadow-2xs">
                <Suspense fallback={<div className="h-[148px] w-[148px]" />}>
                  <QrCodeSvg value={buildRoomInviteText(invite)} size={148} label="Código QR para unirse a la sala" />
                </Suspense>
              </div>
            )}
            <div className="w-full min-w-0 text-center">
              <p className="text-xs font-bold text-[var(--color-md-on-surface-variant)]">PIN</p>
              <p className="font-mono text-3xl font-extrabold tracking-[0.25em] text-[var(--color-md-on-surface)]" aria-label={`PIN ${invite.pin.split('').join(' ')}`}>
                {invite.pin}
              </p>
              {addresses.length > 0 && (
                <>
                  <p className="mt-2 text-xs font-bold text-[var(--color-md-on-surface-variant)]">Dirección (para entrar sin cámara)</p>
                  <ul className="mt-1 space-y-1">
                    {addresses.map((value) => (
                      <li key={value}>
                        <button type="button" className={`${ROOM_TEXT_BUTTON} max-w-full font-mono`} onClick={() => void copyAddress(value)} aria-label={`Copiar dirección ${value}`}>
                          {value}
                          <Copy aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {invite?.nearby && (
        <p className="flex items-start gap-2 rounded-2xl bg-[var(--color-md-primary-container)]/60 px-3 py-2.5 text-xs font-semibold text-[var(--color-md-on-primary-container)]">
          <Bluetooth className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {invite.hosts.length > 0
            ? 'También visible por cercanía: los teléfonos Android sin tu wifi la encuentran en Salas cercanas y entran con el PIN.'
            : 'Sin wifi: los teléfonos Android cercanos la encuentran en Salas cercanas (Bluetooth) y entran con el PIN.'}
        </p>
      )}

      {/* Sala de espera */}
      {isHost && pending.length > 0 && (
        <section className={`${CARD_SURFACE_CLASS} p-4`} aria-labelledby="room-pending-title">
          <h3 id="room-pending-title" className={ROOM_SECTION_TITLE}>
            Esperando para entrar · {pending.length}
          </h3>
          <ul className="mt-2 space-y-2">
            {pending.map((member) => (
              <li key={member.id} className="flex items-center gap-3 rounded-2xl bg-[var(--color-md-surface-container-high)] p-2 pl-3">
                <RoomAvatar name={member.name} color={member.color} photo={snapshot.avatars[member.id]} size="sm" online={member.online} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--color-md-on-surface)]">
                  {member.name}
                  {isSaved(member) && <CompanionTag />}
                </span>
                <button type="button" className={ROOM_ICON_BUTTON} onClick={() => roomModeration.reject(member.id)} aria-label={`Rechazar a ${member.name}`} title="Rechazar">
                  <UserRoundX aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-md-primary)] px-3 text-sm font-bold text-[var(--color-md-on-primary)] active:scale-95 [&>svg]:h-4 [&>svg]:w-4"
                  onClick={() => roomModeration.approve(member.id)}
                  aria-label={`Aceptar a ${member.name}`}
                >
                  <UserRoundCheck aria-hidden="true" />
                  Aceptar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Participantes */}
      <section className={`${CARD_SURFACE_CLASS} p-4`} aria-labelledby="room-members-title">
        <h3 id="room-members-title" className={`${ROOM_SECTION_TITLE} flex items-center gap-1.5`}>
          <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
          Participantes · {active.length}
        </h3>
        <ul className="mt-2 divide-y divide-[var(--color-md-outline-variant)]/40">
          {active.map((member) => {
            const self = member.id === snapshot.selfId;
            const unread = privateUnread[member.id] ?? 0;
            const chatEnabled = !self && (canChat || unread > 0);
            const content = (
              <>
                <span className="relative shrink-0">
                  <RoomAvatar name={member.name} color={member.color} photo={snapshot.avatars[member.id]} size="sm" online={member.online} />
                  {unread > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-10px font-bold text-white" aria-hidden="true">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">
                    {member.name}
                    {self && <span className="font-medium text-[var(--color-md-on-surface-variant)]"> (tú)</span>}
                    {!self && isSaved(member) && <CompanionTag />}
                  </span>
                  {member.isHost && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-md-primary)]">
                      <Crown className="h-3 w-3" aria-hidden="true" />
                      Anfitrión
                    </span>
                  )}
                  {!member.isHost && !member.online && <span className="block text-xs text-[var(--color-md-on-surface-variant)]">Reconectando…</span>}
                </span>
                {chatEnabled && <MessageCircle className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />}
              </>
            );
            return (
            <li key={member.id} className="flex min-h-12 items-center gap-1 py-1">
              {chatEnabled ? (
                <button
                  type="button"
                  onClick={() => onOpenChat(member.id)}
                  aria-label={`Chat privado con ${member.name}${unread > 0 ? `, ${unread} sin leer` : ''}`}
                  className="-mx-2 flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-[var(--color-md-on-surface)]/5 active:scale-[0.99]"
                >
                  {content}
                </button>
              ) : (
                <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3">{content}</div>
              )}
              {!self && <SaveCompanionButton member={member} photo={snapshot.avatars[member.id]} saved={isSaved(member)} onShowToast={onShowToast} compact />}
              {isHost && !member.isHost && (
                <button type="button" className={ROOM_ICON_BUTTON} onClick={() => setToKick(member)} aria-label={`Retirar a ${member.name}`} title="Retirar y bloquear">
                  <Ban aria-hidden="true" />
                </button>
              )}
            </li>
            );
          })}
        </ul>
        {canChat && active.length > 1 && <p className="mt-2 text-xs text-[var(--color-md-on-surface-variant)]">Toca a alguien para escribirle en privado.</p>}
      </section>

      {/* Reglas */}
      {isHost ? (
        <section className={`${CARD_SURFACE_CLASS} p-4`} aria-labelledby="room-rules-title">
          <h3 id="room-rules-title" className={ROOM_SECTION_TITLE}>
            Controles del anfitrión
          </h3>
          <ul className="mt-2 space-y-1">
            {RULE_ROWS.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">{row.title}</span>
                  <span className="block text-xs text-[var(--color-md-on-surface-variant)]">{row.description}</span>
                </span>
                <M3Switch checked={rules[row.key]} onChange={(value) => roomModeration.setRules({ [row.key]: value })} label={row.title} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        (rules.readOnly || !rules.textEnabled || rules.locked || !rules.privateChat) && (
          <section className={`${CARD_SURFACE_CLASS} space-y-2 p-4`} aria-label="Reglas de la sala">
            {rules.readOnly && <RuleNote icon={<Eye className="h-4 w-4" />} text="Solo lectura: solo el anfitrión publica." />}
            {!rules.textEnabled && <RuleNote icon={<MessageSquareOff className="h-4 w-4" />} text="El texto está desactivado: solo se comparten elementos." />}
            {rules.locked && <RuleNote icon={<LockKeyhole className="h-4 w-4" />} text="La entrada está cerrada para nuevas personas." />}
            {!rules.privateChat && <RuleNote icon={<MessageCircle className="h-4 w-4" />} text="Los chats privados están desactivados." />}
          </section>
        )
      )}

      <button type="button" className={`${ROOM_DANGER_BUTTON} w-full`} onClick={() => setConfirmLeave(true)}>
        {isHost ? <Power aria-hidden="true" /> : <LogOut aria-hidden="true" />}
        {isHost ? 'Cerrar sala para todos' : 'Salir de la sala'}
      </button>

      {toKick && (
        <Modal isOpen onClose={() => setToKick(null)} title={`Retirar a ${toKick.name}`} maxWidth="sm">
          <p className="text-sm text-[var(--color-md-on-surface-variant)]">Sale de la sala y no podrá volver a entrar mientras siga abierta.</p>
          <ModalActions>
            <button type="button" className={ROOM_TONAL_BUTTON} onClick={() => setToKick(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className={ROOM_FILLED_BUTTON}
              onClick={() => {
                roomModeration.kick(toKick.id);
                setToKick(null);
              }}
            >
              <Ban aria-hidden="true" />
              Retirar
            </button>
          </ModalActions>
        </Modal>
      )}

      {confirmLeave && (
        <Modal isOpen onClose={() => setConfirmLeave(false)} title={isHost ? 'Cerrar la sala para todos' : 'Salir de la sala'} maxWidth="sm">
          <p className="text-sm text-[var(--color-md-on-surface-variant)]">
            {isHost
              ? 'La sala desaparece para todos. Lo que cada uno ya guardó se queda en su agenda.'
              : 'Dejarás de ver el hilo. Lo que ya guardaste se queda en tu agenda.'}
          </p>
          <ModalActions>
            <button type="button" className={ROOM_TONAL_BUTTON} onClick={() => setConfirmLeave(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className={ROOM_FILLED_BUTTON}
              onClick={() => {
                setConfirmLeave(false);
                onLeave();
              }}
            >
              {isHost ? 'Cerrar sala' : 'Salir'}
            </button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
};

const RuleNote: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <p className="flex items-center gap-2 text-sm text-[var(--color-md-on-surface-variant)]">
    <span className="text-[var(--color-md-primary)]">{icon}</span>
    {text}
  </p>
);
