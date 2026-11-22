import { Capacitor } from '@capacitor/core';
import { WidgetBridge } from '../plugins/widgetBridge';

/** ¿Es un enlace web que se puede abrir fuera de la app? (solo http/https). */
export function isWebUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Abre un enlace web fuera de la app: en Android con la app que lo maneje (Zoom, Meet, Teams…). */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isWebUrl(url)) return;
  const target = url.trim();
  if (Capacitor.isNativePlatform()) {
    await WidgetBridge.openExternalUrl({ url: target });
    return;
  }
  window.open(target, '_blank', 'noopener,noreferrer');
}
