const { app, BrowserWindow, shell, ipcMain, Notification, Tray, Menu, nativeImage, dialog, session, powerMonitor, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';

/** Mismo id que el instalador (appId de electron-builder): Windows agrupa los avisos bajo él. */
const APP_USER_MODEL_ID = 'com.agenda.universitaria';
const APP_NAME = 'Agenda Universitaria';
/** Arranque con Windows: la app empieza oculta en la bandeja, lista para avisar de las clases. */
const START_HIDDEN_ARG = '--hidden';

// Garantizar una única instancia de la aplicación
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;
let tray = null;
let isQuitting = false;

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

function appIcon(size) {
  if (!fs.existsSync(iconPath)) return undefined;
  const image = nativeImage.createFromPath(iconPath);
  return size ? image.resize({ width: size, height: size, quality: 'best' }) : image;
}

/** Ruta del ejecutable real: en la versión portable, el .exe que abrió el usuario (no la copia temporal). */
function launcherPath() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow(true);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/* ------------------------------------------------------------------------------------------------
 * Permisos (como en Android): la app pregunta antes de enviar notificaciones. La decisión se guarda
 * en la carpeta de datos de la app y se puede cambiar volviendo a activarlas en Ajustes.
 * ---------------------------------------------------------------------------------------------- */
const permissionsFile = () => path.join(app.getPath('userData'), 'desktop-permissions.json');

function readPermissions() {
  try {
    return JSON.parse(fs.readFileSync(permissionsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function savePermission(name, value) {
  const current = readPermissions();
  current[name] = value;
  try {
    fs.writeFileSync(permissionsFile(), JSON.stringify(current, null, 2));
  } catch (err) {
    console.warn('No se pudo guardar el permiso:', err);
  }
}

let pendingNotificationQuestion = null;

async function askNotificationPermission() {
  // Si llegan varias solicitudes a la vez, una sola pregunta
  if (pendingNotificationQuestion) return pendingNotificationQuestion;
  pendingNotificationQuestion = (async () => {
    const { response } = await dialog.showMessageBox(mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined, {
      type: 'question',
      title: APP_NAME,
      message: '¿Permitir que Agenda Universitaria te envíe notificaciones?',
      detail:
        'Te avisará 15 minutos antes y al inicio de cada clase. Al cerrar la ventana, la app sigue en la bandeja del sistema (junto al reloj) para poder avisarte.\n\nPuedes cambiarlo cuando quieras en Ajustes → Notificaciones.',
      buttons: ['Permitir', 'No permitir'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      icon: appIcon(64),
    });
    const granted = response === 0;
    savePermission('notifications', granted ? 'granted' : 'denied');
    return granted;
  })();
  try {
    return await pendingNotificationQuestion;
  } finally {
    pendingNotificationQuestion = null;
  }
}

function setupPermissions() {
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((_wc, permission) => {
    if (permission === 'notifications') return readPermissions().notifications === 'granted';
    return true;
  });
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission !== 'notifications') {
      callback(true);
      return;
    }
    if (readPermissions().notifications === 'granted') {
      callback(true);
      return;
    }
    // Solo se llega aquí cuando el estudiante activa las notificaciones o pide una de prueba
    askNotificationPermission().then(callback, () => callback(false));
  });
}

/**
 * Nombre e ícono con los que Windows muestra los avisos de la versión portable (que no instala
 * accesos directos). Es la forma documentada para apps sin instalador: una clave en HKCU.
 */
function registerToastIdentity() {
  if (process.platform !== 'win32' || isDev) return;
  try {
    const iconCopy = path.join(app.getPath('userData'), 'notification-icon.png');
    const icon = appIcon(256);
    if (icon) fs.writeFileSync(iconCopy, icon.toPNG());
    const key = `HKCU\\Software\\Classes\\AppUserModelId\\${APP_USER_MODEL_ID}`;
    execFile('reg', ['add', key, '/v', 'DisplayName', '/t', 'REG_SZ', '/d', APP_NAME, '/f'], { windowsHide: true }, () => undefined);
    if (icon) {
      execFile('reg', ['add', key, '/v', 'IconUri', '/t', 'REG_SZ', '/d', iconCopy, '/f'], { windowsHide: true }, () => undefined);
    }
  } catch (err) {
    console.warn('No se pudo registrar el nombre de los avisos:', err);
  }
}

/* ------------------------------------------------------------------------------------------------
 * Recordatorios de clase en el escritorio: la interfaz envía la lista semanal y este proceso la
 * revisa cada 15 s, también con la ventana cerrada (la app vive en la bandeja).
 * ---------------------------------------------------------------------------------------------- */
let reminders = [];
const firedReminders = new Set();

function isValidReminder(r) {
  return (
    r &&
    Number.isInteger(r.id) &&
    Number.isInteger(r.weekday) && r.weekday >= 1 && r.weekday <= 7 &&
    Number.isInteger(r.hour) && r.hour >= 0 && r.hour <= 23 &&
    Number.isInteger(r.minute) && r.minute >= 0 && r.minute <= 59 &&
    typeof r.title === 'string' && typeof r.body === 'string'
  );
}

/** Ícono de una materia que envía la interfaz: solo PNG en data URL y de tamaño razonable. */
const REMINDER_ICON_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const MAX_REMINDER_ICON_CHARS = 200000;

function reminderIcon(icon) {
  if (typeof icon !== 'string' || icon.length > MAX_REMINDER_ICON_CHARS || !REMINDER_ICON_PATTERN.test(icon)) return null;
  const image = nativeImage.createFromDataURL(icon);
  return image.isEmpty() ? null : image;
}

function showToast({ title, body, silent, icon }) {
  if (!Notification.isSupported()) return false;
  // El ícono de la materia del recordatorio; si no hay (o no es válido), el de la app
  const toast = new Notification({ title, body, silent: Boolean(silent), icon: reminderIcon(icon) || appIcon(256) });
  toast.on('click', showMainWindow);
  toast.show();
  return true;
}

function checkReminders() {
  if (reminders.length === 0 || readPermissions().notifications !== 'granted') return;
  const now = new Date();
  const weekday = now.getDay() === 0 ? 7 : now.getDay(); // 1 = lunes … 7 = domingo (como en la app)
  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  for (const reminder of reminders) {
    if (reminder.weekday !== weekday || reminder.hour !== now.getHours() || reminder.minute !== now.getMinutes()) continue;
    const key = `${reminder.id}@${dateKey}`;
    if (firedReminders.has(key)) continue;
    firedReminders.add(key);
    // El tono elegido lo reproduce la interfaz (Windows solo tiene su sonido genérico)
    showToast({ title: reminder.title, body: reminder.body, silent: reminder.playTone, icon: reminder.icon });
    if (reminder.playTone && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('reminder-fired');
    }
  }
  // Limpieza: solo interesan las claves de hoy
  if (firedReminders.size > 500) {
    for (const key of firedReminders) if (!key.endsWith(`@${dateKey}`)) firedReminders.delete(key);
  }
}

ipcMain.handle('sync-reminders', (_event, list) => {
  reminders = Array.isArray(list) ? list.filter(isValidReminder).slice(0, 500) : [];
  return { scheduledCount: reminders.length };
});

ipcMain.handle('show-notification', (_event, options) => {
  if (!options || typeof options.title !== 'string' || typeof options.body !== 'string') return false;
  if (readPermissions().notifications !== 'granted') return false;
  return showToast(options);
});

ipcMain.handle('open-notification-settings', () => shell.openExternal('ms-settings:notifications'));

/* ------------------------------------------------------------------------------------------------
 * Copia de seguridad automática (semanal, la decide la interfaz): se guarda en
 * Documentos › Agenda Universitaria › Respaldos y se conservan las 8 más recientes.
 * ---------------------------------------------------------------------------------------------- */
const BACKUP_FILE_PATTERN = /^agenda_universitaria_backup_[0-9-]+\.json$/;
const MAX_BACKUP_CHARS = 300 * 1024 * 1024;
const KEPT_BACKUPS = 8;

ipcMain.handle('save-backup-file', (_event, options) => {
  const fileName = options && options.fileName;
  const content = options && options.content;
  if (typeof fileName !== 'string' || !BACKUP_FILE_PATTERN.test(fileName) || typeof content !== 'string' || content.length > MAX_BACKUP_CHARS) {
    throw new Error('Copia de seguridad no válida.');
  }
  const dir = path.join(app.getPath('documents'), 'Agenda Universitaria', 'Respaldos');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, fileName);
  fs.writeFileSync(target, content, 'utf8');
  // Solo las más recientes: una por semana, unos dos meses de historial
  const backups = fs
    .readdirSync(dir)
    .filter((name) => BACKUP_FILE_PATTERN.test(name))
    .map((name) => ({ name, time: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  for (const old of backups.slice(KEPT_BACKUPS)) {
    try {
      fs.rmSync(path.join(dir, old.name), { force: true });
    } catch {
      // Si un archivo está en uso, se intentará en la próxima copia
    }
  }
  return { success: true, path: target };
});

/* ----------------------------------------------------------------------------------------------
 * Pasar datos con el teléfono por la red local (código QR). Ver transferServer.cjs.
 * ---------------------------------------------------------------------------------------------- */
const { createTransferSession } = require('./transferServer.cjs');
const MAX_TRANSFER_CHARS = 512 * 1024 * 1024;
let transferSession = null;

function stopTransferSession() {
  if (transferSession) {
    transferSession.stop();
    transferSession = null;
  }
}

ipcMain.handle('transfer-start', async (event, options) => {
  stopTransferSession();
  const mode = options && options.mode === 'send' ? 'send' : 'receive';
  const payload = mode === 'send' ? options && options.payload : undefined;
  if (mode === 'send' && (typeof payload !== 'string' || payload.length === 0 || payload.length > MAX_TRANSFER_CHARS)) {
    throw new Error('No hay datos válidos para enviar.');
  }
  const sender = event.sender;
  let session = null;
  session = await createTransferSession({
    mode,
    payload,
    onEvent: (transferEvent) => {
      if (!sender.isDestroyed()) sender.send('transfer-event', transferEvent);
      if (transferEvent.type !== 'connected' && transferSession === session) transferSession = null;
    },
  });
  transferSession = session;
  return session.info;
});

ipcMain.handle('transfer-stop', () => stopTransferSession());

ipcMain.handle('get-launch-at-login', () => app.getLoginItemSettings({ path: launcherPath(), args: [START_HIDDEN_ARG] }).openAtLogin);

ipcMain.handle('set-launch-at-login', (_event, enabled) => {
  setLaunchAtLogin(Boolean(enabled));
  return app.getLoginItemSettings({ path: launcherPath(), args: [START_HIDDEN_ARG] }).openAtLogin;
});

function setLaunchAtLogin(enabled) {
  app.setLoginItemSettings({ openAtLogin: enabled, path: launcherPath(), args: [START_HIDDEN_ARG] });
  updateTrayMenu();
}

/* ------------------------------------------------------------------------------------------------
 * Bandeja del sistema: cerrar la ventana la esconde para seguir avisando de las clases.
 * ---------------------------------------------------------------------------------------------- */
let trayHintShown = false;

function updateTrayMenu() {
  if (!tray) return;
  const openAtLogin = app.getLoginItemSettings({ path: launcherPath(), args: [START_HIDDEN_ARG] }).openAtLogin;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir Agenda Universitaria', click: showMainWindow },
      { type: 'separator' },
      { label: 'Iniciar con Windows', type: 'checkbox', checked: openAtLogin, click: (item) => setLaunchAtLogin(item.checked) },
      { type: 'separator' },
      {
        label: 'Salir',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
}

function createTray() {
  const icon = appIcon(32);
  if (!icon) return;
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  tray.on('click', showMainWindow);
  updateTrayMenu();
}

function createWindow(showImmediately) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    center: true,
    show: false, // Esperar a 'ready-to-show' para evitar parpadeos blancos
    autoHideMenuBar: true, // Estilo limpio tipo app moderna (Spotify / VS Code)
    title: APP_NAME,
    backgroundColor: '#101418',
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });

  // Mostrar la ventana suavemente una vez renderizado el contenido (salvo arranque oculto con Windows)
  mainWindow.once('ready-to-show', () => {
    if (showImmediately) mainWindow.show();
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

  // Cerrar = esconder en la bandeja (la app sigue avisando). "Salir" del menú de la bandeja cierra de verdad.
  mainWindow.on('close', (event) => {
    if (isQuitting || !tray) return;
    event.preventDefault();
    mainWindow.hide();
    if (!trayHintShown) {
      trayHintShown = true;
      tray.displayBalloon?.({
        title: APP_NAME,
        content: 'Sigue abierta en la bandeja para avisarte de tus clases. Para cerrarla, clic derecho → Salir.',
        iconType: 'info',
      });
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

/* ------------------------------------------------------------------------------------------------
 * Actualizaciones dentro de la app (como en Android): descarga el instalador desde los releases
 * del repositorio, comprueba su huella SHA-256 y abre el asistente de instalación en modo
 * actualización (se ve el progreso y al final «Ejecutar Agenda Universitaria»). La agenda se cierra
 * mientras se instala: Windows no deja reemplazar los archivos de un programa abierto. Los datos se
 * conservan (misma carpeta de datos).
 * ---------------------------------------------------------------------------------------------- */
const UPDATE_URL_PATTERN =
  /^https:\/\/github\.com\/jorgebarrera117\/agenda-universitaria\/releases\/download\/[^?#]+\.exe$/i;
let downloadedInstaller = null;
let updateDownloadInProgress = false;

ipcMain.handle('download-update', async (event, options) => {
  const url = options && options.url;
  const expected = options && typeof options.sha256 === 'string' ? options.sha256.toLowerCase() : '';
  if (typeof url !== 'string' || !UPDATE_URL_PATTERN.test(url) || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error('El enlace de la actualización no es de confianza.');
  }
  if (updateDownloadInProgress) throw new Error('La actualización ya se está descargando.');
  updateDownloadInProgress = true;
  const crypto = require('crypto');
  const dir = path.join(app.getPath('temp'), 'AgendaUniversitaria_Update');
  const target = path.join(dir, 'Agenda-Universitaria-Setup.exe');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const response = await net.fetch(url, { cache: 'no-store' });
    if (!response.ok || !response.body) throw new Error(`No se pudo descargar la actualización (HTTP ${response.status}).`);
    const total = Number(response.headers.get('content-length')) || 0;
    const hash = crypto.createHash('sha256');
    const file = fs.createWriteStream(target);
    let received = 0;
    let lastPercent = -1;
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        hash.update(chunk);
        received += chunk.length;
        if (!file.write(chunk)) await new Promise((resolve) => file.once('drain', resolve));
        const percent = total > 0 ? Math.floor((received / total) * 100) : -1;
        if (percent !== lastPercent) {
          lastPercent = percent;
          if (!event.sender.isDestroyed()) event.sender.send('update-download-progress', percent);
        }
      }
    } finally {
      await new Promise((resolve) => file.end(resolve));
    }
    if (hash.digest('hex') !== expected) {
      fs.rmSync(target, { force: true });
      throw new Error('La descarga no coincide con la versión publicada. Se descartó por seguridad.');
    }
    downloadedInstaller = target;
    return { success: true };
  } finally {
    updateDownloadInProgress = false;
  }
});

/** ¿Está `child` dentro de la carpeta `parent`? (sin distinguir mayúsculas, como Windows) */
function isInsideFolder(child, parent) {
  if (!parent) return false;
  const relative = path.relative(parent.toLowerCase(), child.toLowerCase());
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Argumentos del asistente de instalación:
 * - --updated: salta la licencia y la elección de carpeta (se instala donde ya está).
 * - /currentuser o /allusers: salta «¿Para quién instalar?», según dónde está esta copia
 *   (en %LOCALAPPDATA% = solo este usuario; en Archivos de programa = todos, pide permiso).
 * La versión portable no está instalada: abre el asistente completo para instalarla.
 */
function updateInstallerArgs() {
  if (process.env.PORTABLE_EXECUTABLE_FILE) return [];
  const perUser = isInsideFolder(app.getPath('exe'), process.env.LOCALAPPDATA);
  return ['--updated', perUser ? '/currentuser' : '/allusers'];
}

ipcMain.handle('install-update', async () => {
  if (!downloadedInstaller || !fs.existsSync(downloadedInstaller)) {
    throw new Error('Primero hay que descargar la actualización.');
  }
  const child = spawn(downloadedInstaller, updateInstallerArgs(), { detached: true, stdio: 'ignore', windowsHide: false });
  // Solo se cierra la agenda si el instalador de verdad arrancó: si no, se queda abierta y avisa
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', () => reject(new Error('No se pudo abrir el instalador. Vuelve a intentarlo.')));
  });
  child.unref();
  isQuitting = true;
  // Se cierra sola enseguida (antes de que el instalador tenga que forzar su cierre)
  setTimeout(() => app.quit(), 300);
  return { success: true };
});

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
  // Antes de cualquier aviso: Windows agrupa las notificaciones por este id
  app.setAppUserModelId(APP_USER_MODEL_ID);

  app.on('second-instance', () => {
    // Si el usuario intenta abrir una segunda ventana, enfocar la existente
    showMainWindow();
  });

  app.whenReady().then(() => {
    setupPermissions();
    registerToastIdentity();
    createTray();
    createWindow(!process.argv.includes(START_HIDDEN_ARG));

    setInterval(checkReminders, 15000);
    powerMonitor.on('resume', checkReminders);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(true);
      }
    });
  });
}

app.on('window-all-closed', () => {
  // Con bandeja la app sigue viva para los recordatorios; sin ella (no debería pasar), se cierra
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopTransferSession();
});
