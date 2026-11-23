import React, { useEffect, useRef, useState } from 'react';
import { Bluetooth, BluetoothSearching, ChevronLeft, KeyRound, LoaderCircle, Radar } from 'lucide-react';
import { startNearbyDiscovery, type NearbyRoom } from '../services/nearbyTransports';
import { ROOM_FILLED_BUTTON, ROOM_INPUT_INLINE, ROOM_TEXT_BUTTON } from './roomStyles';

interface NearbyRoomsCardProps {
  /** null = comprobando; false = este teléfono no tiene los servicios de Google Play. */
  available: boolean | null;
  /** El permiso de búsqueda ya está concedido (se puede buscar sin preguntar). */
  canSearchSilently: boolean;
  /** Buscar sola al abrir (hay compañeros guardados que podrían estar cerca). */
  autoSearch: boolean;
  disabled: boolean;
  joining: boolean;
  /** Explica y pide los permisos para buscar (dispositivos cercanos y ubicación precisa). true = concedidos. */
  ensurePermission: () => Promise<boolean>;
  onJoin: (room: NearbyRoom, pin: string) => Promise<void>;
  onShowToast: (message: string) => void;
  /** Salas que se ven ahora (para marcar «cerca» a los compañeros guardados). */
  onRoomsChange: (rooms: NearbyRoom[]) => void;
  /** Elegir desde fuera una sala encontrada (tocar a un compañero que está cerca). */
  selectRequest: { endpointId: string; nonce: number } | null;
}

/** La búsqueda se apaga sola pasado este tiempo (gasta batería). */
const DISCOVERY_MS = 120_000;

/**
 * Android: salas a pocos metros por Bluetooth y Wi-Fi Direct, sin red wifi (Nearby Connections).
 * Versión compacta para la pestaña «Unirse a sala»: buscar → elegir la sala → PIN.
 */
export const NearbyRoomsCard: React.FC<NearbyRoomsCardProps> = ({
  available,
  canSearchSilently,
  autoSearch,
  disabled,
  joining,
  ensurePermission,
  onJoin,
  onShowToast,
  onRoomsChange,
  selectRequest,
}) => {
  const [searching, setSearching] = useState(false);
  const [rooms, setRooms] = useState<NearbyRoom[]>([]);
  const [selected, setSelected] = useState<NearbyRoom | null>(null);
  const [pin, setPin] = useState('');
  const stopRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStarted = useRef(false);
  const roomsListener = useRef(onRoomsChange);
  useEffect(() => {
    roomsListener.current = onRoomsChange;
  }, [onRoomsChange]);

  // Elegir la sala de un compañero tocado arriba (ajuste durante el render, sin efecto)
  const [lastRequest, setLastRequest] = useState(0);
  if (selectRequest && selectRequest.nonce !== lastRequest) {
    setLastRequest(selectRequest.nonce);
    const room = rooms.find((r) => r.endpointId === selectRequest.endpointId);
    if (room) {
      setSelected(room);
      setPin('');
    }
  }

  const stop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    stopRef.current?.();
    stopRef.current = null;
    setSearching(false);
  };

  const begin = async () => {
    try {
      stopRef.current = await startNearbyDiscovery((found) => {
        setRooms(found);
        roomsListener.current(found);
      });
      setSearching(true);
      timerRef.current = setTimeout(stop, DISCOVERY_MS);
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'No se pudo buscar salas cercanas.');
    }
  };

  const search = async () => {
    if (!(await ensurePermission())) return;
    setRooms([]);
    setSelected(null);
    roomsListener.current([]);
    await begin();
  };

  // Búsqueda automática (solo con el permiso ya concedido: nunca pregunta sola)
  useEffect(() => {
    if (!autoSearch || !canSearchSilently || available !== true || autoStarted.current) return;
    autoStarted.current = true;
    void begin();
    // begin solo depende de refs y setters estables
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearch, canSearchSilently, available]);

  // Al salir de la recepción (o entrar a una sala) se deja de buscar
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopRef.current?.();
    },
    []
  );

  const join = async () => {
    if (!selected || !/^(\d{4}|\d{6})$/.test(pin)) return;
    stop();
    try {
      await onJoin(selected, pin);
    } catch {
      // El error lo muestra la recepción; se puede volver a buscar
    }
  };

  if (available === false) {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-[var(--color-md-surface-container-high)] px-3 py-2.5 text-xs text-[var(--color-md-on-surface-variant)]">
        <Bluetooth className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Salas cercanas sin wifi: este teléfono no tiene los servicios de Google Play que se necesitan.
      </p>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--color-md-surface-container-high)] p-3" aria-label="Salas cercanas por Bluetooth">
      {selected ? (
        <>
          <div className="flex items-center gap-1">
            <button type="button" className={`${ROOM_TEXT_BUTTON} -ml-2 min-h-9 px-2`} onClick={() => setSelected(null)} aria-label="Volver a las salas cercanas">
              <ChevronLeft aria-hidden="true" />
            </button>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{selected.roomName}</span>
              {selected.hostName && <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">Anfitrión: {selected.hostName}</span>}
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="PIN"
              aria-label="PIN de la sala cercana"
              inputMode="numeric"
              autoComplete="off"
              className={`${ROOM_INPUT_INLINE} min-w-0 flex-1 py-2.5 font-mono tracking-[0.3em]`}
            />
            <button type="button" className={`${ROOM_FILLED_BUTTON} shrink-0 px-4`} disabled={disabled || joining || pin.length < 4} onClick={() => void join()}>
              {joining ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              Entrar
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
              {searching ? <Radar className="h-4 w-4 animate-pulse motion-reduce:animate-none" aria-hidden="true" /> : <Bluetooth className="h-4 w-4" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">Salas cercanas</span>
              <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]" role="status">
                {searching ? (rooms.length > 0 ? `${rooms.length} cerca · buscando…` : 'Buscando por Bluetooth…') : 'Sin wifi, por Bluetooth (Android)'}
              </span>
            </span>
            {searching ? (
              <button type="button" className={`${ROOM_TEXT_BUTTON} min-h-9`} onClick={stop}>
                Detener
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--color-md-secondary-container)] px-3 text-sm font-bold text-[var(--color-md-on-secondary-container)] disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4"
                disabled={disabled || available === null}
                onClick={() => void search()}
              >
                <BluetoothSearching aria-hidden="true" />
                Buscar
              </button>
            )}
          </div>
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
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-md-on-surface)]/5 active:scale-[0.99] disabled:opacity-50"
                  >
                    <Bluetooth className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{room.roomName}</span>
                      {room.hostName && <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">Anfitrión: {room.hostName}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
