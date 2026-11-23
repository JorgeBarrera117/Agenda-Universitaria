const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura APIs al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  openDocument: (options) => ipcRenderer.invoke('open-document', options),
  // Notificaciones de escritorio (el proceso principal las muestra y programa los recordatorios)
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  syncReminders: (reminders) => ipcRenderer.invoke('sync-reminders', reminders),
  openNotificationSettings: () => ipcRenderer.invoke('open-notification-settings'),
  getLaunchAtLogin: () => ipcRenderer.invoke('get-launch-at-login'),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('set-launch-at-login', enabled),
  // Copia de seguridad automática en Documentos › Agenda Universitaria › Respaldos
  saveBackupFile: (options) => ipcRenderer.invoke('save-backup-file', options),
  // Pasar datos con el teléfono por la red local (código QR)
  startTransfer: (options) => ipcRenderer.invoke('transfer-start', options),
  stopTransfer: () => ipcRenderer.invoke('transfer-stop'),
  onTransferEvent: (callback) => {
    const listener = (_event, transferEvent) => callback(transferEvent);
    ipcRenderer.on('transfer-event', listener);
    return () => ipcRenderer.removeListener('transfer-event', listener);
  },
  // Sala de Intercambio Local (ver electron/roomServer.cjs)
  roomHostStart: () => ipcRenderer.invoke('room-host-start'),
  roomHostStop: () => ipcRenderer.invoke('room-host-stop'),
  roomHostRespond: (options) => ipcRenderer.invoke('room-host-respond', options),
  roomHostPush: (options) => ipcRenderer.invoke('room-host-push', options),
  roomHostCloseStream: (options) => ipcRenderer.invoke('room-host-close-stream', options),
  onRoomHostEvent: (callback) => {
    const listener = (_event, roomEvent) => callback(roomEvent);
    ipcRenderer.on('room-host-event', listener);
    return () => ipcRenderer.removeListener('room-host-event', listener);
  },
  roomClientRequest: (options) => ipcRenderer.invoke('room-client-request', options),
  roomClientOpenStream: (options) => ipcRenderer.invoke('room-client-open', options),
  roomClientCloseStream: (options) => ipcRenderer.invoke('room-client-close', options),
  /** Aviso de la sala si la ventana no está a la vista; al hacer clic llega onRoomOpen. */
  roomNotify: (options) => ipcRenderer.invoke('room-notify', options),
  onRoomOpen: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('room-open', listener);
    return () => ipcRenderer.removeListener('room-open', listener);
  },
  onRoomClientEvent: (callback) => {
    const listener = (_event, clientEvent) => callback(clientEvent);
    ipcRenderer.on('room-client-event', listener);
    return () => ipcRenderer.removeListener('room-client-event', listener);
  },
  // Actualizaciones: descarga verificada del instalador y su ejecución (la app se cierra y vuelve a abrir)
  downloadUpdate: (options) => ipcRenderer.invoke('download-update', options),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateProgress: (callback) => {
    const listener = (_event, percent) => callback(percent);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  /** Se dispara cuando sale un recordatorio con sonido: la interfaz reproduce el tono elegido. */
  onReminderFired: (callback) => {
    const listener = (_event, tone) => callback(typeof tone === 'string' ? tone : undefined);
    ipcRenderer.on('reminder-fired', listener);
    return () => ipcRenderer.removeListener('reminder-fired', listener);
  },
});
