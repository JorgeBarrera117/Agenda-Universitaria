export type ThemeMode = 'light' | 'dark' | 'system';
export type MaterialColorTheme =
  | 'default'
  | 'blue'
  | 'purple'
  | 'green'
  | 'amber'
  | 'pink'
  | 'rose'
  | 'teal'
  | 'oled'
  | 'matcha'
  | 'sunset'
  | 'slate';

/** Acabado de las tarjetas: sólido (actual), cristal translúcido o plano con bordes marcados. */
export type CardSurfaceStyle = 'solid' | 'glass' | 'bordered';

export type WallpaperStyle =
  | 'campus'
  | 'blueprint'
  | 'constellation'
  | 'topographic'
  | 'dots'
  | 'custom'
  | 'none';

/** Tono de los recordatorios: archivo en public/sounds y res/raw, o el tono del sistema. */
export type NotificationSoundTone =
  | 'chime_school_jp'
  | 'chime_big_ben'
  | 'chime_lycee_fr'
  | 'bell_retro_school'
  | 'carillon_oxford'
  | 'bell_campus'
  | 'bell_harvard_chapel'
  | 'carillon_sorbonne'
  | 'bell_berkeley_campanile'
  | 'chime_shinjuku_station'
  | 'bowl_tibetan_zen'
  | 'tone_water_tuning_fork'
  | 'kalimba_study_arpeggio'
  | 'windchime_furin'
  | 'harp_glissando_short'
  | 'marimba_gentle'
  | 'synth_warm_chord'
  | 'pop_glass_organic'
  | 'sonar_study_ping'
  | 'zen_drop'
  | 'default';

export interface AppSettings {
  theme: ThemeMode;
  colorPalette: MaterialColorTheme;
  cardSurfaceStyle: CardSurfaceStyle;
  /** Modo Ultra Fluidez: sin desenfoques de fondo ni sombras (ver index.css). */
  performanceMode: boolean;
  semesterName: string;
  // Perfil / credencial estudiantil (opcional, solo se guarda en este dispositivo)
  studentName?: string;
  careerName?: string;
  semesterGoal?: string;
  defaultScheduleView: 'weekly' | 'daily';
  imageQuality: 'balanced' | 'high';
  visibleDays: 'mon-fri' | 'mon-sat' | 'all';
  // Papel Tapiz y Personalización de Fondo
  wallpaperStyle: WallpaperStyle;
  wallpaperOpacity: number;
  wallpaperScale: number;
  wallpaperBlur: number;
  wallpaperTintWithTheme: boolean;
  // Notificaciones y Recordatorios de Cátedras
  notificationsEnabled: boolean;
  notifyAtClassStart: boolean;
  notify15MinBefore: boolean;
  notificationSound: boolean;
  notificationTone: NotificationSoundTone;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  colorPalette: 'default',
  cardSurfaceStyle: 'solid',
  performanceMode: false,
  semesterName: 'Semestre 2026-I',
  defaultScheduleView: 'weekly',
  imageQuality: 'balanced',
  visibleDays: 'mon-fri',
  wallpaperStyle: 'campus',
  wallpaperOpacity: 16,
  wallpaperScale: 100,
  wallpaperBlur: 0,
  wallpaperTintWithTheme: true,
  notificationsEnabled: true,
  notifyAtClassStart: true,
  notify15MinBefore: true,
  notificationSound: true,
  notificationTone: 'chime_school_jp',
};
