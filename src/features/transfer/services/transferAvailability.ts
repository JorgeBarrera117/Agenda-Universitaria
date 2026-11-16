import { Capacitor } from '@capacitor/core';

/** La app de Windows abre el servidor temporal y muestra el QR. */
export function canHostTransfer(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI?.startTransfer === 'function';
}

/** La app de Android escanea el QR y se conecta a la PC. */
export function canScanTransfer(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** Texto del acceso directo según el dispositivo, o null si aquí no se puede transferir (web). */
export function transferShortcutLabel(): string | null {
  if (canHostTransfer()) return 'Pasar datos con el teléfono';
  if (canScanTransfer()) return 'Pasar datos con la PC';
  return null;
}
