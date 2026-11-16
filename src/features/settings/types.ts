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

/** Receta de color de Material You con la que se calcula la paleta propia. */
export type PaletteStyle = 'balanced' | 'vibrant' | 'expressive' | 'fidelity' | 'monochrome';
/** Cuánto color lleva el fondo (superficies, tarjetas, barras). */
export type BackgroundTint = 'neutral' | 'soft' | 'strong';
/** De qué color toma su tono el fondo. */
export type BackgroundSource = 'primary' | 'accent' | 'custom';

/** Lo que el estudiante eligió: se guarda para poder volver a editar la paleta tal como la dejó. */
export interface PaletteRecipe {
  /** Color principal (#RRGGBB). */
  seed: string;
  style: PaletteStyle;
  /** Color de acento; null = automático (lo decide el estilo). */
  accent: string | null;
  backgroundTint: BackgroundTint;
  backgroundSource: BackgroundSource;
  /** Solo cuando backgroundSource es 'custom'. */
  backgroundColor: string | null;
}

/** Paleta propia: la receta y los tokens ya calculados (la app no recalcula al arrancar). */
export interface CustomPaletteSettings {
  seed: string;
  /** Ausente en las paletas creadas en 1.7.10.54 (solo tenían el color principal). */
  recipe?: PaletteRecipe;
  light: ThemeTokenSet;
  dark: ThemeTokenSet;
}

/** Acabado de las tarjetas: sólido (actual), cristal translúcido o plano con bordes marcados. */
export type CardSurfaceStyle = 'solid' | 'glass' | 'bordered';

/** Papeles tapiz: los patrones viven en src/shared/wallpapers/wallpaperPatterns.ts. */
export type WallpaperStyle =
  // Estudio
  | 'campus'
  | 'notebook'
  | 'math'
  | 'chemistry'
  | 'biology'
  // Geométricos
  | 'dots'
  | 'grid'
  | 'blueprint'
  | 'hexagons'
  | 'triangles'
  | 'diagonal'
  | 'crosses'
  // Naturaleza y espacio
  | 'topographic'
  | 'waves'
  | 'leaves'
  | 'clouds'
  | 'space'
  // Tecnología
  | 'constellation'
  | 'code'
  | 'circuit'
  // Personal
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
  /** Minutos de anticipación del aviso «antes de la clase» (notify15MinBefore lo activa). */
  reminderLeadMinutes?: ReminderLeadMinutes;
  /** Resumen del día: un aviso a esta hora con las clases de hoy. */
  dailySummaryEnabled?: boolean;
  /** Hora del resumen (HH:MM, 24 h). */
  dailySummaryTime?: string;
  /** Cómo se muestran las horas: 15:00 o 3:00 p. m. */
  timeFormat?: TimeFormat;
  /** Copia de seguridad automática semanal (Android: Descargas; Windows: Documentos). */
  autoBackupEnabled?: boolean;
  /** Avisar si hace tiempo que no se hace una copia de seguridad. */
  backupReminderEnabled?: boolean;
  /** Tamaño del texto de toda la app (accesibilidad). */
  textScale?: TextScale;
  /** Decoración de temporada (Navidad, del 1 de diciembre al 6 de enero). Activa salvo que se apague. */
  seasonalDecorations?: boolean;
}

export type TimeFormat = '24h' | '12h';

export type TextScale = 'small' | 'normal' | 'large' | 'xlarge';

/** Multiplicador de la escala tipográfica para cada tamaño de texto. */
export const TEXT_SCALE_FACTORS: Record<TextScale, number> = {
  small: 0.9,
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
};

export const REMINDER_LEAD_OPTIONS = [5, 10, 15, 30, 60] as const;
export type ReminderLeadMinutes = (typeof REMINDER_LEAD_OPTIONS)[number];

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
  reminderLeadMinutes: 15,
  dailySummaryEnabled: false,
  dailySummaryTime: '07:00',
  timeFormat: '24h',
  autoBackupEnabled: false,
  backupReminderEnabled: true,
  textScale: 'normal',
  seasonalDecorations: true,
};
