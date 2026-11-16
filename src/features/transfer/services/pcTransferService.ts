import type { ElectronTransferEvent } from '../../../electron';
import { generateBackupData } from '../../../shared/utils/backup';
import { createTransferKey, sealTransferPayload } from './transferCrypto';
import { buildInviteText, type TransferDirection, type TransferInvite } from './transferProtocol';

/**
 * Lado de la PC (app de Windows): crea la clave, cifra los datos si es la PC la que envía y le pide
 * al proceso principal que abra el servidor temporal. Devuelve lo que se dibuja en el QR.
 */
export interface PcTransferSession {
  invite: TransferInvite;
  inviteText: string;
  pcName: string;
  expiresAt: number;
}

export async function startPcTransfer(direction: TransferDirection): Promise<PcTransferSession> {
  const api = window.electronAPI;
  if (!api?.startTransfer) throw new Error('Esta función solo está en la app de Windows.');

  const key = createTransferKey();
  let payload: string | undefined;
  if (direction === 'to-phone') {
    const { jsonString } = await generateBackupData();
    payload = await sealTransferPayload(jsonString, key, 'to-phone');
  }

  const info = await api.startTransfer({ mode: direction === 'to-pc' ? 'receive' : 'send', payload });
  const invite: TransferInvite = { direction, hosts: info.hosts, port: info.port, token: info.token, key };
  return { invite, inviteText: buildInviteText(invite), pcName: info.pcName, expiresAt: info.expiresAt };
}

export function stopPcTransfer(): void {
  void window.electronAPI?.stopTransfer?.();
}

export function onPcTransferEvent(callback: (event: ElectronTransferEvent) => void): () => void {
  return window.electronAPI?.onTransferEvent?.(callback) ?? (() => undefined);
}
