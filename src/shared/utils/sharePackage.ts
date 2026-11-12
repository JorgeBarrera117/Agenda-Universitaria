import { Capacitor } from '@capacitor/core';
import { APP_INFO } from '../constants/appInfo';
import { WidgetBridge } from '../plugins/widgetBridge';
import { blobToDataUrl } from './dataUrl';

/**
 * Piezas comunes de los archivos que se comparten entre estudiantes (.agcontact, .agclass,
 * .agschedule): cabecera con firma y versión, entrega por la hoja de compartir o descarga, y
 * limpieza de campos al importar. Todo archivo recibido se trata como contenido NO confiable.
 */
export const SHARE_APP_ID = 'agenda-universitaria';

export interface SharedFileResult {
  method: 'share' | 'download';
  fileName: string;
}

/** Cabecera común: identifica la app y el tipo de paquete, y su versión de formato. */
export interface SharePackageHeader<TType extends string> {
  app: typeof SHARE_APP_ID;
  type: TType;
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
}

export function sharePackageHeader<TType extends string>(type: TType, formatVersion: number): SharePackageHeader<TType> {
  return {
    app: SHARE_APP_ID,
    type,
    formatVersion,
    exportedAt: new Date().toISOString(),
    appVersion: APP_INFO.version,
  };
}

/** Parte del nombre de archivo sin tildes, rutas ni caracteres raros ("Cálculo I" → "Calculo_I"). */
export function shareFileBaseName(name: string, fallback: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return base || fallback;
}

/**
 * Entrega un archivo compartido: en Android abre la hoja de compartir del sistema (WhatsApp,
 * Telegram, Drive…) con su tipo MIME propio; en la web o en PC lo descarga.
 */
export async function deliverSharedFile(content: string, fileName: string, mimeType: string): Promise<SharedFileResult> {
  const blob = new Blob([content], { type: mimeType });

  if (Capacitor.isNativePlatform()) {
    await WidgetBridge.shareFile({ base64Data: await blobToDataUrl(blob), fileName, mimeType });
    return { method: 'share', fileName };
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Se libera después: revocar en el mismo tick puede cancelar la descarga en algunos navegadores
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { method: 'download', fileName };
}

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Una línea de texto: sin caracteres de control, espacios colapsados y con límite de largo. */
export function cleanLine(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength).trim();
  return text || undefined;
}

/** Texto de varias líneas (asesorías, notas): conserva los saltos, quita el resto de controles. */
export function cleanMultiline(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)
    .trim();
  return text || undefined;
}

/** Color #RRGGBB o undefined. */
export function cleanHexColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
}

/** Entero dentro de [min, max] o undefined. */
export function cleanInteger(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

/** Enlace http(s) válido (nunca javascript:, intent:, file:…) o undefined. */
export function cleanWebUrl(value: unknown, maxLength: number): string | undefined {
  const text = cleanLine(value, maxLength);
  if (!text || !/^https?:\/\//i.test(text)) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? text : undefined;
  } catch {
    return undefined;
  }
}

export interface ParsedPackage {
  /** Objeto raíz ya comprobado (firma y versión); sus campos siguen sin validar. */
  body: UnknownRecord;
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
}

interface EnvelopeOptions {
  type: string;
  /** Versión de formato más nueva que esta app sabe leer. */
  currentVersion: number;
  maxChars: number;
  /** Mensaje si no es un paquete de este tipo (JSON roto, otra app u otro tipo). */
  invalidMessage: string;
  tooLargeMessage: string;
  newerVersionMessage: string;
}

/** Comprueba tamaño, JSON, firma ("app" y "type") y versión de formato de un paquete recibido. */
export function parsePackageEnvelope(rawJson: string, options: EnvelopeOptions): ParsedPackage {
  if (rawJson.length > options.maxChars) throw new Error(options.tooLargeMessage);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(options.invalidMessage);
  }
  if (!isRecord(parsed) || parsed.app !== SHARE_APP_ID || parsed.type !== options.type) {
    throw new Error(options.invalidMessage);
  }
  const formatVersion = cleanInteger(parsed.formatVersion, 1, Number.MAX_SAFE_INTEGER);
  if (formatVersion === undefined) throw new Error(options.invalidMessage);
  if (formatVersion > options.currentVersion) throw new Error(options.newerVersionMessage);

  const exportedAt =
    typeof parsed.exportedAt === 'string' && !Number.isNaN(Date.parse(parsed.exportedAt))
      ? parsed.exportedAt
      : new Date().toISOString();

  return { body: parsed, formatVersion, exportedAt, appVersion: cleanLine(parsed.appVersion, 20) ?? '' };
}
