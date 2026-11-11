import { Capacitor } from '@capacitor/core';
import { WidgetBridge } from '../plugins/widgetBridge';

/** Cómo terminó un intento de compartir: con la hoja del sistema, copiado o cancelado por el usuario. */
export type ShareOutcome = 'shared' | 'copied' | 'canceled';

export function isShareCanceled(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Comparte un texto (enlace, contacto…):
 * - Android: hoja de compartir nativa (el WebView no implementa navigator.share).
 * - Web: navigator.share si existe (móviles y Chrome/Edge en Windows).
 * - Si nada de eso está disponible, o falla, se copia al portapapeles.
 * Cerrar la hoja sin elegir app devuelve 'canceled' (no es un error).
 */
export async function shareText({ title, text }: { title?: string; text: string }): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) {
    try {
      await WidgetBridge.shareText({ title, text });
      return 'shared';
    } catch (err) {
      // APK anterior sin shareText u otro fallo nativo: se recurre al portapapeles
      console.warn('Compartir texto nativo:', err);
    }
  } else if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      if (isShareCanceled(err)) return 'canceled';
      console.warn('Web Share API:', err);
    }
  }

  if (!navigator.clipboard?.writeText) {
    throw new Error('Este dispositivo no permite compartir ni copiar texto.');
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}
