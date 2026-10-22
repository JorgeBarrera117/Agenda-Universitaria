const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

// Garantizar una única instancia de la aplicación
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    center: true,
    show: false, // Esperar a 'ready-to-show' para evitar parpadeos blancos
    autoHideMenuBar: true, // Estilo limpio tipo app moderna (Spotify / VS Code)
    title: 'Agenda Universitaria',
    backgroundColor: '#101418',
    icon: path.join(__dirname, '../public/pwa-512x512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });

  // Mostrar la ventana suavemente una vez renderizado el contenido
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Abrir enlaces externos (Zoom, Teams, Meet, portales) en el navegador predeterminado del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith('http://localhost') || url.startsWith('file://');
    if (!isLocal) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Carga de contenido según entorno
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Si el usuario intenta abrir una segunda ventana, enfocar la existente
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
