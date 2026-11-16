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
  /** Ícono de la materia como PNG (data URL); sin él, el aviso usa el ícono de la app. */
  icon?: string;
}

export interface ElectronNotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
}

/** Sesión de transferencia abierta en la PC: lo que el QR le dice al teléfono. */
export interface ElectronTransferSessionInfo {
  port: number;
  /** Direcciones IPv4 privadas de la PC, la más probable primero. */
  hosts: string[];
  /** Token de un solo uso (base64url). */
  token: string;
  pcName: string;
  /** Momento (ms) en que el servidor se cierra solo. */
  expiresAt: number;
}

export type ElectronTransferEvent =
  | { type: 'connected' }
  /** El teléfono subió sus datos (cifrados, en base64). */
  | { type: 'received'; payload: string }
  | { type: 'sent' }
  | { type: 'expired' }
  | { type: 'blocked' }
  | { type: 'error'; message: string };

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  openDocument: (options: ElectronDocumentOpenOptions) => Promise<ElectronDocumentOpenResult>;
  showNotification: (options: ElectronNotificationOptions) => Promise<boolean>;
  syncReminders: (reminders: ElectronReminder[]) => Promise<{ scheduledCount: number }>;
  openNotificationSettings: () => Promise<void>;
  getLaunchAtLogin: () => Promise<boolean>;
  setLaunchAtLogin: (enabled: boolean) => Promise<boolean>;
  /** Copia de seguridad automática en Documentos › Agenda Universitaria › Respaldos (guarda las 8 últimas). */
  saveBackupFile: (options: { fileName: string; content: string }) => Promise<{ success: boolean; path: string }>;
  /** Abre el servidor temporal en la red local. `send` entrega `payload` (ya cifrado) al teléfono. */
  startTransfer: (options: { mode: 'receive' | 'send'; payload?: string }) => Promise<ElectronTransferSessionInfo>;
  stopTransfer: () => Promise<void>;
  /** Devuelve la función para dejar de escuchar. */
  onTransferEvent: (callback: (event: ElectronTransferEvent) => void) => () => void;
  /** Devuelve la función para dejar de escuchar. */
  onReminderFired: (callback: () => void) => () => void;
  /** Descarga el instalador y comprueba su SHA-256 (rechaza enlaces fuera de los releases del repositorio). */
  downloadUpdate: (options: { url: string; sha256: string }) => Promise<{ success: boolean }>;
  /** Abre el asistente de instalación (modo actualización) y cierra la app mientras se instala. */
  installUpdate: () => Promise<{ success: boolean }>;
  /** Progreso 0-100 (o -1 si el servidor no informa el tamaño). Devuelve la función para dejar de escuchar. */
  onUpdateProgress: (callback: (percent: number) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
