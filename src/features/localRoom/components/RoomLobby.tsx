import React, { Suspense, lazy, useState } from 'react';
import { Check, DoorOpen, KeyRound, LoaderCircle, MonitorSmartphone, Radio, ScanQrCode, Wifi } from 'lucide-react';
import { CARD_SURFACE_CLASS } from '../../../shared/styles/surfaces';
import { Modal } from '../../../shared/components/Modal';
import { SegmentedControl } from '../../../shared/components/form';
import { M3Switch } from '../../settings/components/SettingsPrimitives';
import { canScanTransfer, hostKind } from '../../transfer/services/transferAvailability';
import { parseManualInvite, parseRoomInviteText } from '../services/roomProtocol';
import { ROOM_PROFILE_COLORS, createRoom, joinRoom, saveRoomProfile } from '../services/roomStore';
import type { RoomInvite, RoomProfile } from '../types/room';
import { ROOM_FILLED_BUTTON, ROOM_INPUT, ROOM_SECTION_TITLE, ROOM_TONAL_BUTTON } from './roomStyles';
import { RoomAvatar } from './RoomAvatar';

const QrScanner = lazy(() => import('../../transfer/components/QrScanner').then((m) => ({ default: m.QrScanner })));
const TransferLauncher = lazy(() => import('../../transfer/components/TransferLauncher').then((m) => ({ default: m.TransferLauncher })));

interface RoomLobbyProps {
  initialProfile: RoomProfile;
  busy: 'host' | 'guest' | null;
  onShowToast: (message: string) => void;
}

