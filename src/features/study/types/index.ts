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

export type StudyPresetId = 'classic' | 'long' | 'short';

export interface StudyPreset {
  id: StudyPresetId;
  label: string;
  /** Minutos de concentración. */
  focus: number;
  /** Descanso corto. */
  shortBreak: number;
  /** Descanso largo, cada STUDY_LONG_BREAK_EVERY sesiones. */
  longBreak: number;
}

export const STUDY_PRESETS: Record<StudyPresetId, StudyPreset> = {
  classic: { id: 'classic', label: '25 / 5', focus: 25, shortBreak: 5, longBreak: 15 },
  long: { id: 'long', label: '50 / 10', focus: 50, shortBreak: 10, longBreak: 20 },
  short: { id: 'short', label: '15 / 3', focus: 15, shortBreak: 3, longBreak: 10 },
};

/** Cada cuántas sesiones de concentración toca el descanso largo. */
export const STUDY_LONG_BREAK_EVERY = 4;
