import { useSyncExternalStore } from 'react';
import {
  DEFAULT_STUDY_CONFIG,
  STUDY_PRESETS,
  clampStudyConfig,
  isLongBreakAfter,
  type StudyConfig,
  type StudyPhase,
  type StudyPresetId,
} from '../types';

/**
 * Estado del temporizador del modo estudio, compartido por toda la app (la pestaña Estudio, los
 * botones «Estudiar» de las fichas y el punto de «en marcha» de la barra).
 *
 * Se guarda la HORA DE FIN, no un contador: así el tiempo es correcto aunque la pantalla se cierre,
 * la app pase a segundo plano o el sistema la congele. Se guarda en localStorage para continuar
 * después de reabrir la app.
 */
export interface StudyTimerState {
  /** Cada «Estudiar» de una ficha lo aumenta: la app lo ve y abre la pestaña Estudio. */
  openRequest: number;
  subjectId?: string;
  /** Ritmo elegido (siempre válido: pasa por clampStudyConfig). */
  config: StudyConfig;
  phase: StudyPhase;
  running: boolean;
  /** Momento de fin (ms) mientras corre. */
  endsAt: number | null;
  /** Tiempo restante (ms) mientras está en pausa o sin empezar. */
  remainingMs: number;
  /**
   * Duración total de la fase en curso, fijada al empezarla: cambiar el ritmo a mitad de una fase
   * no la altera (el cambio vale desde la siguiente) y el aro de progreso no salta.
   */
  phaseTotalMs: number;
  /** Sesiones de concentración terminadas seguidas (para el descanso largo). */
  focusCount: number;
  /** Inicio (ISO) de la sesión de concentración en curso, para registrarla. */
  focusStartedAt: string | null;
  /** Milisegundos de concentración ya acumulados antes de la última pausa. */
  focusElapsedMs: number;
}

const STORAGE_KEY = 'agenda_study_timer_v1';
/** Evento que pide abrir la pestaña Estudio (lo escucha App). */
export const STUDY_OPEN_EVENT = 'agenda:study-open';
const minutes = (value: number) => value * 60_000;

/** Duración (ms) de una fase con el ritmo dado; el descanso es largo cada `longBreakEvery` sesiones. */
export function phaseDurationMs(phase: StudyPhase, config: StudyConfig, focusCount: number): number {
  if (phase === 'focus') return minutes(config.focusMin);
  return minutes(isLongBreakAfter(focusCount, config.longBreakEvery) ? config.longBreakMin : config.shortBreakMin);
}

function initialState(config: StudyConfig = DEFAULT_STUDY_CONFIG): StudyTimerState {
  const focusMs = phaseDurationMs('focus', config, 0);
  return {
    openRequest: 0,
    config,
    phase: 'focus',
    running: false,
    endsAt: null,
    remainingMs: focusMs,
    phaseTotalMs: focusMs,
    focusCount: 0,
    focusStartedAt: null,
    focusElapsedMs: 0,
  };
}

/** Ritmos de versiones anteriores (solo se guardaba el id del preset). */
const LEGACY_PRESETS: Record<string, StudyPresetId> = { classic: 'classic', short: 'quick', long: 'deep' };

const finiteMs = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback);

function load(): StudyTimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<StudyTimerState> & { presetId?: string };
    const legacy = parsed.presetId ? STUDY_PRESETS[LEGACY_PRESETS[parsed.presetId] ?? 'classic'] : undefined;
    const config = clampStudyConfig(parsed.config ?? (legacy ? { ...DEFAULT_STUDY_CONFIG, ...legacy } : undefined));
    const base = initialState(config);
    const phase: StudyPhase = parsed.phase === 'break' ? 'break' : 'focus';
    const focusCount = typeof parsed.focusCount === 'number' && Number.isInteger(parsed.focusCount) && parsed.focusCount >= 0 ? parsed.focusCount : 0;
    const expected = phaseDurationMs(phase, config, focusCount);
    const remainingMs = finiteMs(parsed.remainingMs, expected);
    const phaseTotalMs = Math.max(finiteMs(parsed.phaseTotalMs, expected), remainingMs);
    const running = Boolean(parsed.running && typeof parsed.endsAt === 'number' && Number.isFinite(parsed.endsAt));
    return {
      ...base,
      subjectId: typeof parsed.subjectId === 'string' ? parsed.subjectId : undefined,
      phase,
      running,
      endsAt: running ? (parsed.endsAt as number) : null,
      remainingMs,
      phaseTotalMs,
      focusCount,
      focusStartedAt: typeof parsed.focusStartedAt === 'string' ? parsed.focusStartedAt : null,
      focusElapsedMs: finiteMs(parsed.focusElapsedMs, 0),
      // Una petición de abrir no sobrevive a reabrir la app
      openRequest: 0,
    };
  } catch {
    return initialState();
  }
}

let state: StudyTimerState = typeof window === 'undefined' ? initialState() : load();
const listeners = new Set<() => void>();

function setState(patch: Partial<StudyTimerState>): void {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento: el temporizador funciona igual mientras la app esté abierta
  }
  listeners.forEach((listener) => listener());
}

export function getStudyTimerState(): StudyTimerState {
  return state;
}

export function useStudyTimer(): StudyTimerState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );
}

/** Tiempo restante ahora mismo (ms). */
export function remainingNow(current: StudyTimerState, now = Date.now()): number {
  return current.running && current.endsAt !== null ? Math.max(0, current.endsAt - now) : current.remainingMs;
}

