import { Capacitor } from '@capacitor/core';
import { LocalRoom } from '../../../shared/plugins/localRoom';

/**
 * La sala fuera de la pantalla: notificación persistente (Android), avisos nativos de mensajes y
 * del cierre (Android y Windows) y las acciones que vuelven desde esas notificaciones.
 *
 * - Android: LocalRoomForegroundService mantiene viva la sala con la app en segundo plano o la
 *   pantalla bloqueada. Los avisos solo se muestran si la app no está a la vista (lo decide el
 *   lado nativo, que sabe si la actividad está en pausa).
 * - Windows: el proceso principal avisa solo si la ventana está minimizada, oculta o sin foco.
 */

export interface RoomPresence {
  roomName: string;
  subtitle: string;
  isHost: boolean;
}

export interface RoomNotice {
  /** Una notificación por conversación: la sala o cada chat privado. */
  key: string;
  title: string;
  body: string;
  /** Chat privado que se abre al tocarla (id del compañero). */
  chat?: string;
}

const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';
const desktop = () => (typeof window !== 'undefined' && window.electronAPI?.roomNotify ? window.electronAPI : null);

let lastPresence = '';
let permissionAsked = false;
let listenersReady = false;
/** Las llamadas al servicio van en orden: si no, una más lenta pisaba el texto más nuevo. */
let queue: Promise<void> = Promise.resolve();
let latest: RoomPresence | null = null;

function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch(() => undefined);
}

/** Acciones que vuelven de las notificaciones (se registran una sola vez). */
export function initRoomPresenceListeners(handlers: { onLeave: () => void; onOpen: (chat: string | null) => void }): void {
  if (listenersReady) return;
  listenersReady = true;
  if (isAndroid()) {
    void LocalRoom.addListener('roomNotificationAction', ({ action }) => {
      if (action === 'leave') handlers.onLeave();
    });
    void LocalRoom.addListener('roomOpenRequest', ({ chat }) => handlers.onOpen(chat ?? null));
  }
  desktop()?.onRoomOpen(({ chat }) => handlers.onOpen(chat));
}

/** Inicia o actualiza la notificación persistente (solo cambia si cambió el texto). */
export function updateRoomPresence(presence: RoomPresence): void {
  if (!isAndroid()) return;
  const key = `${presence.roomName}|${presence.subtitle}|${presence.isHost}`;
  if (key === lastPresence) return;
  lastPresence = key;
  latest = presence;
  enqueue(async () => {
    // Android 13+: el permiso de notificaciones se pide una vez, al entrar a la primera sala
    if (!permissionAsked) {
      permissionAsked = true;
      try {
        const { permission } = await LocalRoom.roomNotificationStatus();
        if (permission === 'prompt') await LocalRoom.requestRoomNotificationPermission();
      } catch {
        // Sin notificaciones la sala funciona igual
      }
    }
    // Siempre el estado más reciente (pudo cambiar mientras se pedía el permiso)
    if (latest) await LocalRoom.startRoomService(latest);
  });
}

/** Aviso de un mensaje, chat privado o elemento (solo si la app no está a la vista). */
export function notifyRoomActivity(notice: RoomNotice): void {
  if (isAndroid()) {
    void LocalRoom.notifyRoomEvent(notice).catch(() => undefined);
    return;
  }
  void desktop()?.roomNotify({ title: notice.title, body: notice.body, chat: notice.chat }).catch(() => false);
}

/** La sala terminó: se apaga el servicio y, si se pasa un aviso, se muestra fuera de la app. */
export function endRoomPresence(notice?: { title: string; body: string }): void {
  lastPresence = '';
  latest = null;
  if (isAndroid()) {
    enqueue(() => (notice ? LocalRoom.notifyRoomClosed(notice) : LocalRoom.stopRoomService()));
    return;
  }
  if (notice) void desktop()?.roomNotify(notice).catch(() => false);
}
