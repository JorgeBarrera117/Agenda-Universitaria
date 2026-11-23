import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, DoorOpen, KeyRound, LoaderCircle, LogIn, MonitorSmartphone, Pencil, ScanQrCode, Wifi } from 'lucide-react';
import { CARD_SURFACE_CLASS } from '../../../shared/styles/surfaces';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { SegmentedControl } from '../../../shared/components/form';
import { M3Switch } from '../../settings/components/SettingsPrimitives';
import { canScanTransfer, hostKind } from '../../transfer/services/transferAvailability';
import { parseManualInvite, parseRoomInviteText } from '../services/roomProtocol';
import { ROOM_PROFILE_COLORS, createRoom, joinNearbyRoom, joinRoom, saveRoomProfile } from '../services/roomStore';
import { NEARBY_TAG_LENGTH, getNearbyStatus, isNearbyPlatform, requestNearbyPermission, type NearbyRoom, type NearbyStatus } from '../services/nearbyTransports';
import { makeAvatarThumb } from '../services/roomAvatar';
import { useRoomContacts } from '../hooks/useRoomContacts';
import type { RoomContact, RoomInvite, RoomProfile } from '../types/room';
import { ROOM_FILLED_BUTTON, ROOM_INPUT, ROOM_INPUT_INLINE, ROOM_TEXT_BUTTON, ROOM_TONAL_BUTTON } from './roomStyles';
import { RoomAvatar } from './RoomAvatar';
import { NearbyPermissionDialog } from './NearbyPermissionDialog';
import { NearbyRoomsCard } from './NearbyRoomsCard';
import { SavedCompanionsRow } from './SavedCompanionsRow';

const QrScanner = lazy(() => import('../../transfer/components/QrScanner').then((m) => ({ default: m.QrScanner })));
const TransferLauncher = lazy(() => import('../../transfer/components/TransferLauncher').then((m) => ({ default: m.TransferLauncher })));

interface RoomLobbyProps {
  initialProfile: RoomProfile;
  /** Nombre de Mi perfil: si el de la sala es igual, no cuenta como escrito a mano. */
  studentName: string;
  /** Foto de Mi perfil (data URL); se envía como miniatura de 96 px. */
  studentPhoto?: string;
  busy: 'host' | 'guest' | null;
  onShowToast: (message: string) => void;
}

type LobbyTab = 'join' | 'create';

/**
 * Recepción compacta (cabe en una pantalla de teléfono): identidad en una fila, compañeros
 * guardados y dos pestañas, «Unirse a sala» (por defecto) y «Crear sala». En la PC, dos columnas.
 */
