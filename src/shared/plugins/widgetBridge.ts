import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface WidgetBridgePlugin {
  updateWidgetData(options: { dataJson: string }): Promise<{ success: boolean }>;
  saveToDownloads(options: { content: string; fileName: string }): Promise<{ success: boolean; fileName: string }>;
  exportJsonFile(options: { content: string; fileName: string }): Promise<{ success: boolean; canceled?: boolean }>;
  shareJsonFile(options: { content: string; fileName: string }): Promise<{ success: boolean }>;
  pickAndReadJsonFile(): Promise<{ success: boolean; content?: string; canceled?: boolean }>;
  openDocument(options: {
    fileName: string;
    base64Data: string;
    mimeType?: string;
  }): Promise<{ success: boolean; mimeType?: string }>;
  copyImageToClipboard(options: {
    base64Data: string;
    mimeType?: string;
  }): Promise<{ success: boolean; mimeType?: string }>;
  /** Lee la imagen del portapapeles de Android (copiada en esta u otra app) como data URL. */
  readImageFromClipboard(): Promise<{ hasImage: boolean; dataUrl?: string; mimeType?: string }>;
  /** Comparte un apunte .agnote por la hoja de compartir de Android (WhatsApp, Telegram, Drive…). */
  shareAgnoteFile(options: { content: string; fileName: string; mimeType?: string }): Promise<{ success: boolean }>;
  /**
   * Lee como texto un archivo recibido al abrir la app desde otra (p. ej. un .agnote tocado en
   * WhatsApp). Solo acepta URI que Android entregó en ese intent; cualquier otro se rechaza.
   */
  readContentUri(options: { uri: string }): Promise<{ content: string; displayName?: string }>;
  /**
   * Comparte un archivo con su contenido real (PDF, DOCX, imágenes, ZIP…) por la hoja de compartir
   * de Android. base64Data admite base64 plano o un data URL; si mimeType falta o no es válido,
   * se deduce de la extensión de fileName.
   */
  shareFile(options: {
    base64Data: string;
    fileName: string;
    mimeType?: string;
  }): Promise<{ success: boolean; mimeType?: string }>;
  /** Comparte texto (enlace, contacto…) por la hoja de compartir de Android (el WebView no tiene navigator.share). */
  shareText(options: { text: string; title?: string }): Promise<{ success: boolean }>;
  /**
   * Canal de distribución de la app Android: «github» (APK de GitHub Releases, se actualiza sola)
   * o «play» (Google Play, la tienda la actualiza). Lo fija la compilación (android/app/src/<canal>).
   */
  getDistribution(): Promise<{ channel: 'github' | 'play' }>;
  /** ¿Puede la app abrir el instalador? (Android 8+: permiso "Instalar apps desconocidas"). */
  canInstallPackages(): Promise<{ allowed: boolean }>;
  /** Abre los ajustes del sistema para conceder ese permiso a esta app. */
  openInstallPermissionSettings(): Promise<void>;
  /**
   * Descarga el APK de una versión publicada (solo GitHub Releases del proyecto) y lo verifica:
   * huella SHA-256, mismo paquete y versión más nueva. Emite "updateDownloadProgress".
   */
  downloadUpdate(options: { url: string; sha256: string }): Promise<{ success: boolean; versionName?: string; sizeBytes?: number }>;
  /** Abre el instalador con el APK verificado; rechaza con code "INSTALL_PERMISSION" si falta el permiso. */
  installDownloadedUpdate(): Promise<void>;
  /** ¿Hay huella, rostro o bloqueo de pantalla configurado para desbloquear la agenda? */
  getBiometricStatus(): Promise<{ available: boolean }>;
  /** Pide la huella o el bloqueo del teléfono (BiometricPrompt). */
  authenticateBiometric(options: { title: string; subtitle?: string }): Promise<{ success: boolean; error?: string }>;
  /**
   * Abre "Crear contacto" en la app de contactos del teléfono con los datos ya escritos (sin
   * permisos: el estudiante revisa y guarda). Rechaza si no hay app de contactos.
   */
  addContact(options: { name: string; phone?: string; email?: string; notes?: string }): Promise<{ success: boolean }>;
  /** Abre un enlace https en el navegador del sistema (p. ej. la descarga de una actualización). */
  openExternalUrl(options: { url: string }): Promise<{ success: boolean }>;
  /**
   * Pasar datos de teléfono a teléfono: abre el servidor temporal en la red local (ver
   * LocalTransferServer.java). `send` entrega `payload`, ya cifrado. Emite "transferEvent".
   * Rechaza con code "NO_LAN" si no hay wifi ni punto de acceso.
   */
  startTransferServer(options: {
    mode: 'receive' | 'send';
    payload?: string;
  }): Promise<{ port: number; hosts: string[]; token: string; pcName: string; expiresAt: number }>;
  stopTransferServer(): Promise<void>;
  /** Eventos del servidor de transferencia: connected, received (con payload), sent, expired, blocked, error. */
  addListener(
    eventName: 'transferEvent',
    listener: (event: { type: string; payload?: string }) => void
  ): Promise<PluginListenerHandle>;
  /** Archivo con el que se abrió la app (VIEW/SEND); se retiene hasta que haya un listener. */
  addListener(
    eventName: 'incomingFile',
    listener: (event: { uri: string; mimeType?: string }) => void
  ): Promise<PluginListenerHandle>;
  /** Progreso de downloadUpdate; percent es -1 si el servidor no informa el tamaño. */
  addListener(
    eventName: 'updateDownloadProgress',
    listener: (event: { downloaded: number; total: number; percent: number }) => void
  ): Promise<PluginListenerHandle>;
}

/**
 * Singleton del plugin nativo WidgetBridge registrado una única vez en la app.
 * Previene el warning "Capacitor plugin WidgetBridge already registered. Cannot register plugins twice."
 */
export const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
