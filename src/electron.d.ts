export interface ElectronDocumentOpenOptions {
  fileName: string;
  base64Data: string;
  mimeType?: string;
}

export interface ElectronDocumentOpenResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  openDocument: (options: ElectronDocumentOpenOptions) => Promise<ElectronDocumentOpenResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
