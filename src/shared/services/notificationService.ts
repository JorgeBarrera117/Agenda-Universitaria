import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { ScheduleSlot } from '../../features/schedule/types';
import type { Subject } from '../../features/subjects/types';
import type { AppSettings, NotificationSoundTone } from '../../features/settings/types';
import { notificationToneUrl, resolveNotificationTone } from '../../features/settings/notificationTones';

/** Prefijo de los canales de recordatorios (incluye el canal único heredado 'academic_schedule_channel'). */
const CHANNEL_PREFIX = 'academic_schedule_';
/**
 * Canal sin sonido para cuando el estudiante apaga "Sonido": en Android 8+ el sonido lo decide el
 * canal y no la notificación, así que apuntamos a un WAV mudo de res/raw conservando la vibración y
 * el aviso emergente (con importancia baja dejaría de aparecer en pantalla).
 */
const SILENT_CHANNEL_ID = `${CHANNEL_PREFIX}silent`;
const SILENT_SOUND_FILE = 'tone_silent.wav';

type ToneSettings = Pick<AppSettings, 'notificationTone' | 'notificationSound'>;

/** Canal y sonido que corresponden a los ajustes: un canal por tono, más el silencioso. */
function resolveChannel(settings: ToneSettings): { channelId: string; sound: string } {
  if (!settings.notificationSound) {
    return { channelId: SILENT_CHANNEL_ID, sound: SILENT_SOUND_FILE };
  }
  const tone = resolveNotificationTone(settings.notificationTone);
  return { channelId: `${CHANNEL_PREFIX}${tone.id}`, sound: tone.file ?? 'default' };
}

// Función hash para obtener un entero seguro de 32 bits para el id de notificación
function generateNotificationId(slotId: string, typeSuffix: number): number {
  let hash = 0;
  for (let i = 0; i < slotId.length; i++) {
    const char = slotId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convertir a 32-bit integer
  }
  return Math.abs(hash % 100000) * 10 + typeSuffix;
}

export class NotificationService {
  private static activeChannelId: string | null = null;
  private static lastNotificationHash = '';

  /**
   * Garantiza el canal Android del tono elegido. Android no permite cambiar el sonido de un canal
   * ya creado, por eso cada tono tiene su propio id (`academic_schedule_<tono>`); los canales de
   * otros tonos se borran para que en los ajustes del sistema solo quede el que está en uso.
   */
  static async ensureNotificationChannel(tone: NotificationSoundTone, withSound = true): Promise<string> {
    const { channelId, sound } = resolveChannel({ notificationTone: tone, notificationSound: withSound });
    if (!Capacitor.isNativePlatform() || this.activeChannelId === channelId) return channelId;

    const toneInfo = resolveNotificationTone(tone);
    try {
      await LocalNotifications.createChannel({
        id: channelId,
        name: withSound ? `Recordatorios (${toneInfo.label})` : 'Recordatorios (Silencioso)',
        description: 'Avisos de inicio de clase y recordatorios 15 minutos antes',
        importance: 4, // HIGH: aviso emergente (heads-up)
        visibility: 1, // PUBLIC: visible en la pantalla de bloqueo
        // Sin `sound` Android usa el tono del sistema; con archivo, lo busca en res/raw por su nombre
        sound: sound === 'default' ? undefined : sound,
        vibration: true,
        lights: true,
        lightColor: '#006BBB',
      });
      this.activeChannelId = channelId;
    } catch (err) {
      console.warn('No se pudo crear el canal de notificaciones:', err);
      return channelId;
    }

    try {
      const { channels } = await LocalNotifications.listChannels();
      await Promise.all(
        channels
          .filter((c) => c.id.startsWith(CHANNEL_PREFIX) && c.id !== channelId)
          .map((c) => LocalNotifications.deleteChannel({ id: c.id }))
      );
    } catch (err) {
      console.warn('No se pudieron limpiar canales de notificación anteriores:', err);
    }
    return channelId;
  }

