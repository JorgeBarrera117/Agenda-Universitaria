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
  /** Se dispara cuando sale un recordatorio con sonido: la interfaz reproduce el tono elegido. */
  onReminderFired: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('reminder-fired', listener);
    return () => ipcRenderer.removeListener('reminder-fired', listener);
  },
});
