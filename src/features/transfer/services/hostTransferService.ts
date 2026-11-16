import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { ElectronTransferEvent, ElectronTransferSessionInfo } from '../../../electron';
import { WidgetBridge } from '../../../shared/plugins/widgetBridge';
import { generateBackupData } from '../../../shared/utils/backup';
import { createTransferKey, sealTransferPayload } from './transferCrypto';
import { buildInviteText, type TransferDirection, type TransferInvite } from './transferProtocol';

/**
 * Lado del anfitrión, el dispositivo que muestra el QR:
 * - la app de Windows (Electron, electron/transferServer.cjs);
 * - un teléfono Android (LocalTransferServer.java).
 *
 * Los dos hablan el mismo protocolo, así que cualquier dispositivo puede escanear el QR de otro.
 * Aquí se crea la clave, se cifran los datos (si el anfitrión envía) y se abre el servidor
 * temporal. Devuelve lo que se dibuja en el QR.
 */

export type HostTransferEvent = ElectronTransferEvent;

export interface HostTransferSession {
  invite: TransferInvite;
  inviteText: string;
  /** Nombre de este dispositivo (lo verá el otro al conectarse). */
  hostName: string;
  expiresAt: number;
}

interface HostBackend {
  start(options: { mode: 'receive' | 'send'; payload?: string }): Promise<ElectronTransferSessionInfo>;
  stop(): void;
  onEvent(callback: (event: HostTransferEvent) => void): () => void;
}

const electronBackend: HostBackend = {
  start: (options) => {
    const api = window.electronAPI;
    if (!api?.startTransfer) return Promise.reject(new Error('Esta función solo está en la app de Windows.'));
    return api.startTransfer(options);
  },
  stop: () => void window.electronAPI?.stopTransfer?.(),
  onEvent: (callback) => window.electronAPI?.onTransferEvent?.(callback) ?? (() => undefined),
};

function toHostEvent(raw: { type: string; payload?: string }): HostTransferEvent | null {
  switch (raw.type) {
    case 'connected':
    case 'sent':
    case 'expired':
    case 'blocked':
      return { type: raw.type };
    case 'received':
      return typeof raw.payload === 'string' ? { type: 'received', payload: raw.payload } : null;
    case 'error':
      return { type: 'error', message: 'Falló la conexión.' };
    default:
      return null;
  }
}

const androidBackend: HostBackend = {
  start: (options) => WidgetBridge.startTransferServer(options),
  stop: () => void WidgetBridge.stopTransferServer().catch(() => undefined),
  onEvent: (callback) => {
    let handle: PluginListenerHandle | null = null;
    let removed = false;
    void WidgetBridge.addListener('transferEvent', (raw) => {
      const event = toHostEvent(raw);
      if (event) callback(event);
    }).then((h) => {
      if (removed) void h.remove();
      else handle = h;
    });
    return () => {
      removed = true;
      void handle?.remove();
    };
  },
};

function backend(): HostBackend | null {
  if (typeof window !== 'undefined' && typeof window.electronAPI?.startTransfer === 'function') return electronBackend;
  if (Capacitor.getPlatform() === 'android') return androidBackend;
  return null;
}

export async function startHostTransfer(direction: TransferDirection): Promise<HostTransferSession> {
  const host = backend();
  if (!host) throw new Error('Esta función solo está en las apps de Windows y Android.');

  const key = createTransferKey();
  let payload: string | undefined;
  if (direction === 'to-phone') {
    const { jsonString } = await generateBackupData({ includeDocuments: true });
    payload = await sealTransferPayload(jsonString, key, 'to-phone');
  }

  const info = await host.start({ mode: direction === 'to-pc' ? 'receive' : 'send', payload });
  const invite: TransferInvite = { direction, hosts: info.hosts, port: info.port, token: info.token, key };
  return { invite, inviteText: buildInviteText(invite), hostName: info.pcName, expiresAt: info.expiresAt };
}

export function stopHostTransfer(): void {
  backend()?.stop();
}

export function onHostTransferEvent(callback: (event: HostTransferEvent) => void): () => void {
  return backend()?.onEvent(callback) ?? (() => undefined);
}
