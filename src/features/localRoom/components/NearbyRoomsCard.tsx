import React, { useEffect, useRef, useState } from 'react';
import { Bluetooth, BluetoothSearching, ChevronLeft, KeyRound, LoaderCircle, Radar, RefreshCw } from 'lucide-react';
import { CARD_SURFACE_CLASS } from '../../../shared/styles/surfaces';
import { startNearbyDiscovery, type NearbyRoom } from '../services/nearbyTransports';
import { ROOM_FILLED_BUTTON, ROOM_INPUT, ROOM_SECTION_TITLE, ROOM_TEXT_BUTTON, ROOM_TONAL_BUTTON } from './roomStyles';

interface NearbyRoomsCardProps {
  /** null = comprobando; false = este teléfono no tiene los servicios de Google Play. */
  available: boolean | null;
  disabled: boolean;
  joining: boolean;
  /** Explica y pide los permisos para buscar (dispositivos cercanos y ubicación aproximada). true = concedidos. */
  ensurePermission: () => Promise<boolean>;
  onJoin: (room: NearbyRoom, pin: string) => Promise<void>;
  onShowToast: (message: string) => void;
}

/** La búsqueda se apaga sola pasado este tiempo (gasta batería). */
const DISCOVERY_MS = 120_000;

/**
 * Android: salas a pocos metros por Bluetooth y Wi-Fi Direct, sin red wifi (Nearby Connections).
 * Buscar → elegir la sala → escribir su PIN.
 */
export const NearbyRoomsCard: React.FC<NearbyRoomsCardProps> = ({ available, disabled, joining, ensurePermission, onJoin, onShowToast }) => {
  const [searching, setSearching] = useState(false);
  const [rooms, setRooms] = useState<NearbyRoom[]>([]);
  const [selected, setSelected] = useState<NearbyRoom | null>(null);
  const [pin, setPin] = useState('');
  const stopRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    stopRef.current?.();
    stopRef.current = null;
    setSearching(false);
  };

  // Al salir de la recepción (o entrar a una sala) se deja de buscar
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopRef.current?.();
    },
    []
  );

  const search = async () => {
    if (!(await ensurePermission())) return;
    setRooms([]);
    setSelected(null);
    try {
      stopRef.current = await startNearbyDiscovery(setRooms);
      setSearching(true);
      timerRef.current = setTimeout(stop, DISCOVERY_MS);
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'No se pudo buscar salas cercanas.');
    }
  };

  const join = async () => {
    if (!selected || !/^(\d{4}|\d{6})$/.test(pin)) return;
    stop();
    try {
      await onJoin(selected, pin);
    } catch {
      // El error lo muestra la recepción; se puede volver a buscar
    }
  };

  return (
    <section className={`${CARD_SURFACE_CLASS} p-4`} aria-labelledby="room-nearby-title">
      <h3 id="room-nearby-title" className={`${ROOM_SECTION_TITLE} flex items-center gap-1.5`}>
        <Bluetooth className="h-3.5 w-3.5" aria-hidden="true" />
        Salas cercanas sin wifi
      </h3>

      {available === false ? (
        <p className="mt-1 text-sm text-[var(--color-md-on-surface-variant)]">
          Este teléfono no tiene los servicios de Google Play que necesitan las salas por cercanía. Puedes unirte por wifi o con el punto de acceso de otro teléfono.
        </p>
      ) : selected ? (
        <div className="mt-2">
          <button type="button" className={`${ROOM_TEXT_BUTTON} -ml-3`} onClick={() => setSelected(null)}>
            <ChevronLeft aria-hidden="true" />
            Otras salas
          </button>
          <p className="mt-1 text-sm font-bold text-[var(--color-md-on-surface)]">{selected.roomName}</p>
          {selected.hostName && <p className="text-xs text-[var(--color-md-on-surface-variant)]">Anfitrión: {selected.hostName}</p>}
          <label htmlFor="room-nearby-pin" className="mt-3 block text-xs font-bold text-[var(--color-md-on-surface-variant)]">
            PIN de la sala
          </label>
          <input
            id="room-nearby-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="0000"
            inputMode="numeric"
            autoComplete="off"
            className={`${ROOM_INPUT} mt-1 font-mono tracking-[0.3em]`}
          />
          <button type="button" className={`${ROOM_FILLED_BUTTON} mt-3 w-full`} disabled={disabled || joining || pin.length < 4} onClick={() => void join()}>
            {joining ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
            {joining ? 'Conectando…' : 'Entrar con PIN'}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--color-md-on-surface-variant)]">Para cuando no hay wifi: encuentra salas a pocos metros por Bluetooth, solo entre teléfonos Android.</p>
          {!searching ? (
            <button type="button" className={`${ROOM_TONAL_BUTTON} mt-3 w-full`} disabled={disabled || available === null} onClick={() => void search()}>
              {rooms.length > 0 ? <RefreshCw aria-hidden="true" /> : <BluetoothSearching aria-hidden="true" />}
              {rooms.length > 0 ? 'Buscar de nuevo' : 'Buscar salas cercanas'}
            </button>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-[var(--color-md-surface-container-high)] px-3 py-2" role="status">
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-md-on-surface)]">
                <Radar className="h-4 w-4 animate-pulse text-[var(--color-md-primary)] motion-reduce:animate-none" aria-hidden="true" />
                Buscando salas…
              </span>
              <button type="button" className={ROOM_TEXT_BUTTON} onClick={stop}>
                Detener
              </button>
            </div>
          )}
          {rooms.length > 0 && (
            <ul className="mt-2 space-y-1" aria-label="Salas encontradas">
              {rooms.map((room) => (
                <li key={room.endpointId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(room);
                      setPin('');
                    }}
                    disabled={disabled}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-[var(--color-md-surface-container-high)] active:scale-[0.99] disabled:opacity-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
                      <Bluetooth className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{room.roomName}</span>
                      {room.hostName && <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">Anfitrión: {room.hostName}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searching && rooms.length === 0 && <p className="mt-2 text-xs text-[var(--color-md-on-surface-variant)]">Pídele al anfitrión que abra la sala con «También por cercanía» activado.</p>}
        </>
      )}
    </section>
  );
};