export const RoomLobby: React.FC<RoomLobbyProps> = ({ initialProfile, studentName, studentPhoto, busy, onShowToast }) => {
  const [profile, setProfile] = useState<RoomProfile>(initialProfile);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<LobbyTab>('join');
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
  const { contacts } = useRoomContacts();

  // Por cercanía (solo Android): disponibilidad, permisos y la explicación previa al permiso
  const [nearbyPlatform] = useState(isNearbyPlatform);
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus | null>(null);
  const [nearbyHost, setNearbyHost] = useState(true);
  const [permissionAsk, setPermissionAsk] = useState<{ denied: boolean; purpose: 'host' | 'guest'; resolve: (proceed: boolean) => void } | null>(null);
  const [nearbyRooms, setNearbyRooms] = useState<NearbyRoom[]>([]);
  const [selectRequest, setSelectRequest] = useState<{ endpointId: string; nonce: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void makeAvatarThumb(studentPhoto).then((thumb) => {
      if (alive) setPhoto(thumb);
    });
    if (nearbyPlatform) {
      void getNearbyStatus().then((status) => {
        if (alive) setNearbyStatus(status);
      });
    }
    return () => {
      alive = false;
    };
  }, [studentPhoto, nearbyPlatform]);

  const nearbyAvailable = nearbyPlatform ? (nearbyStatus?.available ?? null) : false;
  const profileReady = profile.name.trim().length > 0;
  const fullProfile: RoomProfile = { ...profile, name: profile.name.trim(), avatar: photo };

  /** Compañeros con una sala abierta cerca (su huella empieza con la etiqueta anunciada). */
  const nearbyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const room of nearbyRooms) {
      if (!room.hostTag || room.hostTag.length < NEARBY_TAG_LENGTH) continue;
      for (const contact of contacts) if (contact.deviceId.startsWith(room.hostTag)) ids.add(contact.deviceId);
    }
    return ids;
  }, [nearbyRooms, contacts]);

  const updateProfile = (next: RoomProfile) => {
    setProfile(next);
    if (next.name.trim()) saveRoomProfile(next, studentName);
  };

  /** Explica para qué es el permiso y, si acepta, lo pide al sistema. true = concedido. */
  const ensureNearbyPermission = async (purpose: 'host' | 'guest'): Promise<boolean> => {
    const status = await getNearbyStatus();
    const current = purpose === 'guest' ? status.discoveryPermission : status.permission;
    if (current === 'granted') return true;
    const proceed = await new Promise<boolean>((resolve) => setPermissionAsk({ denied: current === 'denied', purpose, resolve }));
    setPermissionAsk(null);
    if (!proceed) return false;
    const permission = await requestNearbyPermission(purpose);
    setNearbyStatus(await getNearbyStatus());
    if (permission !== 'granted') {
      onShowToast('Sin el permiso de dispositivos cercanos no se pueden usar las salas sin wifi.');
      return false;
    }
    return true;
  };

  const create = async () => {
    setError(null);
    try {
      // Por cercanía solo si el teléfono puede y el estudiante da el permiso; si no, solo por wifi
      const nearby = nearbyAvailable === true && nearbyHost ? await ensureNearbyPermission('host') : false;
      await createRoom({ roomName, pinLength, profile: fullProfile, rules: { waitingRoom }, nearby });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la sala.');
    }
  };

  const join = async (invite: RoomInvite) => {
    setError(null);
    try {
      await joinRoom(invite, fullProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar a la sala.');
    }
  };

  const joinNearby = async (room: NearbyRoom, roomPin: string) => {
    setError(null);
    try {
      await joinNearbyRoom(room, roomPin, fullProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar a la sala cercana.');
      throw err;
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

  const pickCompanion = (contact: RoomContact) => {
    const room = nearbyRooms.find((r) => r.hostTag && contact.deviceId.startsWith(r.hostTag));
    if (room) {
      setTab('join');
      setSelectRequest({ endpointId: room.endpointId, nonce: Date.now() });
      return;
    }
    onShowToast(`${contact.name.split(/\s+/)[0]} no tiene una sala cerca ahora. Pídele su código QR, o su dirección y PIN.`);
  };

  const disabled = !profileReady || busy !== null;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3 px-4 pb-6 pt-3 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-5 lg:pt-5">
      {/* Columna de identidad (PC: izquierda) */}
      <div className="space-y-3">
        <section className={`${CARD_SURFACE_CLASS} flex items-center gap-3 p-3`} aria-label="Cómo te verán en la sala">
          <RoomAvatar name={profile.name || '?'} color={profile.color} photo={photo} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-bold text-[var(--color-md-on-surface)]">{profile.name || 'Sin nombre'}</span>
            <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">{photo ? 'Con tu foto de Mi perfil' : 'Así te verán en la sala'}</span>
          </span>
          <button type="button" className={`${ROOM_TONAL_BUTTON} min-h-10 px-3`} onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            Editar
          </button>
        </section>

        {contacts.length > 0 && (
          <div className={`${CARD_SURFACE_CLASS} p-3`}>
            <SavedCompanionsRow contacts={contacts} nearbyIds={nearbyIds} onPick={pickCompanion} onShowToast={onShowToast} />
          </div>
        )}

        <p className="hidden items-start gap-2 px-1 text-xs text-[var(--color-md-on-surface-variant)] lg:flex">
          <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Por wifi: todos en la misma red o en el punto de acceso del anfitrión. Todo viaja cifrado con el PIN de la sala.
        </p>
      </div>

      {/* Acciones (PC: derecha) */}
      <section className={`${CARD_SURFACE_CLASS} p-3 sm:p-4`} aria-label="Unirse o crear una sala">
        <SegmentedControl
          ariaLabel="Unirse o crear una sala"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'join', label: 'Unirse a sala', icon: <LogIn className="h-4 w-4" /> },
            { value: 'create', label: 'Crear sala', icon: <DoorOpen className="h-4 w-4" /> },
          ]}
        />

        {tab === 'join' ? (
          <div className="mt-3 space-y-3">
            {nearbyPlatform && (
              <NearbyRoomsCard
                available={nearbyAvailable}
                canSearchSilently={nearbyStatus?.discoveryPermission === 'granted'}
                autoSearch={contacts.length > 0}
                disabled={disabled}
                joining={busy === 'guest'}
                ensurePermission={() => ensureNearbyPermission('guest')}
                onJoin={joinNearby}
                onShowToast={onShowToast}
                onRoomsChange={setNearbyRooms}
                selectRequest={selectRequest}
              />
            )}
            {canScan && (
              <button type="button" className={`${ROOM_FILLED_BUTTON} w-full`} disabled={disabled} onClick={() => setScanning(true)}>
                <ScanQrCode aria-hidden="true" />
                Escanear código QR
              </button>
            )}
            <div>
              <p className="text-xs font-bold text-[var(--color-md-on-surface-variant)]">{canScan ? 'O escribe la dirección y el PIN' : 'Dirección y PIN del anfitrión'}</p>
              <div className="mt-1 flex gap-2">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value.replace(/[^\d.:]/g, '').slice(0, 21))}
                  placeholder="192.168.1.20:43210"
                  aria-label="Dirección del anfitrión"
                  inputMode="decimal"
                  autoComplete="off"
                  className={`${ROOM_INPUT_INLINE} min-w-0 flex-1 py-2.5 font-mono`}
                />
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="PIN"
                  aria-label="PIN"
                  inputMode="numeric"
                  autoComplete="off"
                  className={`${ROOM_INPUT_INLINE} w-24 shrink-0 py-2.5 font-mono tracking-[0.2em]`}
                />
              </div>
              <button
                type="button"
                className={`${canScan ? ROOM_TONAL_BUTTON : ROOM_FILLED_BUTTON} mt-2 w-full`}
                disabled={disabled || !address || pin.length < 4}
                onClick={joinManual}
              >
                {busy === 'guest' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
                {busy === 'guest' ? 'Entrando…' : 'Entrar con PIN'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            <div>
              <label className="block text-xs font-bold text-[var(--color-md-on-surface-variant)]" htmlFor="room-name">
                Nombre de la sala
              </label>
              <input id="room-name" value={roomName} onChange={(e) => setRoomName(e.target.value.slice(0, 60))} className={`${ROOM_INPUT} mt-1 py-2.5`} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[var(--color-md-on-surface-variant)]">PIN de acceso</span>
              <SegmentedControl
                className="w-44"
                ariaLabel="Largo del PIN"
                value={pinLength}
                onChange={setPinLength}
                options={[
                  { value: 4, label: '4 cifras' },
                  { value: 6, label: '6 cifras' },
                ]}
              />
            </div>
            <ToggleRow title="Sala de espera" description="Apruebas a cada persona antes de que entre" checked={waitingRoom} onChange={setWaitingRoom} />
            {nearbyAvailable === true && (
              <ToggleRow title="También por cercanía" description="Bluetooth, para teléfonos Android sin tu wifi" checked={nearbyHost} onChange={setNearbyHost} />
            )}
            <button type="button" className={`${ROOM_FILLED_BUTTON} w-full`} disabled={disabled} onClick={() => void create()}>
              {busy === 'host' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <DoorOpen aria-hidden="true" />}
              {busy === 'host' ? 'Abriendo la sala…' : 'Abrir sala'}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-700 dark:text-red-200">
            {error}
          </p>
        )}
      </section>

      {/* Pie: copia completa, discreta */}
      {canFullCopy && (
        <button
          type="button"
          onClick={() => setFullCopyOpen(true)}
          className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-left text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-on-surface)]/5 lg:col-span-2"
        >
          <MonitorSmartphone className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold text-[var(--color-md-on-surface)]">Pasar todos mis datos a otro dispositivo</span>
            <span className="hidden sm:inline"> · copia completa con QR</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </button>
      )}

      {editing && (
        <IdentityEditor
          profile={profile}
          photo={photo}
          onClose={() => setEditing(false)}
          onSave={(next) => {
            updateProfile(next);
            setEditing(false);
          }}
        />
      )}
      {permissionAsk && (
        <NearbyPermissionDialog
          denied={permissionAsk.denied}
          purpose={permissionAsk.purpose}
          onContinue={() => permissionAsk.resolve(true)}
          onClose={() => permissionAsk.resolve(false)}
        />
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

const ToggleRow: React.FC<{ title: string; description: string; checked: boolean; onChange: (value: boolean) => void }> = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-md-surface-container-high)] px-3 py-2.5">
    <span className="min-w-0">
      <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">{title}</span>
      <span className="block text-xs text-[var(--color-md-on-surface-variant)]">{description}</span>
    </span>
    <M3Switch checked={checked} onChange={onChange} label={title} />
  </div>
);

