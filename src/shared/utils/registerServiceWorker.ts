import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

/**
 * Service worker solo para la PWA web (cacheo offline). Dentro del APK de Android no hace falta:
 * los archivos ya vienen en el paquete y funcionan sin conexión. Además allí era dañino: los datos
 * del WebView sobreviven a la instalación de un APK nuevo, así que el service worker seguía
 * sirviendo el JavaScript de la versión anterior hasta reiniciar la app una o dos veces.
 *
 * En Android se da de baja cualquier service worker heredado y se borran SOLO sus cachés de
 * Workbox (los apuntes, fotos y ajustes viven en IndexedDB y localStorage, que no se tocan).
 * Si la página actual estaba controlada por él, se recarga una vez para cargar los archivos
 * del APK; tras la baja ya no hay registros, así que no se repite.
 */
export function setupServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  if (!Capacitor.isNativePlatform()) {
    registerSW({ immediate: true });
    return;
  }

  void (async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length === 0) return;
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith('workbox-')).map((key) => caches.delete(key)));
      }
      if (navigator.serviceWorker.controller) window.location.reload();
    } catch (err) {
      console.warn('No se pudo retirar el service worker heredado:', err);
    }
  })();
}
