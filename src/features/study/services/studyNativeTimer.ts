import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { STUDY_LONG_BREAK_EVERY, STUDY_PRESETS } from '../types';
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
  const preset = STUDY_PRESETS[state.presetId];
  return {
    started: isStudySessionStarted(state),
    running: state.running,
    phase: state.phase,
    endsAt: state.endsAt ?? 0,
    remainingMs: state.remainingMs,
    focusMs: preset.focus * 60_000,
    shortBreakMs: preset.shortBreak * 60_000,
    longBreakMs: preset.longBreak * 60_000,
    longEvery: STUDY_LONG_BREAK_EVERY,
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
