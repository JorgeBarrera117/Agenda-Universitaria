import { isRecord, type GuestStreamHandlers, type GuestTransport, type HostTransport, type HostTransportHandlers } from './roomProtocol';

/**
 * Tramas de la Sala Local sobre un canal de mensajes (Google Nearby Connections).
 *
 * Nearby no es HTTP: entrega mensajes de texto entre teléfonos. Para reutilizar TODO lo demás
 * (motor del anfitrión, PIN, cifrado, chats privados y bloques de archivos con progreso), aquí se
 * imitan las dos piezas que usa la red local:
 * - petición → respuesta (POST /room/v1/rpc): tramas req / res con un número de petición;
 * - conexión de eventos (SSE): tramas open / data / end con un id de conexión.
 * Los cuerpos viajan tal cual, ya cifrados por roomProtocol/roomCrypto.
 *
 * Este módulo no sabe nada de Android: recibe un canal (send / mensajes / desconexiones), así que
 * se prueba en Node con un canal en memoria.
 */

type Frame =
  | { t: 'req'; id: number; body: string }
  | { t: 'res'; id: number; s: number; b: string }
  | { t: 'open'; sid: string; q: string }
  | { t: 'data'; sid: string; d: string }
  | { t: 'end'; sid: string }
  | { t: 'close'; sid: string };

function parseFrame(raw: string): Frame | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.t !== 'string') return null;
  const str = (key: string): string | null => (typeof value[key] === 'string' ? (value[key] as string) : null);
  const num = (key: string): number | null => (typeof value[key] === 'number' ? (value[key] as number) : null);
  switch (value.t) {
    case 'req': {
      const id = num('id');
      const body = str('body');
      return id !== null && body !== null ? { t: 'req', id, body } : null;
    }
    case 'res': {
      const id = num('id');
      const s = num('s');
      const b = str('b');
      return id !== null && s !== null && b !== null ? { t: 'res', id, s, b } : null;
    }
    case 'open': {
      const sid = str('sid');
      const q = str('q');
      return sid !== null && q !== null ? { t: 'open', sid, q } : null;
    }
    case 'data': {
      const sid = str('sid');
      const d = str('d');
      return sid !== null && d !== null ? { t: 'data', sid, d } : null;
    }
    case 'end':
    case 'close': {
      const sid = str('sid');
      return sid !== null ? { t: value.t, sid } : null;
    }
    default:
      return null;
  }
}

function frame(value: Frame): string {
  return JSON.stringify(value);
}

/* ================================================================================ Anfitrión */

/** Canal del anfitrión: enviar a un teléfono y arrancar/parar el anuncio. */
export interface HostLink {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  send: (endpointId: string, data: string) => void;
}

/** Transporte del anfitrión por tramas. El canal le entrega los mensajes con handleMessage. */
export interface FramedHostTransport extends HostTransport {
  handleMessage: (endpointId: string, data: string) => void;
  handleDisconnected: (endpointId: string) => void;
}

export function createFramedHostTransport(link: HostLink): FramedHostTransport {
  let handlers: HostTransportHandlers | null = null;
  /** streamId del motor → teléfono y id de conexión del teléfono. */
  const streams = new Map<string, { endpointId: string; sid: string }>();
  // Los ids del motor incluyen el teléfono: dos teléfonos pueden usar el mismo número de petición
  const key = (endpointId: string, local: string | number) => `${endpointId}|${local}`;
  const split = (value: string): [string, string] => {
    const cut = value.lastIndexOf('|');
    return [value.slice(0, cut), value.slice(cut + 1)];
  };

  return {
    async start(next) {
      handlers = next;
      await link.start();
      return { port: 0, hosts: [] };
    },
    async stop() {
      handlers = null;
      streams.clear();
      await link.stop();
    },
    respond(requestId, status, body) {
      const [endpointId, id] = split(requestId);
      link.send(endpointId, frame({ t: 'res', id: Number(id), s: status, b: body }));
    },
    push(streamId, data) {
      const target = streams.get(streamId);
      if (target) link.send(target.endpointId, frame({ t: 'data', sid: target.sid, d: data }));
    },
    closeStream(streamId) {
      const target = streams.get(streamId);
      if (!target) return;
      streams.delete(streamId);
      link.send(target.endpointId, frame({ t: 'end', sid: target.sid }));
    },
    handleMessage(endpointId, data) {
      const message = parseFrame(data);
      if (!message || !handlers) return;
      if (message.t === 'req') {
        handlers.onRequest({ id: key(endpointId, message.id), body: message.body, remote: `nearby:${endpointId}` });
      } else if (message.t === 'open') {
        const streamId = key(endpointId, message.sid);
        streams.set(streamId, { endpointId, sid: message.sid });
        handlers.onStreamOpen({ streamId, query: message.q, remote: `nearby:${endpointId}` });
      } else if (message.t === 'close') {
        const streamId = key(endpointId, message.sid);
        if (streams.delete(streamId)) handlers.onStreamClosed(streamId);
      }
    },
    handleDisconnected(endpointId) {
      for (const [streamId, target] of [...streams]) {
        if (target.endpointId !== endpointId) continue;
        streams.delete(streamId);
        handlers?.onStreamClosed(streamId);
      }
    },
  };
}

