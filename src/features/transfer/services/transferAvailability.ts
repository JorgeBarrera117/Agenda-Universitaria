import { Capacitor } from '@capacitor/core';

/** Qué tipo de dispositivo es este como anfitrión (el que muestra el QR), o null si no puede serlo. */
export type HostKind = 'pc' | 'phone';

function isElectronHost(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI?.startTransfer === 'function';
}

function isAndroidApp(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** La app de Windows y la de Android pueden abrir el servidor temporal y mostrar el QR. */
export function hostKind(): HostKind | null {
  if (isElectronHost()) return 'pc';
  if (isAndroidApp()) return 'phone';
  return null;
}

export function canHostTransfer(): boolean {
  return hostKind() !== null;
}

/** Solo la app de Android escanea el QR (con la cámara). */
export function canScanTransfer(): boolean {
  return isAndroidApp();
}

/** Texto corto del acceso directo (menú Compartir), o null si aquí no se puede transferir (web). */
export function transferShortcutLabel(): string | null {
  return canHostTransfer() ? 'Pasar datos por QR' : null;
}
