import { registerPlugin } from '@capacitor/core';

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
}

/**
 * Singleton del plugin nativo WidgetBridge registrado una única vez en la app.
 * Previene el warning "Capacitor plugin WidgetBridge already registered. Cannot register plugins twice."
 */
export const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
