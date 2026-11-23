import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { LocalRoom } from '../../../shared/plugins/localRoom';
import { randomToken } from './roomCrypto';
import { isRecord, type GuestStreamHandlers, type GuestTransport, type HostTransport, type HostTransportHandlers } from './roomProtocol';

/**
 * Transportes de la sala según la plataforma:
 * - Android: LocalRoomPlugin (servidor Java y cliente HTTP/SSE nativo).
 * - Windows: proceso principal de Electron (roomServer.cjs y su cliente).
 * - Desarrollo en el navegador: BroadcastChannel entre pestañas (solo con `npm run dev`).
 * La PWA publicada no puede abrir ni unirse a salas: el navegador no deja abrir servidores y su
 * política de seguridad bloquea http:// hacia la red local.
 */

type Platform = 'android' | 'electron' | 'dev' | 'none';

function roomPlatform(): Platform {
  if (Capacitor.getPlatform() === 'android') return 'android';
  if (typeof window !== 'undefined' && window.electronAPI?.roomHostStart) return 'electron';
  if (import.meta.env.DEV && typeof BroadcastChannel !== 'undefined') return 'dev';
  return 'none';
}

export function isLocalRoomAvailable(): boolean {
  return roomPlatform() !== 'none';
}

function noLanMessage(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/NO_LAN/i.test(message)) return new Error('Conéctate a una red wifi o activa el punto de acceso para abrir la sala.');
  return error instanceof Error ? error : new Error(message);
}

/* ================================================================================ Android */

function androidHostTransport(): HostTransport {
  let handles: Promise<PluginListenerHandle>[] = [];
  const removeAll = () => {
    for (const handle of handles) void handle.then((h) => h.remove());
    handles = [];
  };
  return {
    async start(handlers: HostTransportHandlers) {
      handles = [
        LocalRoom.addListener('roomRequest', (e) => handlers.onRequest(e)),
        LocalRoom.addListener('roomStreamOpen', (e) => handlers.onStreamOpen(e)),
        LocalRoom.addListener('roomStreamClosed', (e) => handlers.onStreamClosed(e.streamId)),
        LocalRoom.addListener('roomStopped', (e) => {
          removeAll();
          handlers.onStopped(e.reason);
        }),
      ];
      try {
        return await LocalRoom.startServer();
      } catch (error) {
        removeAll();
        throw noLanMessage(error);
      }
    },
    async stop() {
      removeAll();
      await LocalRoom.stopServer();
    },
    respond: (id, status, body) => void LocalRoom.respond({ id, status, body }).catch(() => undefined),
    push: (streamId, data) => void LocalRoom.push({ streamId, data }).catch(() => undefined),
    closeStream: (streamId) => void LocalRoom.closeStream({ streamId }).catch(() => undefined),
  };
}

function androidGuestTransport(): GuestTransport {
  const streams = new Map<string, GuestStreamHandlers>();
  let handles: Promise<PluginListenerHandle>[] = [];
  const ensureListeners = () => {
    if (handles.length > 0) return;
    handles = [
      LocalRoom.addListener('roomClientData', (e) => streams.get(e.streamId)?.onData(e.data)),
      LocalRoom.addListener('roomClientEnd', (e) => {
        const handlers = streams.get(e.streamId);
        streams.delete(e.streamId);
        handlers?.onEnd(e.error);
      }),
    ];
  };
  return {
    request: (url, body, timeoutMs) => LocalRoom.clientRequest({ url, body, timeoutMs }),
    async openStream(url, handlers) {
      ensureListeners();
      const streamId = randomToken(9);
      streams.set(streamId, handlers);
      await LocalRoom.clientOpenStream({ url, streamId });
      return () => {
        streams.delete(streamId);
        void LocalRoom.clientCloseStream({ streamId }).catch(() => undefined);
      };
    },
  };
}

/* ================================================================================ Windows (Electron) */

function electronHostTransport(): HostTransport {
  const api = window.electronAPI;
  if (!api) throw new Error('Electron no disponible');
  let unsubscribe: (() => void) | null = null;
  return {
    async start(handlers) {
      unsubscribe = api.onRoomHostEvent((event) => {
        switch (event.type) {
          case 'request':
            handlers.onRequest(event);
            break;
          case 'streamOpen':
            handlers.onStreamOpen(event);
            break;
          case 'streamClosed':
            handlers.onStreamClosed(event.streamId);
            break;
          case 'stopped':
            unsubscribe?.();
            unsubscribe = null;
            handlers.onStopped(event.reason);
            break;
        }
      });
      try {
        return await api.roomHostStart();
      } catch (error) {
        unsubscribe?.();
        unsubscribe = null;
        throw noLanMessage(error);
      }
    },
    async stop() {
      unsubscribe?.();
      unsubscribe = null;
      await api.roomHostStop();
    },
    respond: (id, status, body) => void api.roomHostRespond({ id, status, body }).catch(() => undefined),
    push: (streamId, data) => void api.roomHostPush({ streamId, data }).catch(() => undefined),
    closeStream: (streamId) => void api.roomHostCloseStream({ streamId }).catch(() => undefined),
  };
}

