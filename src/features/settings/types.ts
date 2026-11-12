import type { ThemeTokenSet } from '../../shared/utils/theme';
import type { GeneratedPaletteId } from '../../shared/utils/generatedPalettes';

export type ThemeMode = 'light' | 'dark' | 'system';

/** Paletas incluidas en la app: las 12 hechas a mano y las generadas con Material You. */
export type PresetPalette =
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
  | 'slate'
  | GeneratedPaletteId;

/** 'custom' = la paleta creada por el estudiante a partir de su color (ver customPalette). */
export type MaterialColorTheme = PresetPalette | 'custom';

/** Paleta propia: el color elegido y los tokens ya calculados (la app no recalcula al arrancar). */
export interface CustomPaletteSettings {
  seed: string;
  light: ThemeTokenSet;
  dark: ThemeTokenSet;
}

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

export type StudentStatusMode = 'network' | 'custom';

export interface AppSettings {
  theme: ThemeMode;
  colorPalette: MaterialColorTheme;
  cardSurfaceStyle: CardSurfaceStyle;
  /** Modo Ultra Fluidez: sin desenfoques de fondo ni sombras (ver index.css). */
  performanceMode: boolean;
  /** Tokens de la paleta propia; se usan cuando colorPalette es 'custom'. */
  customPalette?: CustomPaletteSettings;
  semesterName: string;
  // Perfil / credencial estudiantil (opcional, solo se guarda en este dispositivo)
  studentName?: string;
  careerName?: string;
  semesterGoal?: string;
  /** Foto de perfil recortada a 256×256 en JPEG (DataURL). */
  studentAvatarUrl?: string;
  /** Qué muestra la barra superior junto a la fecha: conectividad o una frase del estudiante. */
  studentStatusMode?: StudentStatusMode;
  /** Frase de estado personalizada (máx. 35 caracteres). */
  studentCustomStatus?: string;
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
  studentAvatarUrl: undefined,
  studentStatusMode: 'network',
  studentCustomStatus: undefined,
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
