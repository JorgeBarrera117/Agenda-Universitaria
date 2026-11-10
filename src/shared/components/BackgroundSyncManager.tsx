import { useEffect } from 'react';
import { useSubjects } from '../../features/subjects/hooks/useSubjects';
import { useSchedule } from '../../features/schedule/hooks/useSchedule';
import { useProfessors } from '../../features/professors/hooks/useProfessors';
import { useNotes } from '../../features/notes/hooks/useNotes';
import { useAppSettings } from '../../features/settings/hooks/useAppSettings';
import { NotificationService } from '../services/notificationService';
import { WidgetSyncService } from '../services/widgetSyncService';

const SYNC_DEBOUNCE_MS = 600;

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
  }, [
    slots,
    subjects,
    settings.notificationsEnabled,
    settings.notify15MinBefore,
    settings.notifyAtClassStart,
    settings.notificationSound,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      WidgetSyncService.syncWidgetData(slots, subjects, professors, notes, {
        theme: settings.theme,
        colorPalette: settings.colorPalette,
      }).catch(console.warn);
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [slots, subjects, professors, notes, settings.theme, settings.colorPalette]);

  return null;
}
