import { DEFAULT_SETTINGS, type NotificationSoundTone } from './types';

export interface NotificationToneInfo {
  id: NotificationSoundTone;
  label: string;
  description: string;
  /** Etiqueta corta del carácter del tono (badge tonal). */
  badge: string;
  /** Nombre del archivo en public/sounds y android/app/src/main/res/raw; null = tono del sistema. */
  file: string | null;
}

/** Catálogo único de tonos: lo usan la pantalla de Ajustes y el servicio de notificaciones. */
export const NOTIFICATION_TONES: readonly NotificationToneInfo[] = [
  {
    id: 'chime_school_jp',
    label: 'Timbre escolar',
    description: 'Melodía de campanas como la de las escuelas de Japón.',
    badge: 'Clásico',
    file: 'chime_school_jp.wav',
  },
  {
    id: 'bell_campus',
    label: 'Campana del campus',
    description: 'Campanada grave de torre universitaria.',
    badge: 'Solemne',
    file: 'bell_campus.wav',
  },
  {
    id: 'marimba_gentle',
    label: 'Marimba suave',
    description: 'Acorde cálido de madera, poco intrusivo.',
    badge: 'Suave',
    file: 'marimba_gentle.wav',
  },
  {
    id: 'zen_drop',
    label: 'Gota zen',
    description: 'Tono breve y discreto para la biblioteca.',
    badge: 'Discreto',
    file: 'zen_drop.wav',
  },
  {
    id: 'default',
    label: 'Tono del sistema',
    description: 'Usa el sonido de notificación de tu teléfono.',
    badge: 'Sistema',
    file: null,
  },
];

/**
 * Devuelve la ficha del tono guardado. Si el valor no es válido (ajustes antiguos o editados a
 * mano) se usa el tono por defecto, para no crear canales con un sonido inexistente.
 */
export function resolveNotificationTone(tone: string | undefined): NotificationToneInfo {
  return (
    NOTIFICATION_TONES.find((t) => t.id === tone) ??
    NOTIFICATION_TONES.find((t) => t.id === DEFAULT_SETTINGS.notificationTone) ??
    NOTIFICATION_TONES[0]
  );
}

/** URL relativa del archivo para preescucha web (respeta base './' de Vite, Electron y Capacitor). */
export function notificationToneUrl(file: string): string {
  return `${import.meta.env.BASE_URL}sounds/${file}`;
}
