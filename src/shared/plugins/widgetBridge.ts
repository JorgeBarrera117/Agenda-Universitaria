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
}

/**
 * Singleton del plugin nativo WidgetBridge registrado una única vez en la app.
 * Previene el warning "Capacitor plugin WidgetBridge already registered. Cannot register plugins twice."
 */
export const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');