/** Recepción: perfil, crear una sala o unirse por QR o con la dirección y el PIN. */
export const RoomLobby: React.FC<RoomLobbyProps> = ({ initialProfile, busy, onShowToast }) => {
  const [profile, setProfile] = useState<RoomProfile>(initialProfile);
  const [roomName, setRoomName] = useState(() => `Sala de ${initialProfile.name.split(/\s+/)[0] || 'clase'}`);
  const [pinLength, setPinLength] = useState<4 | 6>(4);
  const [waitingRoom, setWaitingRoom] = useState(true);
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fullCopyOpen, setFullCopyOpen] = useState(false);
  const [canScan] = useState(canScanTransfer);
  const [canFullCopy] = useState(() => hostKind() !== null);

  const profileReady = profile.name.trim().length > 0;

  const updateProfile = (next: RoomProfile) => {
    setProfile(next);
    if (next.name.trim()) saveRoomProfile(next);
  };

  const create = async () => {
    setError(null);
    try {
      await createRoom({ roomName, pinLength, profile: { ...profile, name: profile.name.trim() }, rules: { waitingRoom } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la sala.');
    }
  };

  const join = async (invite: RoomInvite) => {
    setError(null);
    try {
      await joinRoom(invite, { ...profile, name: profile.name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar a la sala.');
    }
  };

  const joinManual = () => {
    const invite = parseManualInvite(address, pin);
    if (!invite) {
      setError('Escribe la dirección tal como la muestra el anfitrión (por ejemplo 192.168.1.20:43210) y su PIN de 4 o 6 cifras.');
      return;
    }
    void join(invite);
  };

  const handleScan = (text: string): boolean => {
    const invite = parseRoomInviteText(text);
    if (!invite) {
      onShowToast('Ese código no es de una Sala Local.');
      return false;
    }
    setScanning(false);
    void join(invite);
    return true;
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-10 pt-4 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
          <Radio className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight text-[var(--color-md-on-surface)]">Sala de Intercambio Local</h2>
          <p className="mt-0.5 text-sm text-[var(--color-md-on-surface-variant)]">
            Comparte horarios, materias, contactos, apuntes y archivos con quienes estén cerca, sin internet. La sala desaparece al cerrarla; lo que guardes se queda en tu agenda.
          </p>
        </div>
      </div>

      {/* Perfil */}
      <section className={`${CARD_SURFACE_CLASS} p-4`} aria-labelledby="room-profile-title">
        <h3 id="room-profile-title" className={ROOM_SECTION_TITLE}>
          Cómo te verán
        </h3>
        <div className="mt-3 flex items-center gap-3">
          <RoomAvatar name={profile.name || '?'} color={profile.color} />
          <input
            value={profile.name}
            onChange={(e) => updateProfile({ ...profile, name: e.target.value.slice(0, 40) })}
            placeholder="Tu nombre"
            aria-label="Tu nombre en la sala"
            className={ROOM_INPUT}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Color de tu avatar">
          {ROOM_PROFILE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={profile.color === color}
              aria-label={`Color ${color}`}
              onClick={() => updateProfile({ ...profile, color })}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-[var(--color-md-surface-container)] transition-transform active:scale-90 aria-checked:ring-2 aria-checked:ring-[var(--color-md-primary)]"
              style={{ backgroundColor: color }}
            >
              {profile.color === color && <Check className="h-4 w-4" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Crear */}
        <section className={`${CARD_SURFACE_CLASS} flex flex-col p-4`} aria-labelledby="room-create-title">
          <h3 id="room-create-title" className={ROOM_SECTION_TITLE}>
            Abrir una sala
          </h3>
          <p className="mt-1 text-sm text-[var(--color-md-on-surface-variant)]">Este dispositivo será el anfitrión: decide quién entra y qué se puede publicar.</p>
          <label className="mt-3 block text-xs font-bold text-[var(--color-md-on-surface-variant)]" htmlFor="room-name">
            Nombre de la sala
          </label>
          <input id="room-name" value={roomName} onChange={(e) => setRoomName(e.target.value.slice(0, 60))} className={`${ROOM_INPUT} mt-1`} />
          <p className="mt-3 text-xs font-bold text-[var(--color-md-on-surface-variant)]">PIN de acceso</p>
          <SegmentedControl
            className="mt-1"
            ariaLabel="Largo del PIN"
            value={pinLength}
            onChange={setPinLength}
            options={[
              { value: 4, label: '4 cifras' },
              { value: 6, label: '6 cifras' },
            ]}
          />
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-md-surface-container-high)] px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">Sala de espera</span>
              <span className="block text-xs text-[var(--color-md-on-surface-variant)]">Apruebas a cada persona antes de que entre</span>
            </span>
            <M3Switch checked={waitingRoom} onChange={setWaitingRoom} label="Sala de espera" />
          </div>
          <div className="mt-auto pt-4">
            <button type="button" className={`${ROOM_FILLED_BUTTON} w-full`} disabled={!profileReady || busy !== null} onClick={() => void create()}>
              {busy === 'host' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <DoorOpen aria-hidden="true" />}
              {busy === 'host' ? 'Abriendo la sala…' : 'Abrir sala'}
            </button>
          </div>
        </section>

        {/* Unirse */}
        <section className={`${CARD_SURFACE_CLASS} flex flex-col p-4`} aria-labelledby="room-join-title">
          <h3 id="room-join-title" className={ROOM_SECTION_TITLE}>
            Unirse a una sala
          </h3>
          <p className="mt-1 text-sm text-[var(--color-md-on-surface-variant)]">Escanea el código del anfitrión o escribe su dirección y el PIN.</p>
          {canScan && (
            <button type="button" className={`${ROOM_TONAL_BUTTON} mt-3 w-full`} disabled={!profileReady || busy !== null} onClick={() => setScanning(true)}>
              <ScanQrCode aria-hidden="true" />
              Escanear código QR
            </button>
          )}
          <label className="mt-3 block text-xs font-bold text-[var(--color-md-on-surface-variant)]" htmlFor="room-address">
            Dirección del anfitrión
          </label>
          <input
            id="room-address"
            value={address}
            onChange={(e) => setAddress(e.target.value.replace(/[^\d.:]/g, '').slice(0, 21))}
            placeholder="192.168.1.20:43210"
            inputMode="decimal"
            autoComplete="off"
            className={`${ROOM_INPUT} mt-1 font-mono`}
          />
          <label className="mt-3 block text-xs font-bold text-[var(--color-md-on-surface-variant)]" htmlFor="room-pin">
            PIN
          </label>
          <input
            id="room-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="0000"
            inputMode="numeric"
            autoComplete="off"
            className={`${ROOM_INPUT} mt-1 font-mono tracking-[0.3em]`}
          />
          <div className="mt-auto pt-4">
            <button type="button" className={`${ROOM_FILLED_BUTTON} w-full`} disabled={!profileReady || busy !== null || !address || pin.length < 4} onClick={joinManual}>
              {busy === 'guest' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              {busy === 'guest' ? 'Entrando…' : 'Entrar con PIN'}
            </button>
          </div>
        </section>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-200">
          {error}
        </p>
      )}

      <p className="flex items-start gap-2 px-1 text-xs text-[var(--color-md-on-surface-variant)]">
        <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Todos deben estar en la misma red wifi, o conectados al punto de acceso del teléfono anfitrión. Lo que viaja por la sala va cifrado con el PIN.
      </p>

      {canFullCopy && (
        <section className={`${CARD_SURFACE_CLASS} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-surface-container-high)] text-[var(--color-md-primary)]">
            <MonitorSmartphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">Pasar todos mis datos a otro dispositivo</span>
            <span className="block text-xs text-[var(--color-md-on-surface-variant)]">Copia completa a tu propio teléfono o PC, con un código QR.</span>
          </span>
          <button type="button" className={ROOM_TONAL_BUTTON} onClick={() => setFullCopyOpen(true)}>
            Copia completa
          </button>
        </section>
      )}

      {scanning && (
        <Modal isOpen onClose={() => setScanning(false)} title="Escanear el código de la sala" maxWidth="md">
          <Suspense fallback={null}>
            <QrScanner onDetected={handleScan} />
          </Suspense>
        </Modal>
      )}
      {fullCopyOpen && (
        <Suspense fallback={null}>
          <TransferLauncher onClose={() => setFullCopyOpen(false)} onShowToast={onShowToast} />
        </Suspense>
      )}
    </div>
  );
};
