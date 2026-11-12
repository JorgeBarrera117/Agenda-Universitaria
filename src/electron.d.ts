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

/** Recordatorio semanal que el proceso principal de Electron dispara a su hora (también con la ventana cerrada). */
export interface ElectronReminder {
  id: number;
  /** 1 = lunes … 7 = domingo (como ScheduleSlot.dayOfWeek). */
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** La interfaz reproduce el tono elegido (el aviso de Windows sale en silencio). */
  playTone: boolean;
}

export interface ElectronNotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  openDocument: (options: ElectronDocumentOpenOptions) => Promise<ElectronDocumentOpenResult>;
  showNotification: (options: ElectronNotificationOptions) => Promise<boolean>;
  syncReminders: (reminders: ElectronReminder[]) => Promise<{ scheduledCount: number }>;
  openNotificationSettings: () => Promise<void>;
  getLaunchAtLogin: () => Promise<boolean>;
  setLaunchAtLogin: (enabled: boolean) => Promise<boolean>;
  /** Devuelve la función para dejar de escuchar. */
  onReminderFired: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
