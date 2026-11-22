import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { StudyTimerState } from '../state/studyTimerStore';

/** Estado que entiende la notificación nativa del modo estudio (StudyTimerNotifier.java). */
export interface NativeStudyState {
  started: boolean;
  running: boolean;
  phase: 'focus' | 'break';
  endsAt: number;
  remainingMs: number;
  focusMs: number;
  shortBreakMs: number;
  longBreakMs: number;
  longEvery: number;
  /** Duración total de la fase en curso (para «Empezar» frente a «Reanudar»). */
  phaseTotalMs: number;
  /** Al terminar la sesión, la pausa empieza sola. */
  autoStartBreaks: boolean;
  /** Al terminar la pausa, la siguiente sesión empieza sola. */
  autoStartFocus: boolean;
  focusCount: number;
  subject: string;
  color: string;
  breakTone: string;
  resumeTone: string;
  soundOn: boolean;
}

export type NativeStudyEventType = 'pause' | 'resume' | 'stop' | 'phaseEnd';

export interface NativeStudyEvent {
  type: NativeStudyEventType;
  at: number;
}

interface StudyTimerNativePlugin {
  sync(options: { state: NativeStudyState }): Promise<void>;
  consumeEvents(): Promise<{ events: NativeStudyEvent[] }>;
  addListener(eventName: 'studyEvent', listener: (data: { type: NativeStudyEventType }) => void): Promise<PluginListenerHandle>;
}

const plugin = registerPlugin<StudyTimerNativePlugin>('StudyTimer');

/** Solo la app de Android tiene la notificación en curso con cuenta regresiva. */
export const hasNativeStudyTimer = Capacitor.getPlatform() === 'android';

/** Hay una sesión empezada (en curso, en pausa, en descanso o esperando la siguiente del ciclo). */
export function isStudySessionStarted(state: StudyTimerState): boolean {
  return state.running || state.focusStartedAt !== null || state.phase === 'break' || state.focusCount > 0;
}

export function toNativeState(
  state: StudyTimerState,
  extras: { subject: string; color: string; breakTone: string; resumeTone: string; soundOn: boolean }
): NativeStudyState {
  const { config } = state;
  return {
    started: isStudySessionStarted(state),
    running: state.running,
    phase: state.phase,
    endsAt: state.endsAt ?? 0,
    remainingMs: state.remainingMs,
    focusMs: config.focusMin * 60_000,
    shortBreakMs: config.shortBreakMin * 60_000,
    longBreakMs: config.longBreakMin * 60_000,
    longEvery: config.longBreakEvery,
    phaseTotalMs: state.phaseTotalMs,
    autoStartBreaks: config.autoStartBreaks,
    autoStartFocus: config.autoStartPomodoros,
    focusCount: state.focusCount,
    ...extras,
  };
}

export const studyNativeTimer = {
  sync: (state: NativeStudyState) => plugin.sync({ state }),
  async consumeEvents(): Promise<NativeStudyEvent[]> {
    const { events } = await plugin.consumeEvents();
    return (Array.isArray(events) ? events : [])
      .filter((e) => typeof e?.at === 'number' && ['pause', 'resume', 'stop', 'phaseEnd'].includes(e.type))
      .sort((a, b) => a.at - b.at);
  },
  onEvent: (listener: (type: NativeStudyEventType) => void) => plugin.addListener('studyEvent', (data) => listener(data.type)),
};
