const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

// Garantizar una única instancia de la aplicación
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;

// Ruta del ícono adaptada a desarrollo (public/) y producción empaquetada (dist/)
const iconPath = isDev
  ? path.join(__dirname, '../public/pwa-512x512.png')
  : path.join(__dirname, '../dist/pwa-512x512.png');

const DEV_SERVER_ORIGIN = 'http://localhost:5173';
const DIST_DIR = path.join(__dirname, '../dist');
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

// Debe coincidir con el atributo accept de los selectores de documentos (DocumentLinkForm,
// SubjectDocumentsModal). Cualquier otra extensión (.exe, .bat, .lnk, .hta, .svg...) se rechaza
// porque shell.openPath la ejecutaría con su programa asociado.
const OPENABLE_DOCUMENT_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.heic',
]);

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isAppUrl(url) {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  if (isDev && parsed.origin === DEV_SERVER_ORIGIN) return true;
  if (parsed.protocol !== 'file:') return false;
  const relative = path.relative(DIST_DIR, decodeURIComponent(parsed.pathname).replace(/^\/([A-Za-z]:)/, '$1'));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function openExternalIfSafe(url) {
  const parsed = parseUrl(url);
  if (parsed && EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    shell.openExternal(parsed.toString());
  }
}

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
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
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
  // La app nunca abre ventanas propias: todo enlace va al navegador del sistema, y solo con
  // esquemas seguros (otros esquemas registrados en Windows pueden lanzar programas).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfSafe(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternalIfSafe(url);
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

// Canal IPC: Apertura nativa de documentos con la aplicación predeterminada del sistema operativo
ipcMain.handle('open-document', async (_event, options) => {
  const fileName = options && options.fileName;
  const base64Data = options && options.base64Data;
  if (typeof fileName !== 'string' || typeof base64Data !== 'string') {
    return { success: false, error: 'Solicitud de apertura de documento inválida.' };
  }
  const safeFileName = path.basename(fileName);
  const extension = path.extname(safeFileName).toLowerCase();
  if (!OPENABLE_DOCUMENT_EXTENSIONS.has(extension)) {
    return { success: false, error: `Tipo de archivo no permitido por seguridad: ${extension || 'sin extensión'}` };
  }

  try {
    const tempDir = path.join(app.getPath('temp'), 'AgendaUniversitaria_Docs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, safeFileName);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const errorMsg = await shell.openPath(filePath);
    if (errorMsg) {
      console.warn('shell.openPath aviso/error:', errorMsg);
      // Fallback: mostrar archivo en el explorador de Windows si no hay visor asociado
      shell.showItemInFolder(filePath);
      return { success: false, error: errorMsg };
    }
    return { success: true, filePath };
  } catch (err) {
    console.error('Error abriendo documento en Electron:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

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

// Asegurar salida limpia e inmediata sin procesos zombis en segundo plano
app.on('before-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
});
