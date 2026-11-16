import { Capacitor } from '@capacitor/core';
import { WidgetBridge } from '../../../shared/plugins/widgetBridge';

/**
 * Desbloqueo con la huella, el rostro o el bloqueo de pantalla del teléfono (Android, mediante
 * BiometricPrompt). En la web y en Windows no está disponible: ahí se usa solo el PIN.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await WidgetBridge.getBiometricStatus()).available;
  } catch {
    return false;
  }
}

/**
 * Mientras el diálogo de la huella (o la pantalla del PIN del teléfono) está abierto, Android pausa
 * la app: sin esta marca, al volver se bloquearía otra vez justo después de desbloquear.
 */
let promptActiveUntil = 0;

export function isBiometricPromptActive(): boolean {
  return Date.now() < promptActiveUntil;
}

/** Pide la huella (o el bloqueo del teléfono). true si se verificó; false si se canceló o falló. */
export async function authenticateWithBiometric(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  promptActiveUntil = Date.now() + 120_000;
  try {
    const result = await WidgetBridge.authenticateBiometric({
      title: 'Desbloquear la agenda',
      subtitle: 'Usa tu huella o el bloqueo de tu teléfono',
    });
    return result.success;
  } catch {
    return false;
  } finally {
    // Un momento de gracia mientras la app vuelve al primer plano
    promptActiveUntil = Date.now() + 3000;
  }
}
