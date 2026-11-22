import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { ScheduleSlot } from '../../features/schedule/types';
import type { Subject } from '../../features/subjects/types';
import type { AppSettings, NotificationSoundTone } from '../../features/settings/types';
import { notificationToneUrl, resolveNotificationTone } from '../../features/settings/notificationTones';
import type { ElectronReminder } from '../../electron';
import { androidSubjectLargeIcon } from '../../features/subjects/utils/subjectIconResource';
import { formatClockTime, formatTimeRange } from '../utils/timeFormat';
import type { AgendaEvent } from '../../features/agenda/types';
import {
  buildAgendaReminders,
  classDatesSkippingHolidays,
  hash32,
  holidayFallsOn,
  momentOn,
  upcomingHolidayKeys,
} from '../../features/agenda/services/agendaNotifications';
import { toDateKey } from '../../features/agenda/utils/agendaDates';

/** Título de la notificación de prueba: el nombre de la app ya lo muestra el sistema. */
const TEST_TITLE = 'Notificaciones activas';
/** Color de la app para los avisos que no son de una materia. */
const APP_COLOR = '#00639B';

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

/** Versión de escritorio (Electron): sus avisos los muestra y programa el proceso principal. */
const desktopApi = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

/** Minutos de anticipación del aviso «antes de la clase» (Ajustes → Notificaciones). */
function leadMinutes(settings: Pick<AppSettings, 'reminderLeadMinutes'>): number {
  return settings.reminderLeadMinutes ?? 15;
}

/**
 * Día y hora de un aviso que va `minutesBefore` antes de una clase (día 1 = lunes … 7 = domingo).
 * Si cae antes de medianoche, pasa al día anterior.
 */
function shiftBefore(dayOfWeek: number, time: string, minutesBefore: number): { weekday: number; hour: number; minute: number } {
  const [hours, minutes] = (time || '08:00').split(':').map(Number);
  let total = hours * 60 + minutes - minutesBefore;
  let weekday = dayOfWeek;
  while (total < 0) {
    total += 24 * 60;
    weekday = weekday === 1 ? 7 : weekday - 1;
  }
  return { weekday, hour: Math.floor(total / 60), minute: total % 60 };
}

/** Ids de los resúmenes del día: por encima de los de las clases (máx. 999 992), uno por día. */
const DAILY_SUMMARY_ID_BASE = 1_000_000;

