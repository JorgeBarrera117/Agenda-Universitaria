import React, { Suspense, lazy, useState } from 'react';
import { Ban, Copy, Crown, Eye, LockKeyhole, LogOut, MessageSquareOff, Power, UserRoundCheck, UserRoundX, UsersRound } from 'lucide-react';
import { CARD_SURFACE_CLASS } from '../../../shared/styles/surfaces';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { M3Switch } from '../../settings/components/SettingsPrimitives';
import { buildRoomInviteText } from '../services/roomProtocol';
import { roomModeration } from '../services/roomStore';
import type { RoomInvite, RoomMember, RoomRules, RoomSnapshot } from '../types/room';
import { ROOM_DANGER_BUTTON, ROOM_FILLED_BUTTON, ROOM_ICON_BUTTON, ROOM_SECTION_TITLE, ROOM_TONAL_BUTTON, ROOM_TEXT_BUTTON } from './roomStyles';
import { RoomAvatar } from './RoomAvatar';

const QrCodeSvg = lazy(() => import('../../transfer/components/QrCodeSvg').then((m) => ({ default: m.QrCodeSvg })));

interface RoomSidebarProps {
  snapshot: RoomSnapshot;
  /** Solo el anfitrión: datos para invitar. */
  invite?: RoomInvite;
  onLeave: () => void;
  onShowToast: (message: string) => void;
}

const RULE_ROWS: { key: keyof RoomRules; title: string; description: string }[] = [
  { key: 'waitingRoom', title: 'Sala de espera', description: 'Apruebas a cada persona antes de que entre' },
  { key: 'locked', title: 'Bloquear la entrada', description: 'Nadie más puede unirse' },
  { key: 'readOnly', title: 'Solo lectura', description: 'Solo tú publicas; los demás miran y guardan' },
  { key: 'textEnabled', title: 'Permitir texto', description: 'Si lo apagas, solo se comparten elementos' },
];

/**
 * Columna izquierda en la PC (y hoja de «Participantes» en el teléfono): datos para invitar,
 * participantes, sala de espera y controles del anfitrión.
 */
export const RoomSidebar: React.FC<RoomSidebarProps> = ({ snapshot, invite, onLeave, onShowToast }) => {
  const isHost = Boolean(invite);
  const [toKick, setToKick] = useState<RoomMember | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const pending = snapshot.members.filter((m) => m.status === 'pending');
  const active = snapshot.members.filter((m) => m.status === 'active');
  const { rules } = snapshot;

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
            <div className="rounded-2xl bg-white p-2 shadow-2xs">
              <Suspense fallback={<div className="h-[148px] w-[148px]" />}>
                <QrCodeSvg value={buildRoomInviteText(invite)} size={148} label="Código QR para unirse a la sala" />
              </Suspense>
            </div>
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

      {/* Sala de espera */}
      {isHost && pending.length > 0 && (
        <section className={`${CARD_SURFACE_CLASS} p-4`} aria-labelledby="room-pending-title">
          <h3 id="room-pending-title" className={ROOM_SECTION_TITLE}>
            Esperando para entrar · {pending.length}
          </h3>
          <ul className="mt-2 space-y-2">
            {pending.map((member) => (
              <li key={member.id} className="flex items-center gap-3 rounded-2xl bg-[var(--color-md-surface-container-high)] p-2 pl-3">
                <RoomAvatar name={member.name} color={member.color} size="sm" online={member.online} />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--color-md-on-surface)]">{member.name}</span>
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
          {active.map((member) => (
            <li key={member.id} className="flex min-h-12 items-center gap-3 py-1.5">
              <RoomAvatar name={member.name} color={member.color} size="sm" online={member.online} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">
                  {member.name}
                  {member.id === snapshot.selfId && <span className="font-medium text-[var(--color-md-on-surface-variant)]"> (tú)</span>}
                </span>
                {member.isHost && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-md-primary)]">
                    <Crown className="h-3 w-3" aria-hidden="true" />
                    Anfitrión
                  </span>
                )}
                {!member.isHost && !member.online && <span className="block text-xs text-[var(--color-md-on-surface-variant)]">Reconectando…</span>}
              </span>
              {isHost && !member.isHost && (
                <button type="button" className={ROOM_ICON_BUTTON} onClick={() => setToKick(member)} aria-label={`Retirar a ${member.name}`} title="Retirar y bloquear">
                  <Ban aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
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
        (rules.readOnly || !rules.textEnabled || rules.locked) && (
          <section className={`${CARD_SURFACE_CLASS} space-y-2 p-4`} aria-label="Reglas de la sala">
            {rules.readOnly && <RuleNote icon={<Eye className="h-4 w-4" />} text="Solo lectura: solo el anfitrión publica." />}
            {!rules.textEnabled && <RuleNote icon={<MessageSquareOff className="h-4 w-4" />} text="El texto está desactivado: solo se comparten elementos." />}
            {rules.locked && <RuleNote icon={<LockKeyhole className="h-4 w-4" />} text="La entrada está cerrada para nuevas personas." />}
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