function electronGuestTransport(): GuestTransport {
  const api = window.electronAPI;
  if (!api) throw new Error('Electron no disponible');
  const streams = new Map<string, GuestStreamHandlers>();
  let unsubscribe: (() => void) | null = null;
  return {
    request: (url, body, timeoutMs) => api.roomClientRequest({ url, body, timeoutMs }),
    async openStream(url, handlers) {
      if (!unsubscribe) {
        unsubscribe = api.onRoomClientEvent((event) => {
          if (event.type === 'data') {
            streams.get(event.streamId)?.onData(event.data);
          } else {
            const target = streams.get(event.streamId);
            streams.delete(event.streamId);
            target?.onEnd(event.error);
          }
        });
      }
      const streamId = randomToken(9);
      streams.set(streamId, handlers);
      await api.roomClientOpenStream({ url, streamId });
      return () => {
        streams.delete(streamId);
        void api.roomClientCloseStream({ streamId }).catch(() => undefined);
      };
    },
  };
}

/* ================================================================================ Desarrollo (pestañas) */

const DEV_CHANNEL = 'agenda-room-dev';

type DevMessage =
  | { k: 'req'; id: string; body: string; from: string }
  | { k: 'res'; id: string; status: number; body: string }
  | { k: 'open'; streamId: string; query: string; from: string }
  | { k: 'data'; streamId: string; data: string }
  | { k: 'close'; streamId: string }
  | { k: 'gclose'; streamId: string };

function parseDevMessage(value: unknown): DevMessage | null {
  if (!isRecord(value) || typeof value.k !== 'string') return null;
  const str = (key: string) => (typeof value[key] === 'string' ? (value[key] as string) : null);
  switch (value.k) {
    case 'req': {
      const id = str('id'), body = str('body'), from = str('from');
      return id !== null && body !== null && from !== null ? { k: 'req', id, body, from } : null;
    }
    case 'res': {
      const id = str('id'), body = str('body');
      return id !== null && body !== null && typeof value.status === 'number' ? { k: 'res', id, status: value.status, body } : null;
    }
    case 'open': {
      const streamId = str('streamId'), query = str('query'), from = str('from');
      return streamId !== null && query !== null && from !== null ? { k: 'open', streamId, query, from } : null;
    }
    case 'data': {
      const streamId = str('streamId'), data = str('data');
      return streamId !== null && data !== null ? { k: 'data', streamId, data } : null;
    }
    case 'close':
    case 'gclose': {
      const streamId = str('streamId');
      return streamId !== null ? { k: value.k, streamId } : null;
    }
    default:
      return null;
  }
}

function devHostTransport(): HostTransport {
  let channel: BroadcastChannel | null = null;
  const send = (message: DevMessage) => channel?.postMessage(message);
  return {
    async start(handlers) {
      channel = new BroadcastChannel(DEV_CHANNEL);
      channel.onmessage = (event: MessageEvent<unknown>) => {
        const message = parseDevMessage(event.data);
        if (!message) return;
        if (message.k === 'req') handlers.onRequest({ id: message.id, body: message.body, remote: message.from });
        if (message.k === 'open') handlers.onStreamOpen({ streamId: message.streamId, query: message.query, remote: message.from });
        if (message.k === 'gclose') handlers.onStreamClosed(message.streamId);
      };
      return { port: 0, hosts: ['dev'] };
    },
    async stop() {
      channel?.close();
      channel = null;
    },
    respond: (id, status, body) => send({ k: 'res', id, status, body }),
    push: (streamId, data) => send({ k: 'data', streamId, data }),
    closeStream: (streamId) => send({ k: 'close', streamId }),
  };
}

function devGuestTransport(): GuestTransport {
  const channel = new BroadcastChannel(DEV_CHANNEL);
  const tabId = randomToken(6);
  const pending = new Map<string, (response: { status: number; body: string }) => void>();
  const streams = new Map<string, GuestStreamHandlers>();
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = parseDevMessage(event.data);
    if (!message) return;
    if (message.k === 'res') {
      pending.get(message.id)?.({ status: message.status, body: message.body });
      pending.delete(message.id);
    }
    if (message.k === 'data') streams.get(message.streamId)?.onData(message.data);
    if (message.k === 'close') {
      const handlers = streams.get(message.streamId);
      streams.delete(message.streamId);
      handlers?.onEnd();
    }
  };
  return {
    request(_url, body, timeoutMs) {
      return new Promise((resolve, reject) => {
        const id = randomToken(9);
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('timeout'));
        }, timeoutMs);
        pending.set(id, (response) => {
          clearTimeout(timer);
          resolve(response);
        });
        channel.postMessage({ k: 'req', id, body, from: tabId } satisfies DevMessage);
      });
    },
    async openStream(url, handlers) {
      const streamId = randomToken(9);
      streams.set(streamId, handlers);
      channel.postMessage({ k: 'open', streamId, query: url.split('?')[1] ?? '', from: tabId } satisfies DevMessage);
      return () => {
        streams.delete(streamId);
        channel.postMessage({ k: 'gclose', streamId } satisfies DevMessage);
      };
    },
  };
}

/* ================================================================================ Selección */

export function createHostTransport(): HostTransport {
  switch (roomPlatform()) {
    case 'android':
      return androidHostTransport();
    case 'electron':
      return electronHostTransport();
    case 'dev':
      return devHostTransport();
    default:
      throw new Error('Las salas locales están disponibles en la app de Android y de Windows.');
  }
}

export function createGuestTransport(): GuestTransport {
  switch (roomPlatform()) {
    case 'android':
      return androidGuestTransport();
    case 'electron':
      return electronGuestTransport();
    case 'dev':
      return devGuestTransport();
    default:
      throw new Error('Las salas locales están disponibles en la app de Android y de Windows.');
  }
}
