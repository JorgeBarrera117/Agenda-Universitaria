import { DEFAULT_SETTINGS, type NotificationSoundTone } from './types';

export type NotificationToneGroup = 'school' | 'campus' | 'calm' | 'instrument' | 'system';

export interface NotificationToneInfo {
  id: NotificationSoundTone;
  label: string;
  description: string;
  /** Insignia temática corta (ej. "Japón"); su ícono vive en la UI (NotificationTonePicker). */
  badge: string;
  group: NotificationToneGroup;
  /** Nombre del archivo en public/sounds y android/app/src/main/res/raw; null = tono del sistema. */
  file: string | null;
}

export const NOTIFICATION_TONE_GROUPS: readonly { id: NotificationToneGroup; label: string }[] = [
  { id: 'school', label: 'Timbres escolares' },
  { id: 'campus', label: 'Torres universitarias' },
  { id: 'calm', label: 'Calma y concentración' },
  { id: 'instrument', label: 'Instrumentos suaves' },
  { id: 'system', label: 'Sistema' },
];

type ToneDetails = Omit<NotificationToneInfo, 'id' | 'file'>;

/**
 * Ficha de cada tono. Al ser un Record sobre la unión, TypeScript exige que cada tono tenga su
 * ficha: añadir un tono al tipo sin describirlo aquí no compila.
 */
const TONE_DETAILS: Record<NotificationSoundTone, ToneDetails> = {
  chime_school_jp: { label: 'Timbre escolar', badge: 'Japón', group: 'school', description: 'Melodía Westminster en campana tubular.' },
  chime_big_ben: { label: 'Big Ben', badge: 'Londres', group: 'school', description: 'Campanas pesadas de torre inglesa.' },
  chime_lycee_fr: { label: 'Liceo francés', badge: 'Liceo', group: 'school', description: 'Dos notas de vibráfono, como en las escuelas europeas.' },
  bell_retro_school: { label: 'Campana retro', badge: 'Retro', group: 'school', description: 'Timbre mecánico de martillo.' },
  chime_shinjuku_station: { label: 'Estación Shinjuku', badge: 'Tokio', group: 'school', description: 'Micromelodía alegre de estación japonesa.' },
  carillon_oxford: { label: 'Carillón Oxford', badge: 'Oxford', group: 'campus', description: 'Secuencia triunfal de torre universitaria.' },
  bell_campus: { label: 'Campana del campus', badge: 'Campus', group: 'campus', description: 'Campanada grave de bronce académico.' },
  bell_harvard_chapel: { label: 'Capilla Harvard', badge: 'Harvard', group: 'campus', description: 'Campana solemne de capilla universitaria.' },
  carillon_sorbonne: { label: 'Carillón Sorbona', badge: 'Sorbona', group: 'campus', description: 'Tríada ascendente de torre parisina.' },
  bell_berkeley_campanile: { label: 'Campanile Berkeley', badge: 'Berkeley', group: 'campus', description: 'Acorde de campanas de la torre del campus.' },
  bowl_tibetan_zen: { label: 'Cuenco tibetano', badge: 'Zen 432Hz', group: 'calm', description: 'Resonancia larga y calmante.' },
  tone_water_tuning_fork: { label: 'Diapasón de agua', badge: '528Hz', group: 'calm', description: 'Gota cristalina seguida de un tono puro.' },
  windchime_furin: { label: 'Campana de viento', badge: 'Fūrin', group: 'calm', description: 'Cristal y bambú japoneses.' },
  sonar_study_ping: { label: 'Sonar de estudio', badge: 'Sonar', group: 'calm', description: 'Ping con eco amplio para concentrarte.' },
  zen_drop: { label: 'Gota zen', badge: 'Biblioteca', group: 'calm', description: 'Tono breve y discreto para espacios en silencio.' },
  kalimba_study_arpeggio: { label: 'Kalimba lofi', badge: 'Kalimba', group: 'instrument', description: 'Arpegio cálido de tres notas.' },
  harp_glissando_short: { label: 'Arpa', badge: 'Arpa', group: 'instrument', description: 'Breve glissando de cuatro cuerdas.' },
  marimba_gentle: { label: 'Marimba suave', badge: 'Marimba', group: 'instrument', description: 'Acorde cálido de madera, poco intrusivo.' },
  synth_warm_chord: { label: 'Sintetizador cálido', badge: 'Synth', group: 'instrument', description: 'Acorde analógico suave.' },
  pop_glass_organic: { label: 'Pop de cristal', badge: 'Pop', group: 'instrument', description: 'Burbuja táctil con brillo cristalino.' },
  default: { label: 'Tono del sistema', badge: 'Sistema', group: 'system', description: 'Usa el sonido de notificación de tu teléfono.' },
};

/** Catálogo único de tonos: lo usan la pantalla de Ajustes y el servicio de notificaciones. */
export const NOTIFICATION_TONES: readonly NotificationToneInfo[] = (
  Object.entries(TONE_DETAILS) as [NotificationSoundTone, ToneDetails][]
).map(([id, details]) => ({ id, ...details, file: id === 'default' ? null : `${id}.wav` }));

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
