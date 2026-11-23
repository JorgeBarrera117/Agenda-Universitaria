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

  addListener(eventName: 'roomRequest', listener: (event: { id: string; body: string; remote: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomStreamOpen', listener: (event: { streamId: string; query: string; remote: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomStreamClosed', listener: (event: { streamId: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomStopped', listener: (event: { reason: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomClientData', listener: (event: { streamId: string; data: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'roomClientEnd', listener: (event: { streamId: string; error?: string }) => void): Promise<PluginListenerHandle>;
}

export const LocalRoom = registerPlugin<LocalRoomPlugin>('LocalRoom');
