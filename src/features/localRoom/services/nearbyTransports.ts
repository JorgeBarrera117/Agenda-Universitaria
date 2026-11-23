import { Capacitor } from '@capacitor/core';
import { LocalRoom, type NearbyPermission, type NearbyPurpose } from '../../../shared/plugins/localRoom';
import { createFramedGuestTransport, createFramedHostTransport, type FramedGuestTransport, type FramedHostTransport } from './nearbyLink';

/**
 * Sala Local por cercanía en Android (Google Nearby Connections). Une el plugin nativo con las
 * tramas de nearbyLink.ts. Un solo juego de escuchas reparte los eventos nativos al anfitrión,
 * al invitado o a la búsqueda de salas que esté activa.
 */

export interface NearbyRoom {
  endpointId: string;
  roomName: string;
  hostName: string;
  /** Inicio de la huella del anfitrión: permite marcar «cerca» a un compañero guardado. */
  hostTag?: string;
}

/** Largo de la etiqueta del anfitrión en el nombre anunciado (el nombre debe ser corto). */
export const NEARBY_TAG_LENGTH = 10;

export interface NearbyStatus {
  available: boolean;
  /** Para anunciar una sala. */
  permission: NearbyPermission;
  /** Para buscar salas (además, ubicación precisa: la exige Google Nearby). */
  discoveryPermission: NearbyPermission;
}

/** Separador entre el nombre de la sala y el del anfitrión en el nombre que se anuncia. */
const NAME_SEPARATOR = '\u001f';

export function isNearbyPlatform(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function getNearbyStatus(): Promise<NearbyStatus> {
  const none: NearbyStatus = { available: false, permission: 'denied', discoveryPermission: 'denied' };
  if (!isNearbyPlatform()) return none;
  try {
    return await LocalRoom.nearbyStatus();
  } catch {
    return none;
  }
}

export async function requestNearbyPermission(purpose: NearbyPurpose): Promise<NearbyPermission> {
  const { permission } = await LocalRoom.requestNearbyPermissions({ purpose });
  return permission;
}

/* ------------------------------------------------------------------ Escuchas nativas */

let host: FramedHostTransport | null = null;
const guests = new Map<string, FramedGuestTransport>();
let discoveryListener: { found: (room: NearbyRoom) => void; lost: (endpointId: string) => void } | null = null;
let hub: Promise<void> | null = null;

function ensureHub(): Promise<void> {
  if (!hub) {
    hub = Promise.all([
      LocalRoom.addListener('nearbyMessage', ({ endpointId, data }) => {
        const guest = guests.get(endpointId);
        if (guest) guest.handleMessage(data);
        else host?.handleMessage(endpointId, data);
      }),
      LocalRoom.addListener('nearbyDisconnected', ({ endpointId }) => {
        const guest = guests.get(endpointId);
        if (guest) guest.handleDisconnected();
        else host?.handleDisconnected(endpointId);
      }),
      LocalRoom.addListener('nearbyFound', ({ endpointId, name }) => {
        const [roomName, hostName, hostTag] = name.split(NAME_SEPARATOR);
        discoveryListener?.found({ endpointId, roomName: roomName || 'Sala cercana', hostName: hostName || '', hostTag: hostTag || undefined });
      }),
      LocalRoom.addListener('nearbyLost', ({ endpointId }) => discoveryListener?.lost(endpointId)),
    ]).then(() => undefined);
  }
  return hub;
}

/* ------------------------------------------------------------------ Anfitrión */

/** El anfitrión se anuncia con el nombre de la sala; los demás lo ven en «Salas cercanas». */
export function createNearbyHostTransport(roomName: string, hostName: string, hostPeerId: string): FramedHostTransport {
  const name = [roomName.slice(0, 32), hostName.slice(0, 24), hostPeerId.slice(0, NEARBY_TAG_LENGTH)].join(NAME_SEPARATOR);
  const transport = createFramedHostTransport({
    start: async () => {
      await ensureHub();
      host = transport;
      await LocalRoom.nearbyStartAdvertising({ name });
    },
    stop: async () => {
      if (host === transport) host = null;
      await LocalRoom.nearbyStopAll();
    },
    send: (endpointId, data) => void LocalRoom.nearbySend({ endpointId, data }).catch(() => undefined),
  });
  return transport;
}

/* ------------------------------------------------------------------ Invitado */

/**
 * Busca salas cercanas. Devuelve la función para dejar de buscar (se llama al elegir una sala o
 * al salir de la pantalla: buscar gasta batería).
 */
export async function startNearbyDiscovery(onChange: (rooms: NearbyRoom[]) => void): Promise<() => void> {
  await ensureHub();
  const rooms = new Map<string, NearbyRoom>();
  const listener = {
    found: (room: NearbyRoom) => {
      rooms.set(room.endpointId, room);
      onChange([...rooms.values()]);
    },
    lost: (endpointId: string) => {
      if (rooms.delete(endpointId)) onChange([...rooms.values()]);
    },
  };
  discoveryListener = listener;
  await LocalRoom.nearbyStartDiscovery();
  return () => {
    if (discoveryListener === listener) discoveryListener = null;
    void LocalRoom.nearbyStopDiscovery().catch(() => undefined);
  };
}

/** Transporte del invitado hacia una sala cercana (se conecta, o reconecta, al primer uso). */
export function createNearbyGuestTransport(endpointId: string, myName: string): FramedGuestTransport {
  const transport = createFramedGuestTransport({
    connect: async () => {
      await ensureHub();
      guests.set(endpointId, transport);
      await LocalRoom.nearbyConnect({ endpointId, name: myName.slice(0, 40) });
    },
    send: (data) => void LocalRoom.nearbySend({ endpointId, data }).catch(() => undefined),
    disconnect: () => {
      guests.delete(endpointId);
      void LocalRoom.nearbyDisconnect({ endpointId }).catch(() => undefined);
    },
  });
  return transport;
}
