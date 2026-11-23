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
  /** Tono de su sección (Horario o Agenda); sin él, el del Horario. */
  tone?: string;
  /** Ícono de la materia como PNG (data URL); sin él, el aviso usa el ícono de la app. */
  icon?: string;
  /** Aviso de un solo día ("YYYY-MM-DD", agenda); sin él se repite cada semana en `weekday`. */
  date?: string;
  /** Días ("YYYY-MM-DD") en que un aviso semanal no sale: días libres de la agenda. */
  skipDates?: string[];
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

/** Sala de Intercambio Local: eventos del servidor (anfitrión). Ver electron/roomServer.cjs. */
export type ElectronRoomHostEvent =
  | { type: 'request'; id: string; body: string; remote: string }
  | { type: 'streamOpen'; streamId: string; query: string; remote: string }
  | { type: 'streamClosed'; streamId: string }
  | { type: 'stopped'; reason: string };

/** Sala de Intercambio Local: eventos de la conexión SSE del invitado. */
export type ElectronRoomClientEvent =
  | { type: 'data'; streamId: string; data: string }
  | { type: 'end'; streamId: string; error?: string };

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
  /** Avisa que salió un recordatorio, con el tono de su sección para reproducirlo. */
  onReminderFired: (callback: (tone?: string) => void) => () => void;
  /** Descarga el instalador y comprueba su SHA-256 (rechaza enlaces fuera de los releases del repositorio). */
  downloadUpdate: (options: { url: string; sha256: string }) => Promise<{ success: boolean }>;
  /** Abre el asistente de instalación (modo actualización) y cierra la app mientras se instala. */
  installUpdate: () => Promise<{ success: boolean }>;
  /** Progreso 0-100 (o -1 si el servidor no informa el tamaño). Devuelve la función para dejar de escuchar. */
  onUpdateProgress: (callback: (percent: number) => void) => () => void;
  /** Sala local (anfitrión): abre el servidor en la red local y reenvía peticiones y conexiones SSE. */
  roomHostStart: () => Promise<{ port: number; hosts: string[] }>;
  roomHostStop: () => Promise<void>;
  roomHostRespond: (options: { id: string; status: number; body: string }) => Promise<void>;
  roomHostPush: (options: { streamId: string; data: string }) => Promise<void>;
  roomHostCloseStream: (options: { streamId: string }) => Promise<void>;
  onRoomHostEvent: (callback: (event: ElectronRoomHostEvent) => void) => () => void;
  /** Sala local (invitado): HTTP y SSE desde el proceso principal (la interfaz no puede abrir http:// de la red). */
  roomClientRequest: (options: { url: string; body: string; timeoutMs: number }) => Promise<{ status: number; body: string }>;
  /** streamId lo elige la interfaz: así ningún evento llega antes de saber a qué conexión pertenece. */
  roomClientOpenStream: (options: { url: string; streamId: string }) => Promise<void>;
  roomClientCloseStream: (options: { streamId: string }) => Promise<void>;
  onRoomClientEvent: (callback: (event: ElectronRoomClientEvent) => void) => () => void;
  /** Aviso de la Sala Local (solo si la ventana no está a la vista). true = se mostró. */
  roomNotify: (options: { title: string; body: string; chat?: string }) => Promise<boolean>;
  /** Clic en un aviso de la sala: abrir la sala (y el chat privado si viene). */
  onRoomOpen: (callback: (payload: { chat: string | null }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
