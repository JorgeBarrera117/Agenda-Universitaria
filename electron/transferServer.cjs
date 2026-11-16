'use strict';

/**
 * Pasar datos entre el teléfono y la PC por la red local (wifi), sin internet.
 *
 * La PC abre un servidor HTTP temporal que solo vive mientras está abierta la pantalla de
 * transferencia (5 minutos como máximo) y atiende una sola transferencia. El código QR que muestra
 * la interfaz lleva la dirección, el puerto y un token de un solo uso; el teléfono lo escanea y se
 * conecta directamente.
 *
 * Este proceso NUNCA ve los datos en claro: la interfaz los cifra (AES-256-GCM) con una clave que
 * solo viaja dentro del QR, así que aquí únicamente pasa texto cifrado.
 */

const http = require('http');
const os = require('os');
const crypto = require('crypto');

const BASE_PATH = '/agenda-transfer/v1';
const SESSION_TTL_MS = 5 * 60_000;
/** Tope del cuerpo recibido (texto base64 del respaldo cifrado). */
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;
/** Tras tantas peticiones con un token incorrecto, la sesión se cierra. */
const MAX_BAD_REQUESTS = 20;
const MAX_HOSTS = 4;

/** Adaptadores virtuales (WSL, Hyper-V, VirtualBox…): sus direcciones se prueban al final. */
const VIRTUAL_ADAPTER = /vethernet|virtualbox|vmware|hyper-v|wsl|loopback|bluetooth|tailscale|zerotier|docker/i;

function isPrivateIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Direcciones IPv4 privadas de esta PC, las más probables (wifi/ethernet real) primero. */
function lanAddresses() {
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const entry of list || []) {
      const isV4 = entry.family === 'IPv4' || entry.family === 4;
      if (!isV4 || entry.internal || !isPrivateIPv4(entry.address)) continue;
      const virtual = VIRTUAL_ADAPTER.test(name);
      const rank = (virtual ? 10 : 0) + (entry.address.startsWith('192.168.') ? 0 : entry.address.startsWith('10.') ? 1 : 2);
      found.push({ address: entry.address, rank });
    }
  }
  found.sort((x, y) => x.rank - y.rank);
  return [...new Set(found.map((f) => f.address))].slice(0, MAX_HOSTS);
}

function tokensMatch(expected, received) {
  if (typeof received !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

/**
 * Abre una sesión de transferencia.
 * @param {{ mode: 'receive' | 'send', payload?: string, onEvent: (event: object) => void }} options
 *   receive: el teléfono sube sus datos a la PC. send: la PC entrega `payload` (ya cifrado) al teléfono.
 * @returns {Promise<{ info: { port: number, hosts: string[], token: string, pcName: string, expiresAt: number }, stop: () => void }>}
 */
function createTransferSession({ mode, payload, onEvent }) {
  if (mode !== 'receive' && mode !== 'send') throw new Error('Modo de transferencia no válido');
  if (mode === 'send' && (typeof payload !== 'string' || payload.length === 0)) {
    throw new Error('No hay datos para enviar');
  }

  const hosts = lanAddresses();
  if (hosts.length === 0) {
    const error = new Error('Esta computadora no está conectada a una red local (wifi o cable).');
    error.code = 'NO_LAN';
    throw error;
  }

  const token = crypto.randomBytes(18).toString('base64url');
  const pcName = os.hostname();
  let finished = false;
  let busy = false;
  let badRequests = 0;
  let expiryTimer = null;

  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (finished) {
      sendJson(res, 410, { error: 'closed' });
      return;
    }

    const path = (req.url || '').split('?')[0];
    if (!path.startsWith(BASE_PATH + '/')) {
      sendJson(res, 404, { error: 'not-found' });
      return;
    }
    if (!tokensMatch(token, req.headers['x-agenda-token'])) {
      badRequests += 1;
      sendJson(res, 403, { error: 'forbidden' });
      if (badRequests >= MAX_BAD_REQUESTS) finish({ type: 'blocked' });
      return;
    }

    const route = path.slice(BASE_PATH.length);

    if (route === '/hello' && req.method === 'GET') {
      sendJson(res, 200, { app: 'agenda-universitaria', mode, pcName });
      onEvent({ type: 'connected' });
      return;
    }

    if (route === '/upload' && req.method === 'POST' && mode === 'receive') {
      if (busy) {
        sendJson(res, 409, { error: 'busy' });
        return;
      }
      busy = true;
      const chunks = [];
      let size = 0;
      let aborted = false;
      req.on('data', (chunk) => {
        if (aborted) return;
        size += chunk.length;
        if (size > MAX_UPLOAD_BYTES) {
          aborted = true;
          busy = false;
          sendJson(res, 413, { error: 'too-large' });
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (aborted) return;
        const body = Buffer.concat(chunks).toString('utf8');
        sendJson(res, 200, { ok: true });
        finish({ type: 'received', payload: body });
      });
      req.on('error', () => {
        busy = false;
      });
      return;
    }

    if (route === '/download' && req.method === 'GET' && mode === 'send') {
      if (busy) {
        sendJson(res, 409, { error: 'busy' });
        return;
      }
      busy = true;
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
      res.on('finish', () => finish({ type: 'sent' }));
      res.on('close', () => {
        // Conexión cortada antes de terminar: se permite reintentar mientras la sesión siga abierta
        if (!res.writableFinished) busy = false;
      });
      res.end(payload);
      return;
    }

    sendJson(res, 404, { error: 'not-found' });
  });

  function finish(event) {
    if (finished) return;
    finished = true;
    if (expiryTimer) clearTimeout(expiryTimer);
    server.close();
    // Las conexiones en curso ya respondieron; las que quedan abiertas se cierran
    setTimeout(() => server.closeAllConnections?.(), 1000).unref?.();
    if (event) onEvent(event);
  }

  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (!finished) reject(err);
    });
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const expiresAt = Date.now() + SESSION_TTL_MS;
      expiryTimer = setTimeout(() => finish({ type: 'expired' }), SESSION_TTL_MS);
      server.on('error', (err) => finish({ type: 'error', message: String(err && err.message) }));
      resolve({
        info: { port, hosts, token, pcName, expiresAt },
        stop: () => finish(null),
      });
    });
  });
}

module.exports = { createTransferSession, lanAddresses, isPrivateIPv4, BASE_PATH };
