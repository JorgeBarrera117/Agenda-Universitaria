import { Capacitor } from '@capacitor/core';

/** La app de Windows abre el servidor temporal y muestra el QR. */
export function canHostTransfer(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI?.startTransfer === 'function';
}

/** La app de Android escanea el QR y se conecta a la PC. */
export function canScanTransfer(): boolean {
  return Capacitor.getPlatform() === 'android';
}