interface IdentityEditorProps {
  profile: RoomProfile;
  photo?: string;
  onClose: () => void;
  onSave: (profile: RoomProfile) => void;
}

/** Cambiar el alias o el color (borde de la foto o fondo de las iniciales) solo para la sala. */
const IdentityEditor: React.FC<IdentityEditorProps> = ({ profile, photo, onClose, onSave }) => {
  const [name, setName] = useState(profile.name);
  const [color, setColor] = useState(profile.color);
  return (
    <Modal isOpen onClose={onClose} title="Cómo te verán" maxWidth="sm">
      <div className="flex items-center gap-3">
        <RoomAvatar name={name || '?'} color={color} photo={photo} size="lg" />
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Tu nombre" aria-label="Tu nombre en la sala" className={ROOM_INPUT} />
      </div>
      <p className="mt-3 text-xs font-bold text-[var(--color-md-on-surface-variant)]">{photo ? 'Color del borde' : 'Color'}</p>
      <div className="mt-1 grid max-w-sm grid-cols-8 gap-1.5" role="radiogroup" aria-label="Color de tu avatar">
        {ROOM_PROFILE_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={color === option}
            aria-label={`Color ${option}`}
            onClick={() => setColor(option)}
            className="flex aspect-square w-full max-w-9 items-center justify-center justify-self-center rounded-full text-white ring-offset-2 ring-offset-[var(--color-md-surface-container)] transition-transform active:scale-90 aria-checked:ring-2 aria-checked:ring-[var(--color-md-primary)]"
            style={{ backgroundColor: option }}
          >
            {color === option && <Check className="h-4 w-4" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--color-md-on-surface-variant)]">La foto viene de Ajustes, en Mi perfil. Estos cambios valen solo para la Sala Local.</p>
      <ModalActions>
        <button type="button" className={ROOM_TEXT_BUTTON} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className={ROOM_FILLED_BUTTON} disabled={!name.trim()} onClick={() => onSave({ ...profile, name: name.trim(), color })}>
          Guardar
        </button>
      </ModalActions>
    </Modal>
  );
};
