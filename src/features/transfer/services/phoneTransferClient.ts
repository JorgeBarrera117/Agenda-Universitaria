import { CapacitorHttp } from '@capacitor/core';
import { generateBackupData } from '../../../shared/utils/backup';
import { openTransferPayload, sealTransferPayload } from './transferCrypto';
import { TRANSFER_BASE_PATH, type TransferInvite } from './transferProtocol';

/**
 * Lado del teléfono: se conecta al servidor temporal de la PC que indica el QR.
 *
 * Las peticiones se hacen con CapacitorHttp (HTTP nativo de Android), no con fetch: la app corre
 * en https://localhost y la vista web bloquea las peticiones http:// a la red local por ser
 * "contenido mixto". El cifrado de extremo a extremo (transferCrypto) protege los datos aunque
 * viajen por http.
 */

export type TransferErrorCode = 'unreachable' | 'expired' | 'wrong-direction' | 'too-large' | 'failed';

export class PhoneTransferError extends Error {
  readonly code: TransferErrorCode;
  constructor(code: TransferErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface PcConnection {
  baseUrl: string;
  pcName: string;
}

const HELLO_TIMEOUT_MS = 4000;
const TRANSFER_TIMEOUT_MS = 180_000;

interface HttpResult {
  status: number;
  data: unknown;
}

async function request(method: 'GET' | 'POST', url: string, token: string, timeoutMs: number, body?: string): Promise<HttpResult> {
  const response = await CapacitorHttp.request({
    method,
    url,
    headers: {
      'X-Agenda-Token': token,
      ...(body !== undefined ? { 'Content-Type': 'text/plain; charset=utf-8' } : {}),
    },
    data: body,
    responseType: 'text',
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  });
  return { status: response.status, data: response.data };
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (typeof data === 'string') {
    try {
      return asRecord(JSON.parse(data));
    } catch {
      return null;
    }
  }
  return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
}

const EXPIRED_MESSAGE = 'El código ya no es válido. En la computadora, genera uno nuevo y vuelve a escanearlo.';

function failureFor(status: number): PhoneTransferError {
  if (status === 403 || status === 410) return new PhoneTransferError('expired', EXPIRED_MESSAGE);
  if (status === 413) return new PhoneTransferError('too-large', 'Tus datos superan el tamaño máximo que acepta la computadora.');
  return new PhoneTransferError('failed', `La computadora respondió con un error (${status}). Vuelve a intentarlo.`);
}

/** Prueba las direcciones del QR a la vez y se queda con la primera que responde. */
export async function connectToPc(invite: TransferInvite): Promise<PcConnection> {
  const expectedMode = invite.direction === 'to-pc' ? 'receive' : 'send';
  const attempts = invite.hosts.map(async (host): Promise<PcConnection> => {
    const baseUrl = `http://${host}:${invite.port}${TRANSFER_BASE_PATH}`;
    const result = await request('GET', `${baseUrl}/hello`, invite.token, HELLO_TIMEOUT_MS);
    if (result.status !== 200) throw failureFor(result.status);
    const body = asRecord(result.data);
    if (!body || body.app !== 'agenda-universitaria') {
      throw new PhoneTransferError('unreachable', 'La dirección no corresponde a la Agenda Universitaria.');
    }
    if (body.mode !== expectedMode) {
      throw new PhoneTransferError('wrong-direction', 'La computadora espera otra operación. Genera un código nuevo.');
    }
    return { baseUrl, pcName: typeof body.pcName === 'string' && body.pcName ? body.pcName : 'tu computadora' };
  });

  try {
    return await Promise.any(attempts);
  } catch (error: unknown) {
    const reasons = error instanceof AggregateError ? error.errors : [error];
    const known = reasons.find((reason): reason is PhoneTransferError => reason instanceof PhoneTransferError);
    if (known) throw known;
    throw new PhoneTransferError(
      'unreachable',
      'No se pudo conectar con la computadora. Revisa que los dos estén en la misma red wifi y que Windows permita la app en redes privadas.'
    );
  }
}

/** Teléfono → PC: arma el respaldo, lo cifra y lo sube. */
export async function sendBackupToPc(connection: PcConnection, invite: TransferInvite): Promise<void> {
  const { jsonString } = await generateBackupData({ includeDocuments: true });
  const sealed = await sealTransferPayload(jsonString, invite.key, 'to-pc');
  let result: HttpResult;
  try {
    result = await request('POST', `${connection.baseUrl}/upload`, invite.token, TRANSFER_TIMEOUT_MS, sealed);
  } catch {
    throw new PhoneTransferError('unreachable', 'Se cortó la conexión con la computadora. Vuelve a intentarlo.');
  }
  if (result.status !== 200) throw failureFor(result.status);
}

/** PC → teléfono: descarga y descifra el respaldo; devuelve el JSON listo para restaurar. */
export async function receiveBackupFromPc(connection: PcConnection, invite: TransferInvite): Promise<string> {
  let result: HttpResult;
  try {
    result = await request('GET', `${connection.baseUrl}/download`, invite.token, TRANSFER_TIMEOUT_MS);
  } catch {
    throw new PhoneTransferError('unreachable', 'Se cortó la conexión con la computadora. Vuelve a intentarlo.');
  }
  if (result.status !== 200 || typeof result.data !== 'string') throw failureFor(result.status);
  return openTransferPayload(result.data, invite.key, 'to-phone');
}
