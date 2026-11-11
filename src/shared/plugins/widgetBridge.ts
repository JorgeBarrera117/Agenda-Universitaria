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
  /** Abre un enlace https en el navegador del sistema (p. ej. la descarga de una actualización). */
  openExternalUrl(options: { url: string }): Promise<{ success: boolean }>;
  /** Archivo con el que se abrió la app (VIEW/SEND); se retiene hasta que haya un listener. */
  addListener(
    eventName: 'incomingFile',
    listener: (event: { uri: string; mimeType?: string }) => void
  ): Promise<PluginListenerHandle>;
}

/**
 * Singleton del plugin nativo WidgetBridge registrado una única vez en la app.
 * Previene el warning "Capacitor plugin WidgetBridge already registered. Cannot register plugins twice."
 */
export const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