/** Resumen del día: un aviso por cada día con clases, a la hora elegida (Android y escritorio). */
function buildDailySummaries(
  slots: ScheduleSlot[],
  subjects: Subject[],
  settings: AppSettings
): { id: number; weekday: number; hour: number; minute: number; title: string; body: string }[] {
  if (!settings.dailySummaryEnabled) return [];
  const [hour, minute] = (settings.dailySummaryTime || '07:00').split(':').map(Number);
  const summaries = [];
  for (let day = 1; day <= 7; day++) {
    const daySlots = slots.filter((slot) => slot.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (daySlots.length === 0) continue;
    const items = daySlots.map((slot) => {
      const name = subjects.find((s) => s.id === slot.subjectId)?.name || 'Clase';
      return `${formatClockTime(slot.startTime, settings.timeFormat)} ${name}`;
    });
    const shown = items.slice(0, 4).join(' · ');
    const rest = items.length > 4 ? ` y ${items.length - 4} más` : '';
    summaries.push({
      id: DAILY_SUMMARY_ID_BASE + day,
      weekday: day,
      hour,
      minute,
      title: `Hoy tienes ${daySlots.length} ${daySlots.length === 1 ? 'clase' : 'clases'}`,
      body: `${shown}${rest}`,
    });
  }
  return summaries;
}

/** Textos comunes de los recordatorios de una clase (Android y escritorio). */
function describeSlot(slot: ScheduleSlot, subjects: Subject[], settings: AppSettings) {
  const subject = subjects.find((s) => s.id === slot.subjectId);
  const subjectName = subject?.name || 'Asignatura Universitaria';
  const codeTag = subject?.code ? `[${subject.code}] ` : '';
  const locationText =
    slot.modality === 'virtual'
      ? `Modalidad Virtual (${slot.classroom || 'En Línea'})`
      : `Aula: ${slot.classroom || 'Sin asignar'}${slot.building ? ` • ${slot.building}` : ''}`;
  return {
    subject,
    before: {
      title: `En ${leadMinutes(settings)} min: ${subjectName}`,
      body: `${codeTag}Tu clase comienza a las ${formatClockTime(slot.startTime, settings.timeFormat)}. ${locationText}`,
    },
    start: {
      title: `¡Comienza la clase de ${subjectName}!`,
      body: `${codeTag}Horario: ${formatTimeRange(slot.startTime, slot.endTime, settings.timeFormat, ' a ')}. ${locationText}`,
    },
  };
}

/** Ids de los avisos de clase fechados (días libres en Android): aparte de los semanales. */
function datedClassId(slotId: string, occurrence: number, typeSuffix: number): number {
  return 2_000_000 + (hash32(slotId) % 100_000) * 100 + occurrence * 2 + (typeSuffix - 1);
}
function datedSummaryId(weekday: number, occurrence: number): number {
  return 3_000_000 + weekday * 100 + occurrence;
}

/**
 * Recordatorios para el escritorio (día 1 = lunes … 7 = domingo, como el horario): los de clase se
 * repiten cada semana salvo en los días libres (skipDates); los de la agenda llevan su fecha.
 */
async function buildDesktopReminders(
  slots: ScheduleSlot[],
  subjects: Subject[],
  settings: AppSettings,
  events: readonly AgendaEvent[]
): Promise<ElectronReminder[]> {
  if (!settings.notificationsEnabled) return [];
  const now = new Date();
  const skipDates = [...upcomingHolidayKeys(events, now)];
  // Ícono de cada materia (su dibujo sobre su color) para el aviso de Windows. Se carga solo aquí:
  // la versión web y la de Android no lo necesitan
  const { subjectBadgePng } = await import('../../features/subjects/utils/subjectBadgeImage');
  const iconBySubject = new Map<string, string | undefined>();
  for (const subject of subjects) {
    if (!slots.some((slot) => slot.subjectId === subject.id)) continue;
    iconBySubject.set(subject.id, (await subjectBadgePng(subject.icon, subject.color)) ?? undefined);
  }
  // El aviso de Windows sale en silencio y la app reproduce el tono elegido
  const playTone = settings.notificationSound && Boolean(resolveNotificationTone(settings.notificationTone).file);
  const reminders: ElectronReminder[] = [];
  for (const slot of slots) {
    const texts = describeSlot(slot, subjects, settings);
    const icon = iconBySubject.get(slot.subjectId);
    const [startH, startM] = (slot.startTime || '08:00').split(':').map(Number);
    if (settings.notify15MinBefore) {
      const at = shiftBefore(slot.dayOfWeek, slot.startTime, leadMinutes(settings));
      reminders.push({ id: generateNotificationId(slot.id, 1), ...at, ...texts.before, playTone, icon, skipDates });
    }
    if (settings.notifyAtClassStart) {
      reminders.push({ id: generateNotificationId(slot.id, 2), weekday: slot.dayOfWeek, hour: startH, minute: startM, ...texts.start, playTone, icon, skipDates });
    }
  }
  for (const summary of buildDailySummaries(slots, subjects, settings)) {
    reminders.push({ ...summary, playTone, skipDates });
  }
  for (const spec of buildAgendaReminders(events, subjects, now)) {
    const day = spec.at.getDay();
    let agendaIcon: string | undefined;
    if (spec.subject) {
      agendaIcon = iconBySubject.get(spec.subject.id) ?? (await subjectBadgePng(spec.subject.icon, spec.subject.color)) ?? undefined;
    }
    reminders.push({
      id: spec.id,
      date: toDateKey(spec.at),
      weekday: day === 0 ? 7 : day,
      hour: spec.at.getHours(),
      minute: spec.at.getMinutes(),
      title: spec.title,
      body: spec.body,
      playTone,
      icon: agendaIcon,
    });
  }
  return reminders;
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
  /** Aviso de fin de la sesión del modo estudio (se vuelve a programar tras reprogramar el resto). */
  private static studyAlarm: { at: Date; title: string; body: string; settings: ToneSettings } | null = null;
  private static readonly STUDY_ALARM_ID = 7_777_777;

  /**
   * Programa (o con `at` null, quita) el aviso de fin de la sesión del modo estudio. Solo en
   * Android: en escritorio y web la app avisa al terminar mientras está abierta.
   */
  static async setStudyAlarm(at: Date | null, title: string, body: string, settings: ToneSettings): Promise<void> {
    this.studyAlarm = at ? { at, title, body, settings } : null;
    if (!Capacitor.isNativePlatform()) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: this.STUDY_ALARM_ID }] });
    } catch {
      // No había aviso programado
    }
    await this.scheduleStudyAlarm();
  }

  private static async scheduleStudyAlarm(): Promise<void> {
    const alarm = this.studyAlarm;
    if (!alarm || alarm.at.getTime() <= Date.now() || !Capacitor.isNativePlatform()) return;
    try {
      if (!(await this.checkPermissions())) return;
      const { channelId, sound } = resolveChannel(alarm.settings);
      await this.ensureNotificationChannel(alarm.settings.notificationTone, alarm.settings.notificationSound);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.STUDY_ALARM_ID,
            title: alarm.title,
            body: alarm.body,
            channelId,
            smallIcon: 'ic_stat_agenda',
            largeIcon: 'ic_notification_large',
            iconColor: APP_COLOR,
            schedule: { at: alarm.at, allowWhileIdle: true },
            sound,
          },
        ],
      });
    } catch (err) {
      console.warn('No se pudo programar el aviso del modo estudio:', err);
    }
  }

  /** Reproduce el tono elegido (web y escritorio, donde el aviso del sistema no admite sonidos propios). */
  static playTone(settings: ToneSettings): void {
    const toneFile = settings.notificationSound ? resolveNotificationTone(settings.notificationTone).file : null;
    if (toneFile) new Audio(notificationToneUrl(toneFile)).play().catch(() => undefined);
  }

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
              title: TEST_TITLE,
              body: '¡Todo listo! Recibirás avisos 15 minutos antes y al momento exacto de iniciar tus clases.',
              channelId,
              smallIcon: 'ic_stat_agenda',
              largeIcon: 'ic_notification_large',
              iconColor: APP_COLOR,
              schedule: { at: new Date(Date.now() + 1000) }, // 1 segundo en el futuro
              sound,
            },
          ],
        });
        return true;
      } else if (desktopApi()?.showNotification) {
        const toneFile = settings.notificationSound ? resolveNotificationTone(settings.notificationTone).file : null;
        const shown = await desktopApi()!.showNotification({
          title: TEST_TITLE,
          body: '¡Todo listo! Recibirás avisos 15 minutos antes y al momento exacto de iniciar tus clases.',
          silent: toneFile !== null || !settings.notificationSound,
        });
        if (shown) this.playTone(settings);
        return shown;
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        // La API web no admite sonidos propios: se silencia el aviso y se reproduce el tono elegido
        const toneFile = settings.notificationSound ? resolveNotificationTone(settings.notificationTone).file : null;
        new Notification(TEST_TITLE, {
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
    settings: AppSettings,
    events: readonly AgendaEvent[] = []
  ): Promise<{ scheduledCount: number }> {
    if (!Capacitor.isNativePlatform()) {
      // Escritorio: el proceso principal guarda la lista y avisa a su hora (también con la ventana
      // cerrada); el permiso lo comprueba al momento de avisar
      const desktop = desktopApi();
      return desktop?.syncReminders
        ? desktop.syncReminders(await buildDesktopReminders(slots, subjects, settings, events))
        : { scheduledCount: 0 };
    }

    // Fingerprint guard para evitar cancelar y re-programar alarmas en Android si nada relevante cambió
    const currentHash = `v6_${settings.reminderLeadMinutes ?? 15}_${settings.dailySummaryEnabled ? settings.dailySummaryTime : 'no'}_${settings.timeFormat ?? '24h'}_${settings.notificationsEnabled}_${settings.notify15MinBefore}_${settings.notifyAtClassStart}_${settings.notificationSound}_${settings.notificationTone}_${slots.length}:${slots.map((s) => `${s.id}_${s.dayOfWeek}_${s.startTime}_${s.endTime}_${s.subjectId}`).join(',')}|${subjects.length}:${subjects.map((s) => `${s.id}_${s.code}_${s.icon}_${s.color}`).join(',')}|ev:${toDateKey(new Date())}:${events.map((e) => `${e.id}_${e.updatedAt}`).join(',')}`;
    if (currentHash === this.lastNotificationHash) {
      return { scheduledCount: 0 };
    }
    this.lastNotificationHash = currentHash;

    const { channelId, sound } = resolveChannel(settings);
    if (settings.notificationsEnabled) {
      await this.ensureNotificationChannel(settings.notificationTone, settings.notificationSound);
    }

    // 1. Limpiar notificaciones previas (el aviso del modo estudio en curso se vuelve a programar)
    try {
      await LocalNotifications.cancelAll();
    } catch (err) {
      console.warn('No se pudieron cancelar notificaciones anteriores:', err);
    }
    await this.scheduleStudyAlarm();

    if (!settings.notificationsEnabled || (slots.length === 0 && events.length === 0)) {
      return { scheduledCount: 0 };
    }

    // Verificar permisos antes de programar
    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      return { scheduledCount: 0 };
    }

    const notificationsToSchedule = [];
    const now = new Date();
    // Días libres de la agenda: en ellos no se avisa de clases
    const holidays = upcomingHolidayKeys(events, now);

    for (const slot of slots) {
      const { subject, before, start } = describeSlot(slot, subjects, settings);

      // Día de la semana con un día libre próximo: avisos fecha por fecha (se salta el día libre)
      if (holidayFallsOn(holidays, slot.dayOfWeek)) {
        const largeIcon = androidSubjectLargeIcon(subject?.icon, subject?.color);
        classDatesSkippingHolidays(slot.dayOfWeek, holidays, now).forEach((dateKey, occurrence) => {
          const moments = [
            settings.notify15MinBefore ? { suffix: 1, at: momentOn(dateKey, slot.startTime || '08:00', leadMinutes(settings)), texts: before } : null,
            settings.notifyAtClassStart ? { suffix: 2, at: momentOn(dateKey, slot.startTime || '08:00'), texts: start } : null,
          ];
          for (const moment of moments) {
            if (!moment || moment.at.getTime() <= now.getTime()) continue;
            notificationsToSchedule.push({
              id: datedClassId(slot.id, occurrence, moment.suffix),
              ...moment.texts,
              channelId,
              smallIcon: 'ic_stat_agenda',
              largeIcon,
              iconColor: APP_COLOR,
              schedule: { at: moment.at, allowWhileIdle: true },
              sound,
            });
          }
        });
        continue;
      }

      // Mapeo de DayOfWeek (1=Lun ... 7=Dom) a Capacitor Weekday (1=Dom, 2=Lun ... 7=Sab)
      const capacitorWeekday = (slot.dayOfWeek % 7) + 1;

      // Extraer hora y minuto de inicio
      const [startH, startM] = (slot.startTime || '08:00').split(':').map(Number);

      // A. Aviso antes de la clase (5 a 60 min, según Ajustes)
      if (settings.notify15MinBefore) {
        const at = shiftBefore(slot.dayOfWeek, slot.startTime, leadMinutes(settings));
        const priorWeekday = (at.weekday % 7) + 1;
        const priorH = at.hour;
        const priorM = at.minute;

        notificationsToSchedule.push({
          id: generateNotificationId(slot.id, 1),
          ...before,
          channelId,
          // Arriba, el ícono de la app; al lado del texto, el de la materia sobre su color
          smallIcon: 'ic_stat_agenda',
          largeIcon: androidSubjectLargeIcon(subject?.icon, subject?.color),
          iconColor: APP_COLOR,
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
          ...start,
          channelId,
          // Arriba, el ícono de la app; al lado del texto, el de la materia sobre su color
          smallIcon: 'ic_stat_agenda',
          largeIcon: androidSubjectLargeIcon(subject?.icon, subject?.color),
          iconColor: APP_COLOR,
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

    // C. Resumen del día (un aviso por cada día con clases; fecha por fecha si hay días libres)
    for (const summary of buildDailySummaries(slots, subjects, settings)) {
      if (holidayFallsOn(holidays, summary.weekday)) {
        const time = String(summary.hour).padStart(2, '0') + ':' + String(summary.minute).padStart(2, '0');
        classDatesSkippingHolidays(summary.weekday, holidays, now).forEach((dateKey, occurrence) => {
          const at = momentOn(dateKey, time);
          if (at.getTime() <= now.getTime()) return;
          notificationsToSchedule.push({
            id: datedSummaryId(summary.weekday, occurrence),
            title: summary.title,
            body: summary.body,
            channelId,
            smallIcon: 'ic_stat_agenda',
            largeIcon: 'ic_notification_large',
            iconColor: APP_COLOR,
            schedule: { at, allowWhileIdle: true },
            sound,
          });
        });
        continue;
      }
      notificationsToSchedule.push({
        id: summary.id,
        title: summary.title,
        body: summary.body,
        channelId,
        smallIcon: 'ic_stat_agenda',
        largeIcon: 'ic_notification_large',
        iconColor: APP_COLOR,
        schedule: {
          on: { weekday: (summary.weekday % 7) + 1, hour: summary.hour, minute: summary.minute },
          repeats: true,
          allowWhileIdle: true,
        },
        sound,
      });
    }

    // D. Agenda: tareas, exámenes y recordatorios con fecha (un aviso cada uno)
    for (const spec of buildAgendaReminders(events, subjects, now)) {
      notificationsToSchedule.push({
        id: spec.id,
        title: spec.title,
        body: spec.body,
        channelId,
        smallIcon: 'ic_stat_agenda',
        largeIcon: spec.subject ? androidSubjectLargeIcon(spec.subject.icon, spec.subject.color) : 'ic_notification_large',
        iconColor: APP_COLOR,
        schedule: { at: spec.at, allowWhileIdle: true },
        sound,
      });
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