  /**
   * Verifica si los permisos de notificación están concedidos
   */
  static async checkPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await LocalNotifications.checkPermissions();
        return status.display === 'granted';
      } else if (typeof Notification !== 'undefined') {
        return Notification.permission === 'granted';
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Solicita permisos de notificación al usuario
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      } else if (typeof Notification !== 'undefined') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
    } catch (err) {
      console.warn('Error al solicitar permisos de notificación:', err);
      return false;
    }
  }

  /**
   * Envía una notificación de prueba inmediata
   */
  static async sendTestNotification(settings: ToneSettings): Promise<boolean> {
    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) return false;
    }

    const { channelId, sound } = resolveChannel(settings);

    try {
      if (Capacitor.isNativePlatform()) {
        await this.ensureNotificationChannel(settings.notificationTone, settings.notificationSound);
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 999999,
              title: '🎓 Notificaciones Activas • Agenda Universitaria',
              body: '¡Todo listo! Recibirás avisos 15 minutos antes y al momento exacto de iniciar tus clases.',
              channelId,
              smallIcon: 'ic_stat_agenda',
              largeIcon: 'ic_notification_large',
              iconColor: '#00639B',
              schedule: { at: new Date(Date.now() + 1000) }, // 1 segundo en el futuro
              sound,
            },
          ],
        });
        return true;
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        // La API web no admite sonidos propios: se silencia el aviso y se reproduce el tono elegido
        const toneFile = settings.notificationSound ? resolveNotificationTone(settings.notificationTone).file : null;
        new Notification('🎓 Notificaciones Activas • Agenda Universitaria', {
          body: '¡Todo listo! Recibirás avisos 15 minutos antes y al momento exacto de iniciar tus clases.',
          icon: './app-icon-claro.svg',
          silent: toneFile !== null || !settings.notificationSound,
        });
        if (toneFile) {
          new Audio(notificationToneUrl(toneFile)).play().catch(() => undefined);
        }
        return true;
      }
    } catch (err) {
      console.warn('Error enviando notificación de prueba:', err);
    }
    return false;
  }

  /**
   * Sincroniza todas las alarmas recurrentes semanales del horario en base a la configuración
   */
  static async syncScheduleNotifications(
    slots: ScheduleSlot[],
    subjects: Subject[],
    settings: AppSettings
  ): Promise<{ scheduledCount: number }> {
    if (!Capacitor.isNativePlatform()) {
      return { scheduledCount: 0 };
    }

    // Fingerprint guard para evitar cancelar y re-programar alarmas en Android si nada relevante cambió
    const currentHash = `v3_${settings.notificationsEnabled}_${settings.notify15MinBefore}_${settings.notifyAtClassStart}_${settings.notificationSound}_${settings.notificationTone}_${slots.length}:${slots.map((s) => `${s.id}_${s.dayOfWeek}_${s.startTime}_${s.endTime}_${s.subjectId}`).join(',')}|${subjects.length}:${subjects.map((s) => `${s.id}_${s.code}`).join(',')}`;
    if (currentHash === this.lastNotificationHash) {
      return { scheduledCount: 0 };
    }
    this.lastNotificationHash = currentHash;

    const { channelId, sound } = resolveChannel(settings);
    if (settings.notificationsEnabled) {
      await this.ensureNotificationChannel(settings.notificationTone, settings.notificationSound);
    }

    // 1. Limpiar notificaciones previas
    try {
      await LocalNotifications.cancelAll();
    } catch (err) {
      console.warn('No se pudieron cancelar notificaciones anteriores:', err);
    }

    if (!settings.notificationsEnabled || slots.length === 0) {
      return { scheduledCount: 0 };
    }

    // Verificar permisos antes de programar
    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      return { scheduledCount: 0 };
    }

    const notificationsToSchedule = [];

    for (const slot of slots) {
      const subject = subjects.find((s) => s.id === slot.subjectId);
      const subjectName = subject?.name || 'Asignatura Universitaria';
      const codeTag = subject?.code ? `[${subject.code}] ` : '';

      // Ubicación física o virtual
      const locationText =
        slot.modality === 'virtual'
          ? `Modalidad Virtual (${slot.classroom || 'En Línea'})`
          : `Aula: ${slot.classroom || 'Sin asignar'}${slot.building ? ` • ${slot.building}` : ''}`;

      // Mapeo de DayOfWeek (1=Lun ... 7=Dom) a Capacitor Weekday (1=Dom, 2=Lun ... 7=Sab)
      const capacitorWeekday = (slot.dayOfWeek % 7) + 1;

      // Extraer hora y minuto de inicio
      const [startH, startM] = (slot.startTime || '08:00').split(':').map(Number);

      // A. Notificación 15 minutos antes
      if (settings.notify15MinBefore) {
        let priorH = startH;
        let priorM = startM - 15;
        let priorWeekday = capacitorWeekday;

        if (priorM < 0) {
          priorM += 60;
          priorH -= 1;
        }
        if (priorH < 0) {
          priorH += 24;
          priorWeekday = priorWeekday === 1 ? 7 : priorWeekday - 1;
        }

        notificationsToSchedule.push({
          id: generateNotificationId(slot.id, 1),
          title: `⏳ En 15 min: ${subjectName}`,
          body: `${codeTag}Tu cátedra comienza a las ${slot.startTime}. ${locationText}`,
          channelId,
          smallIcon: 'ic_stat_agenda',
          largeIcon: 'ic_notification_large',
          iconColor: subject?.color || '#00639B',
          schedule: {
            on: {
              weekday: priorWeekday,
              hour: priorH,
              minute: priorM,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          sound,
        });
      }

      // B. Notificación al momento de iniciar la cátedra
      if (settings.notifyAtClassStart) {
        notificationsToSchedule.push({
          id: generateNotificationId(slot.id, 2),
          title: `🔔 ¡Comienza la clase de ${subjectName}!`,
          body: `${codeTag}Horario: ${slot.startTime} a ${slot.endTime}. ${locationText}`,
          channelId,
          smallIcon: 'ic_stat_agenda',
          largeIcon: 'ic_notification_large',
          iconColor: subject?.color || '#00639B',
          schedule: {
            on: {
              weekday: capacitorWeekday,
              hour: startH,
              minute: startM,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          sound,
        });
      }
    }

    if (notificationsToSchedule.length > 0) {
      try {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule,
        });
      } catch (err) {
        console.error('Error programando notificaciones de horario:', err);
      }
    }

    return { scheduledCount: notificationsToSchedule.length };
  }
}
