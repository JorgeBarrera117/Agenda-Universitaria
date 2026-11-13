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
  /** Descarga el instalador y comprueba su SHA-256 (rechaza enlaces fuera de los releases del repositorio). */
  downloadUpdate: (options: { url: string; sha256: string }) => Promise<{ success: boolean }>;
  /** Ejecuta el instalador descargado en silencio; la app se cierra y el instalador la vuelve a abrir. */
  installUpdate: () => Promise<{ success: boolean }>;
  /** Progreso 0-100 (o -1 si el servidor no informa el tamaño). Devuelve la función para dejar de escuchar. */
  onUpdateProgress: (callback: (percent: number) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