/* ================================================================================ Invitado */

/** Canal del invitado hacia un anfitrión: conectar (o reconectar), enviar y cortar. */
export interface GuestLink {
  connect: () => Promise<void>;
  send: (data: string) => void;
  disconnect: () => void;
}

export interface FramedGuestTransport extends GuestTransport {
  dispose: () => void;
  handleMessage: (data: string) => void;
  handleDisconnected: () => void;
}

export function createFramedGuestTransport(link: GuestLink): FramedGuestTransport {
  let nextId = 1;
  let nextSid = 1;
  const pending = new Map<number, { resolve: (r: { status: number; body: string }) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const streams = new Map<string, GuestStreamHandlers>();
  let connection: Promise<void> | null = null;

  // Una sola conexión a la vez; si se cortó, la próxima petición vuelve a conectar
  const ensureConnected = (): Promise<void> => {
    if (!connection) {
      connection = link.connect().catch((err: unknown) => {
        connection = null;
        throw err instanceof Error ? err : new Error(String(err));
      });
    }
    return connection;
  };

  const failAll = (reason: string) => {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
      pending.delete(id);
    }
    for (const [sid, handlers] of [...streams]) {
      streams.delete(sid);
      handlers.onEnd(reason);
    }
  };

  return {
    async request(_url, body, timeoutMs) {
      await ensureConnected();
      return new Promise((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('timeout'));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        link.send(frame({ t: 'req', id, body }));
      });
    },
    async openStream(url, handlers) {
      await ensureConnected();
      const sid = String(nextSid);
      nextSid += 1;
      streams.set(sid, handlers);
      link.send(frame({ t: 'open', sid, q: url.split('?')[1] ?? '' }));
      return () => {
        if (!streams.delete(sid)) return;
        link.send(frame({ t: 'close', sid }));
      };
    },
    dispose() {
      failAll('closed');
      connection = null;
      link.disconnect();
    },
    handleMessage(data) {
      const message = parseFrame(data);
      if (!message) return;
      if (message.t === 'res') {
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id);
        clearTimeout(entry.timer);
        entry.resolve({ status: message.s, body: message.b });
      } else if (message.t === 'data') {
        streams.get(message.sid)?.onData(message.d);
      } else if (message.t === 'end') {
        const handlers = streams.get(message.sid);
        streams.delete(message.sid);
        handlers?.onEnd();
      }
    },
    handleDisconnected() {
      connection = null;
      failAll('disconnected');
    },
  };
}

/* ================================================================================ Anfitrión combinado */

/**
 * Abre la sala por la red local y por cercanía a la vez: el mismo motor recibe peticiones de los
 * dos lados. Los ids llevan un prefijo para saber por cuál responder. Si no hay wifi pero sí
 * cercanía (o al revés), la sala abre igual con el canal que funcione.
 */
export function combineHostTransports(lan: HostTransport, nearby: HostTransport): HostTransport & { nearbyActive: () => boolean } {
  let lanUp = false;
  let nearbyUp = false;
  const wrap = (prefix: string, handlers: HostTransportHandlers): HostTransportHandlers => ({
    onRequest: (r) => handlers.onRequest({ ...r, id: prefix + r.id }),
    onStreamOpen: (s) => handlers.onStreamOpen({ ...s, streamId: prefix + s.streamId }),
    onStreamClosed: (id) => handlers.onStreamClosed(prefix + id),
    onStopped: (reason) => {
      if (prefix === 'l:') lanUp = false;
      else nearbyUp = false;
      // La sala solo se cae si ya no queda ningún canal
      if (!lanUp && !nearbyUp) handlers.onStopped(reason);
    },
  });
  const route = (id: string): [HostTransport, string] => (id.startsWith('n:') ? [nearby, id.slice(2)] : [lan, id.slice(2)]);

  return {
    async start(handlers) {
      const [lanResult, nearbyResult] = await Promise.allSettled([lan.start(wrap('l:', handlers)), nearby.start(wrap('n:', handlers))]);
      lanUp = lanResult.status === 'fulfilled';
      nearbyUp = nearbyResult.status === 'fulfilled';
      if (!lanUp && !nearbyUp) {
        const reason = lanResult.status === 'rejected' ? lanResult.reason : null;
        throw reason instanceof Error ? reason : new Error('No se pudo abrir la sala.');
      }
      const info = lanResult.status === 'fulfilled' ? lanResult.value : { port: 0, hosts: [] };
      return { ...info, nearby: nearbyUp };
    },
    async stop() {
      await Promise.allSettled([lanUp ? lan.stop() : Promise.resolve(), nearbyUp ? nearby.stop() : Promise.resolve()]);
      lanUp = false;
      nearbyUp = false;
    },
    respond(id, status, body) {
      const [target, local] = route(id);
      target.respond(local, status, body);
    },
    push(id, data) {
      const [target, local] = route(id);
      target.push(local, data);
    },
    closeStream(id) {
      const [target, local] = route(id);
      target.closeStream(local);
    },
    nearbyActive: () => nearbyUp,
  };
}
