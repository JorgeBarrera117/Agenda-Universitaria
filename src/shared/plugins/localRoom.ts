import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Puente nativo de la Sala de Intercambio Local en Android (LocalRoomPlugin.java).
 * - Anfitrión: servidor HTTP con SSE en la red local; cada petición y conexión llega como evento.
 * - Invitado: HTTP y SSE nativos, porque la app corre en https://localhost y el WebView bloquea
 *   las conexiones http:// a la red local (contenido mixto).
 */
export interface LocalRoomPlugin {
  startServer(): Promise<{ port: number; hosts: string[] }>;
  stopServer(): Promise<void>;
  respond(options: { id: string; status: number; body: string }): Promise<void>;
  push(options: { streamId: string; data: string }): Promise<void>;
  closeStream(options: { streamId: string }): Promise<void>;

  clientRequest(options: { url: string; body: string; timeoutMs: number }): Promise<{ status: number; body: string }>;
  clientOpenStream(options: { url: string; streamId: string }): Promise<void>;
  clientCloseStream(options: { streamId: string }): Promise<void>;

  /* Por cercanía (Google Nearby Connections: Bluetooth y Wi-Fi Direct, sin red wifi) */
  /** permission: anunciar una sala · discoveryPermission: buscar salas (incluye ubicación precisa). */
  nearbyStatus(): Promise<{ available: boolean; permission: NearbyPermission; discoveryPermission: NearbyPermission }>;
  requestNearbyPermissions(options: { purpose: NearbyPurpose }): Promise<{ permission: NearbyPermission }>;
  nearbyStartAdvertising(options: { name: string }): Promise<void>;
  nearbyStartDiscovery(): Promise<void>;
  nearbyStopDiscovery(): Promise<void>;
  nearbyConnect(options: { endpointId: string; name: string }): Promise<void>;
  nearbySend(options: { endpointId: string; data: string }): Promise<void>;
  nearbyDisconnect(options: { endpointId: string }): Promise<void>;
  nearbyStopAll(): Promise<void>;

  addListener(eventName: 'roomRequest', listener: (event: { id: string; body: string; remote: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomStreamOpen', listener: (event: { streamId: string; query: string; remote: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomStreamClosed', listener: (event: { streamId: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomStopped', listener: (event: { reason: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomClientData', listener: (event: { streamId: string; data: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomClientEnd', listener: (event: { streamId: string; error?: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'nearbyFound', listener: (event: { endpointId: string; name: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'nearbyLost', listener: (event: { endpointId: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'nearbyConnected', listener: (event: { endpointId: string; name: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'nearbyDisconnected', listener: (event: { endpointId: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'nearbyMessage', listener: (event: { endpointId: string; data: string }) => void): Promise<PluginListenerHandle>;
}

/** granted: listo · prompt: se puede pedir · denied: negado, hay que activarlo en Ajustes del teléfono. */
export type NearbyPermission = 'granted' | 'prompt' | 'denied';

/** host: abrir una sala y anunciarla · guest: buscar salas cercanas. */
export type NearbyPurpose = 'host' | 'guest';

export const LocalRoom = registerPlugin<LocalRoomPlugin>('LocalRoom');
