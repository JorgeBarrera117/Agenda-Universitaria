import { useSyncExternalStore } from 'react';
import { STUDY_LONG_BREAK_EVERY, STUDY_PRESETS, type StudyPhase, type StudyPresetId } from '../types';

/**
 * Estado del temporizador del modo estudio, compartido por toda la app (la pantalla del
 * temporizador y los botones «Estudiar» que muestran el tiempo restante).
 *
 * Se guarda la HORA DE FIN, no un contador: así el tiempo es correcto aunque la pantalla se cierre,
 * la app pase a segundo plano o el sistema la congele. Se guarda en localStorage para continuar
 * después de reabrir la app.
 */
export interface StudyTimerState {
  /** La pantalla del temporizador está abierta. */
  isOpen: boolean;
  subjectId?: string;
  presetId: StudyPresetId;
  phase: StudyPhase;
  running: boolean;
  /** Momento de fin (ms) mientras corre. */
  endsAt: number | null;
  /** Tiempo restante (ms) mientras está en pausa o sin empezar. */
  remainingMs: number;
  /** Sesiones de concentración terminadas seguidas (para el descanso largo). */
  focusCount: number;
  /** Inicio (ISO) de la sesión de concentración en curso, para registrarla. */
  focusStartedAt: string | null;
  /** Minutos de concentración ya acumulados antes de la última pausa. */
  focusElapsedMs: number;
}

const STORAGE_KEY = 'agenda_study_timer_v1';
const minutes = (value: number) => value * 60_000;

function initialState(): StudyTimerState {
  return {
    isOpen: false,
    presetId: 'classic',
    phase: 'focus',
    running: false,
    endsAt: null,
    remainingMs: minutes(STUDY_PRESETS.classic.focus),
    focusCount: 0,
    focusStartedAt: null,
    focusElapsedMs: 0,
  };
}

function load(): StudyTimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<StudyTimerState>;
    const base = initialState();
    const presetId = parsed.presetId && parsed.presetId in STUDY_PRESETS ? parsed.presetId : base.presetId;
    return {
      ...base,
      ...parsed,
      presetId,
      // La pantalla siempre empieza cerrada al abrir la app
      isOpen: false,
      phase: parsed.phase === 'break' ? 'break' : 'focus',
      running: Boolean(parsed.running && typeof parsed.endsAt === 'number'),
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

/** Duración (ms) de una fase con el preset elegido. */
export function phaseDurationMs(phase: StudyPhase, presetId: StudyPresetId, focusCount: number): number {
  const preset = STUDY_PRESETS[presetId];
  if (phase === 'focus') return minutes(preset.focus);
  const isLong = focusCount > 0 && focusCount % STUDY_LONG_BREAK_EVERY === 0;
  return minutes(isLong ? preset.longBreak : preset.shortBreak);
}

/** Tiempo restante ahora mismo (ms). */
export function remainingNow(current: StudyTimerState, now = Date.now()): number {
  return current.running && current.endsAt !== null ? Math.max(0, current.endsAt - now) : current.remainingMs;
}

/** Minutos de concentración que lleva la sesión en curso (para guardarla si se corta). */
export function focusElapsedNow(current: StudyTimerState, now = Date.now()): number {
  if (current.phase !== 'focus') return 0;
  // Mientras corre, remainingMs es lo que quedaba al reanudar: lo transcurrido desde entonces es la diferencia
  const sinceResume = current.running && current.endsAt !== null ? current.remainingMs - Math.max(0, current.endsAt - now) : 0;
  return current.focusElapsedMs + sinceResume;
}

export const studyTimer = {
  open(subjectId?: string): void {
    // Con una sesión en marcha se respeta su materia; si no, se toma la que se pidió
    const keepSubject = state.running || state.focusStartedAt !== null;
    setState({ isOpen: true, subjectId: keepSubject ? state.subjectId : subjectId ?? state.subjectId });
  },
  close(): void {
    setState({ isOpen: false });
  },
  setSubject(subjectId: string | undefined): void {
    setState({ subjectId });
  },
  setPreset(presetId: StudyPresetId): void {
    // Cambiar el ritmo solo sin una sesión empezada: reinicia la fase actual con la nueva duración
    if (state.running || state.focusStartedAt !== null) return;
    setState({ presetId, remainingMs: phaseDurationMs(state.phase, presetId, state.focusCount) });
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
  /** Pasa a la fase siguiente. Devuelve la fase que terminó y los minutos de concentración que dejó. */
  advance(completed: boolean, now = Date.now()): { finished: StudyPhase; focusMinutes: number; startedAt: string | null } {
    const finished = state.phase;
    let focusMinutes = 0;
    const startedAt = state.focusStartedAt;
    if (finished === 'focus') {
      focusMinutes = completed ? STUDY_PRESETS[state.presetId].focus : focusElapsedNow(state, now) / 60_000;
      const focusCount = completed ? state.focusCount + 1 : state.focusCount;
      const breakMs = phaseDurationMs('break', state.presetId, focusCount);
      // Al terminar la concentración, el descanso empieza solo
      setState({
        phase: 'break',
        focusCount,
        running: completed,
        endsAt: completed ? now + breakMs : null,
        remainingMs: breakMs,
        focusStartedAt: null,
        focusElapsedMs: 0,
      });
    } else {
      // Tras el descanso se espera a que el estudiante empiece la siguiente sesión
      setState({
        phase: 'focus',
        running: false,
        endsAt: null,
        remainingMs: phaseDurationMs('focus', state.presetId, state.focusCount),
        focusStartedAt: null,
        focusElapsedMs: 0,
      });
    }
    return { finished, focusMinutes, startedAt };
  },
  /** Vuelve al principio (concentración, sin sesiones). Devuelve los minutos de concentración que había. */
  reset(now = Date.now()): { focusMinutes: number; startedAt: string | null } {
    const focusMinutes = focusElapsedNow(state, now) / 60_000;
    const startedAt = state.focusStartedAt;
    setState({
      phase: 'focus',
      running: false,
      endsAt: null,
      remainingMs: phaseDurationMs('focus', state.presetId, 0),
      focusCount: 0,
      focusStartedAt: null,
      focusElapsedMs: 0,
    });
    return { focusMinutes, startedAt };
  },
};
