/**
 * Modo estudio (Pomodoro): bloques de concentración con descansos, y el registro de lo estudiado
 * para ver las horas por materia.
 */

/** Una sesión de concentración terminada (o cortada después de al menos 1 minuto). */
export interface StudySession {
  id: string;
  /** Materia que se estudió (opcional). */
  subjectId?: string;
  /** Inicio, ISO. */
  startedAt: string;
  /** Minutos de concentración. */
  minutes: number;
}

export type StudyPhase = 'focus' | 'break';

/** Ritmo del Pomodoro: tiempos, cada cuánto toca el descanso largo y qué empieza solo. */
export interface StudyConfig {
  /** Minutos de concentración. */
  focusMin: number;
  /** Descanso corto. */
  shortBreakMin: number;
  /** Descanso largo. */
  longBreakMin: number;
  /** Cada cuántas sesiones de concentración toca el descanso largo. */
  longBreakEvery: number;
  /** Al terminar una sesión, la pausa empieza sola. */
  autoStartBreaks: boolean;
  /** Al terminar una pausa, la siguiente sesión empieza sola. */
  autoStartPomodoros: boolean;
}

export type StudyDurationKey = 'focusMin' | 'shortBreakMin' | 'longBreakMin' | 'longBreakEvery';

/** Límites de cada valor (inclusive). */
export const STUDY_LIMITS: Record<StudyDurationKey, { min: number; max: number }> = {
  focusMin: { min: 5, max: 120 },
  shortBreakMin: { min: 1, max: 30 },
  longBreakMin: { min: 10, max: 60 },
  longBreakEvery: { min: 2, max: 8 },
};

export type StudyPresetId = 'classic' | 'quick' | 'deep';
/** Perfil activo: uno de los rápidos o «personalizado» si algún valor no coincide. */
export type StudyProfileId = StudyPresetId | 'custom';

export interface StudyPreset {
  id: StudyPresetId;
  label: string;
  /** Texto corto para el teléfono. */
  shortLabel: string;
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakEvery: number;
}

export const STUDY_PRESETS: Record<StudyPresetId, StudyPreset> = {
  classic: { id: 'classic', label: 'Clásico', shortLabel: 'Clásico', focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4 },
  quick: { id: 'quick', label: 'Inicio rápido', shortLabel: 'Rápido', focusMin: 15, shortBreakMin: 3, longBreakMin: 10, longBreakEvery: 4 },
  deep: { id: 'deep', label: 'Deep Work', shortLabel: 'Deep Work', focusMin: 50, shortBreakMin: 10, longBreakMin: 30, longBreakEvery: 4 },
};

/** Valores estándar: Clásico (25/5/15, descanso largo cada 4), la pausa empieza sola. */
export const DEFAULT_STUDY_CONFIG: StudyConfig = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartPomodoros: false,
};

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/**
 * Deja la configuración siempre válida: enteros dentro de sus límites, sin ceros ni negativos, y
 * sin descansos más largos que la concentración (el corto nunca supera la sesión; el largo, como
 * mucho la sesión, salvo que la sesión sea menor que el mínimo del largo: 10 min).
 */
export function clampStudyConfig(input: Partial<StudyConfig> | null | undefined): StudyConfig {
  const c = input ?? {};
  const d = DEFAULT_STUDY_CONFIG;
  const focusMin = clampInt(c.focusMin, STUDY_LIMITS.focusMin.min, STUDY_LIMITS.focusMin.max, d.focusMin);
  const shortBreakMin = clampInt(c.shortBreakMin, STUDY_LIMITS.shortBreakMin.min, Math.min(STUDY_LIMITS.shortBreakMin.max, focusMin), d.shortBreakMin);
  const longMax = Math.min(STUDY_LIMITS.longBreakMin.max, Math.max(STUDY_LIMITS.longBreakMin.min, focusMin));
  const longBreakMin = clampInt(c.longBreakMin, STUDY_LIMITS.longBreakMin.min, longMax, Math.min(d.longBreakMin, longMax));
  const longBreakEvery = clampInt(c.longBreakEvery, STUDY_LIMITS.longBreakEvery.min, STUDY_LIMITS.longBreakEvery.max, d.longBreakEvery);
  return {
    focusMin,
    shortBreakMin,
    longBreakMin,
    longBreakEvery,
    autoStartBreaks: typeof c.autoStartBreaks === 'boolean' ? c.autoStartBreaks : d.autoStartBreaks,
    autoStartPomodoros: typeof c.autoStartPomodoros === 'boolean' ? c.autoStartPomodoros : d.autoStartPomodoros,
  };
}

/** Qué perfil coincide con los tiempos (los interruptores de auto-inicio no cuentan). */
export function studyProfileOf(config: StudyConfig): StudyProfileId {
  const match = (Object.values(STUDY_PRESETS) as StudyPreset[]).find(
    (p) =>
      p.focusMin === config.focusMin &&
      p.shortBreakMin === config.shortBreakMin &&
      p.longBreakMin === config.longBreakMin &&
      p.longBreakEvery === config.longBreakEvery
  );
  return match?.id ?? 'custom';
}

/** ¿El descanso que sigue a la sesión número `focusCount` es el largo? */
export function isLongBreakAfter(focusCount: number, longBreakEvery: number): boolean {
  return focusCount > 0 && focusCount % longBreakEvery === 0;
}
