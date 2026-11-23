'use strict';

/**
 * Sala de Intercambio Local (Windows).
 *
 * Anfitrión: servidor HTTP en la red local que es solo un puente. No entiende la sala: cada
 * petición POST /room/v1/rpc y cada conexión GET /room/v1/events (Server-Sent Events) se entrega a
 * la interfaz, donde vive el motor (src/features/localRoom/services/roomHostEngine.ts), que
 * responde con respond() y empuja eventos con push(). Todo lo que pasa por aquí ya va cifrado.
 *
 * Invitado: la interfaz no puede abrir http:// de la red local (política de seguridad), así que
 * este proceso hace las peticiones y mantiene la conexión SSE por ella.
 */

const http = require('http');
const crypto = require('crypto');
const { lanAddresses } = require('./transferServer.cjs');

const BASE_PATH = '/room/v1';
/**
 * Tope de UNA petición. Los elementos viajan por bloques de 512 KB (cifrados y en base64 ocupan
 * ~0,9 MB), así que no hay límite por archivo: este tope solo frena peticiones anómalas.
 */
const MAX_BODY_BYTES = 4 * 1024 * 1024;
/** La interfaz tiene este tiempo para responder una petición. */
const RESPONSE_TIMEOUT_MS = 30_000;
/** Comentario SSE periódico: mantiene viva la conexión y detecta a quien se fue. */
const HEARTBEAT_MS = 15_000;
const MAX_STREAMS = 80;

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store' });
  res.end(text);
}

function remoteOf(req) {
  return String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

/**
 * @param {(event: object) => void} onEvent request | streamOpen | streamClosed | stopped
 */
function createRoomHost(onEvent) {
  const pending = new Map(); // id → { res, timer }
  const streams = new Map(); // streamId → res
  let stopped = false;
  let heartbeat = null;

  const server = http.createServer((req, res) => {
    if (stopped) {
      sendJson(res, 410, { error: 'gone' });
      return;
    }
    const [path, query = ''] = String(req.url || '').split('?');

    if (path === BASE_PATH + '/rpc' && req.method === 'POST') {
      const chunks = [];
      let size = 0;
      let aborted = false;
      req.on('data', (chunk) => {
        if (aborted) return;
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          aborted = true;
          sendJson(res, 413, { error: 'too-large' });
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (aborted || stopped) return;
        const id = crypto.randomBytes(9).toString('base64url');
        const timer = setTimeout(() => {
          pending.delete(id);
          sendJson(res, 504, { error: 'bad-request' });
        }, RESPONSE_TIMEOUT_MS);
        pending.set(id, { res, timer });
        onEvent({ type: 'request', id, body: Buffer.concat(chunks).toString('utf8'), remote: remoteOf(req) });
      });
      return;
    }

    if (path === BASE_PATH + '/events' && req.method === 'GET') {
      if (streams.size >= MAX_STREAMS) {
        sendJson(res, 503, { error: 'full' });
        return;
      }
      const streamId = crypto.randomBytes(9).toString('base64url');
      req.socket.setKeepAlive(true);
      req.socket.setNoDelay(true);
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': ok\n\n');
      streams.set(streamId, res);
      const closed = () => {
        if (streams.get(streamId) !== res) return;
        streams.delete(streamId);
        onEvent({ type: 'streamClosed', streamId });
      };
      req.on('close', closed);
      res.on('error', closed);
      onEvent({ type: 'streamOpen', streamId, query, remote: remoteOf(req) });
      return;
    }

    sendJson(res, 404, { error: 'not-found' });
  });

  function respond(id, status, body) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    const code = Number.isInteger(status) && status >= 200 && status < 600 ? status : 500;
    const text = typeof body === 'string' ? body : '';
    entry.res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store' });
    entry.res.end(text);
  }

  function push(streamId, data) {
    const res = streams.get(streamId);
    if (!res || typeof data !== 'string') return;
    // Una sola línea (base64): no puede romper el formato SSE
    res.write('data: ' + data.replace(/[\r\n]/g, '') + '\n\n');
  }

  function closeStream(streamId) {
    const res = streams.get(streamId);
    if (!res) return;
    streams.delete(streamId);
    res.end();
  }

  function stop(reason) {
    if (stopped) return;
    stopped = true;
    if (heartbeat) clearInterval(heartbeat);
    for (const { res, timer } of pending.values()) {
      clearTimeout(timer);
      sendJson(res, 410, { error: 'gone' });
    }
    pending.clear();
    for (const res of streams.values()) res.end();
    streams.clear();
    server.close();
    setTimeout(() => server.closeAllConnections?.(), 500).unref?.();
    if (reason) onEvent({ type: 'stopped', reason });
  }

  const hosts = lanAddresses();
  if (hosts.length === 0) {
    const error = new Error('NO_LAN');
    error.code = 'NO_LAN';
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (!stopped) reject(err);
    });
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.on('error', (err) => stop(String((err && err.message) || 'error de red')));
      heartbeat = setInterval(() => {
        for (const res of streams.values()) res.write(': ping\n\n');
      }, HEARTBEAT_MS);
      resolve({ info: { port, hosts }, respond, push, closeStream, stop: () => stop(null) });
    });
  });
}

