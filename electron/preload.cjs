const { contextBridge } = require('electron');

// Exponer de forma segura APIs al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
});