/** Milisegundos de concentración que lleva la sesión en curso (para guardarla si se corta). */
export function focusElapsedNow(current: StudyTimerState, now = Date.now()): number {
  if (current.phase !== 'focus') return 0;
  // Mientras corre, remainingMs es lo que quedaba al reanudar: lo transcurrido desde entonces es la diferencia
  const sinceResume = current.running && current.endsAt !== null ? current.remainingMs - Math.max(0, current.endsAt - now) : 0;
  return current.focusElapsedMs + sinceResume;
}

/** La fase actual todavía no empezó (reloj detenido y completo): un cambio de ritmo la puede rehacer. */
export function isPhaseUntouched(current: StudyTimerState): boolean {
  return !current.running && current.remainingMs === current.phaseTotalMs && current.focusStartedAt === null && current.focusElapsedMs === 0;
}

export const studyTimer = {
  /** Pide abrir la pestaña Estudio (desde una ficha), con esa materia si no hay una sesión empezada. */
  open(subjectId?: string): void {
    const keepSubject = state.running || state.focusStartedAt !== null;
    setState({ openRequest: state.openRequest + 1, subjectId: keepSubject ? state.subjectId : subjectId ?? state.subjectId });
    window.dispatchEvent(new Event(STUDY_OPEN_EVENT));
  },
  setSubject(subjectId: string | undefined): void {
    setState({ subjectId });
  },
  /**
   * Cambia el ritmo (se valida siempre). Con el reloj detenido y la fase sin empezar, la pantalla
   * se actualiza al momento; si ya corre o está a medias, la fase actual sigue igual y el cambio
   * vale desde la siguiente.
   */
  setConfig(patch: Partial<StudyConfig>): void {
    const config = clampStudyConfig({ ...state.config, ...patch });
    if (isPhaseUntouched(state)) {
      const total = phaseDurationMs(state.phase, config, state.focusCount);
      setState({ config, remainingMs: total, phaseTotalMs: total });
    } else {
      setState({ config });
    }
  },
  applyPreset(presetId: StudyPresetId): void {
    const { focusMin, shortBreakMin, longBreakMin, longBreakEvery } = STUDY_PRESETS[presetId];
    studyTimer.setConfig({ focusMin, shortBreakMin, longBreakMin, longBreakEvery });
  },
  /** Vuelve a los valores estándar (25/5/15, cada 4; la pausa empieza sola). */
  resetConfig(): void {
    studyTimer.setConfig(DEFAULT_STUDY_CONFIG);
  },
  start(now = Date.now()): void {
    if (state.running) return;
    setState({
      running: true,
      endsAt: now + state.remainingMs,
      focusStartedAt: state.phase === 'focus' ? state.focusStartedAt ?? new Date(now).toISOString() : state.focusStartedAt,
    });
  },
  pause(now = Date.now()): void {
    if (!state.running || state.endsAt === null) return;
    const remainingMs = Math.max(0, state.endsAt - now);
    const elapsed = state.phase === 'focus' ? state.remainingMs - remainingMs : 0;
    setState({ running: false, endsAt: null, remainingMs, focusElapsedMs: state.focusElapsedMs + elapsed });
  },
  /**
   * Pasa a la fase siguiente (con el ritmo vigente). Si terminó a tiempo (`completed`), la pausa
   * o la sesión siguiente empiezan solas según los interruptores de auto-inicio. Devuelve la fase
   * que terminó y los minutos de concentración que dejó.
   */
  advance(completed: boolean, now = Date.now()): { finished: StudyPhase; focusMinutes: number; startedAt: string | null } {
    const finished = state.phase;
    const startedAt = state.focusStartedAt;
    const { config } = state;
    let focusMinutes = 0;
    if (finished === 'focus') {
      // Lo que duró de verdad esta sesión (no el ritmo actual, que pudo cambiar a mitad)
      focusMinutes = (completed ? state.phaseTotalMs : focusElapsedNow(state, now)) / 60_000;
      const focusCount = completed ? state.focusCount + 1 : state.focusCount;
      const breakMs = phaseDurationMs('break', config, focusCount);
      const autoStart = completed && config.autoStartBreaks;
      setState({
        phase: 'break',
        focusCount,
        running: autoStart,
        endsAt: autoStart ? now + breakMs : null,
        remainingMs: breakMs,
        phaseTotalMs: breakMs,
        focusStartedAt: null,
        focusElapsedMs: 0,
      });
    } else {
      const focusMs = phaseDurationMs('focus', config, state.focusCount);
      const autoStart = completed && config.autoStartPomodoros;
      setState({
        phase: 'focus',
        running: autoStart,
        endsAt: autoStart ? now + focusMs : null,
        remainingMs: focusMs,
        phaseTotalMs: focusMs,
        focusStartedAt: autoStart ? new Date(now).toISOString() : null,
        focusElapsedMs: 0,
      });
    }
    return { finished, focusMinutes, startedAt };
  },
  /** Vuelve al principio (concentración, sin sesiones). Devuelve los minutos de concentración que había. */
  reset(now = Date.now()): { focusMinutes: number; startedAt: string | null } {
    const focusMinutes = focusElapsedNow(state, now) / 60_000;
    const startedAt = state.focusStartedAt;
    const focusMs = phaseDurationMs('focus', state.config, 0);
    setState({
      phase: 'focus',
      running: false,
      endsAt: null,
      remainingMs: focusMs,
      phaseTotalMs: focusMs,
      focusCount: 0,
      focusStartedAt: null,
      focusElapsedMs: 0,
    });
    return { focusMinutes, startedAt };
  },
};