/* ------------------------------------------------------------------ Invitado */

/** Solo direcciones privadas de la red local: el proceso principal no sirve de proxy a internet. */
function checkLanUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:') throw new Error('URL no válida');
  const parts = parsed.hostname.split('.').map(Number);
  const [a, b] = parts;
  const ok = parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) && (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
  if (!ok || !parsed.pathname.startsWith(BASE_PATH + '/')) throw new Error('URL no válida');
  return parsed;
}

function clientRequest(url, body, timeoutMs) {
  const parsed = checkLanUrl(url);
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(String(body), 'utf8');
    const req = http.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length } },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            req.destroy(new Error('too-large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      }
    );
    req.setTimeout(Math.min(Math.max(Number(timeoutMs) || 20_000, 1_000), 120_000), () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(payload);
  });
}

/**
 * Conexiones SSE del invitado.
 * @param {(event: object) => void} onEvent data | end
 */
function createRoomClient(onEvent) {
  const streams = new Map(); // streamId → req

  function openStream(url, streamId) {
    const parsed = checkLanUrl(url);
    if (typeof streamId !== 'string' || !streamId || streams.has(streamId)) throw new Error('Conexión no válida');
    let finished = false;
    const end = (error) => {
      if (finished) return;
      finished = true;
      streams.delete(streamId);
      onEvent({ type: 'end', streamId, error });
    };
    const req = http.get({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, headers: { Accept: 'text/event-stream' } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        end('status ' + res.statusCode);
        return;
      }
      res.setEncoding('utf8');
      let buffer = '';
      let dataLines = [];
      res.on('data', (chunk) => {
        buffer += chunk;
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).replace(/\r$/, '');
          buffer = buffer.slice(index + 1);
          if (line === '') {
            if (dataLines.length > 0) onEvent({ type: 'data', streamId, data: dataLines.join('') });
            dataLines = [];
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart());
          }
        }
        if (buffer.length > MAX_BODY_BYTES) req.destroy(new Error('too-large'));
      });
      res.on('end', () => end());
      res.on('error', (err) => end(String(err && err.message)));
    });
    // Sin latido en 45 s (el anfitrión lo manda cada 15 s): la conexión murió
    req.setTimeout(45_000, () => req.destroy(new Error('timeout')));
    req.on('error', (err) => end(String(err && err.message)));
    req.on('close', () => end());
    streams.set(streamId, req);
  }

  function closeStream(streamId) {
    const req = streams.get(streamId);
    if (!req) return;
    streams.delete(streamId);
    req.destroy();
  }

  function closeAll() {
    for (const req of streams.values()) req.destroy();
    streams.clear();
  }

  return { openStream, closeStream, closeAll };
}

module.exports = { createRoomHost, createRoomClient, clientRequest };
