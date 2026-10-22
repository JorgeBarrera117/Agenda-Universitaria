const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura APIs al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  openDocument: (options) => ipcRenderer.invoke('open-document', options),
});
