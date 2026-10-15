import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { ScheduleSlot } from '../../features/schedule/types';
import type { Subject } from '../../features/subjects/types';
import type { AppSettings } from '../../features/settings/types';

const CHANNEL_ID = 'academic_schedule_channel';

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
  private static isInitialized = false;

  /**
   * Inicializa el canal de notificaciones en Android
   */
  static async init(): Promise<void> {
    if (this.isInitialized) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: 'Recordatorios de Cátedras y Clases',
          description: 'Avisos de inicio de clase y recordatorios 15 minutos antes',
          importance: 4, // HIGH: Emite sonido y aparece como alerta heads-up
          visibility: 1, // PUBLIC: Visible en pantalla de bloqueo
          vibration: true,
          lights: true,
          lightColor: '#006BBB',
        });
        this.isInitialized = true;
      } catch (err) {
        console.warn('No se pudo crear el canal de notificaciones:', err);
      }
    }
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
  static async sendTestNotification(): Promise<boolean> {
    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) return false;
    }

    await this.init();

    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 999999,
              title: '🎓 Notificaciones Activas • Agenda Universitaria',
              body: '¡Todo listo! Recibirás avisos 15 minutos antes y al momento exacto de iniciar tus clases.',
              channelId: CHANNEL_ID,
              schedule: { at: new Date(Date.now() + 1000) }, // 1 segundo en el futuro
              sound: 'default',
            },
          ],
        });
        return true;
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('🎓 Notificaciones Activas • Agenda Universitaria', {
          body: '¡Todo listo! Recibirás avisos 15 minutos antes y al momento exacto de iniciar tus clases.',
          icon: '/app-icon-claro.svg',
        });
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

    await this.init();

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
          channelId: CHANNEL_ID,
          schedule: {
            on: {
              weekday: priorWeekday,
              hour: priorH,
              minute: priorM,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          sound: settings.notificationSound ? 'default' : undefined,
        });
      }

      // B. Notificación al momento de iniciar la cátedra
      if (settings.notifyAtClassStart) {
        notificationsToSchedule.push({
          id: generateNotificationId(slot.id, 2),
          title: `🔔 ¡Comienza la clase de ${subjectName}!`,
          body: `${codeTag}Horario: ${slot.startTime} a ${slot.endTime}. ${locationText}`,
          channelId: CHANNEL_ID,
          schedule: {
            on: {
              weekday: capacitorWeekday,
              hour: startH,
              minute: startM,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          sound: settings.notificationSound ? 'default' : undefined,
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
