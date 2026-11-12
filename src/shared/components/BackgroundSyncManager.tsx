import { useEffect } from 'react';
import { useSubjects } from '../../features/subjects/hooks/useSubjects';
import { useSchedule } from '../../features/schedule/hooks/useSchedule';
import { useProfessors } from '../../features/professors/hooks/useProfessors';
import { useNotes } from '../../features/notes/hooks/useNotes';
import { useAppSettings } from '../../features/settings/hooks/useAppSettings';
import { NotificationService } from '../services/notificationService';
import { WidgetSyncService } from '../services/widgetSyncService';

const SYNC_DEBOUNCE_MS = 600;
const DESKTOP_PERMISSION_ASKED_KEY = 'agenda_desktop_notification_asked';

/**
 * Componente sin UI que mantiene sincronizados los recordatorios locales y el widget de Android.
 * Al vivir fuera de App, los cambios en Dexie solo re-renderizan este componente (que devuelve
 * null) y no el layout ni las pestañas.
 */
export function BackgroundSyncManager(): null {
  const { subjects } = useSubjects();
  const { slots } = useSchedule();
  const { professors } = useProfessors();
  const { notes } = useNotes();
  const { settings } = useAppSettings();

  // Debounce para agrupar las ráfagas de actualizaciones reactivas de Dexie
  useEffect(() => {
    const timer = setTimeout(() => {
      if (settings.notificationsEnabled && slots.length > 0) {
        NotificationService.syncScheduleNotifications(slots, subjects, settings).catch(console.warn);
      }
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [slots, subjects, settings]);

  // Escritorio: en el primer arranque la app pide permiso para avisar (como Android). Solo una vez;
  // después se puede conceder desde Ajustes → Notificaciones.
  useEffect(() => {
    if (!window.electronAPI || !settings.notificationsEnabled) return;
    try {
      if (localStorage.getItem(DESKTOP_PERMISSION_ASKED_KEY)) return;
    } catch {
      return;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DESKTOP_PERMISSION_ASKED_KEY, '1');
      } catch {
        // Sin almacenamiento la pregunta podría repetirse; no es grave
      }
      void NotificationService.checkPermissions().then((granted) => (granted ? true : NotificationService.requestPermissions()));
    }, 1500);
    return () => clearTimeout(timer);
  }, [settings.notificationsEnabled]);

  // Escritorio: el aviso de Windows sale en silencio y aquí suena el tono elegido
  const { notificationSound, notificationTone } = settings;
  useEffect(() => {
    const desktop = window.electronAPI;
    if (!desktop?.onReminderFired) return;
    return desktop.onReminderFired(() => NotificationService.playTone({ notificationSound, notificationTone }));
  }, [notificationSound, notificationTone]);

  useEffect(() => {
    const timer = setTimeout(() => {
      WidgetSyncService.syncWidgetData(slots, subjects, professors, notes, {
        theme: settings.theme,
        colorPalette: settings.colorPalette,
        customPalette: settings.customPalette,
      }).catch(console.warn);
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [slots, subjects, professors, notes, settings.theme, settings.colorPalette, settings.customPalette]);

  return null;
}
