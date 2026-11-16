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
    const listener = () => callback();
    ipcRenderer.on('reminder-fired', listener);
    return () => ipcRenderer.removeListener('reminder-fired', listener);
  },
});
