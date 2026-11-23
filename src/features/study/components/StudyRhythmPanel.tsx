import React, { useState } from 'react';
import { ChevronDown, Coffee, Minus, Plus, Repeat, RotateCcw, SlidersHorizontal, Timer } from 'lucide-react';
import { SegmentedControl } from '../../../shared/components/form';
import { M3Switch } from '../../settings/components/SettingsPrimitives';
import { isPhaseUntouched, studyTimer, useStudyTimer } from '../state/studyTimerStore';
import {
  DEFAULT_STUDY_CONFIG,
  STUDY_LIMITS,
  STUDY_PRESETS,
  studyProfileOf,
  type StudyConfig,
  type StudyDurationKey,
  type StudyProfileId,
} from '../types';

interface StepperProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  unit: string;
  value: number;
  /** Límites efectivos (pueden ser más estrechos que STUDY_LIMITS: un descanso no supera la sesión). */
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/**
 * Valor con − / + y campo numérico. Mientras se escribe se acepta cualquier texto; al salir del
 * campo (o con Enter) se valida y se ajusta a los límites, así nunca queda vacío, en 0 o negativo.
 */
const Stepper: React.FC<StepperProps> = ({ id, label, icon, unit, value, min, max, onChange }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number.parseInt(draft, 10);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setDraft(null);
  };
  const stepButton = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] transition-transform active:scale-90 disabled:opacity-35';
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-md-on-surface)]">
        <span className="text-[var(--color-md-primary)]" aria-hidden="true">
          {icon}
        </span>
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Menos ${label.toLowerCase()}`} className={stepButton}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={draft ?? String(value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
            className="h-10 w-full rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] pr-10 text-center font-mono text-base font-bold text-[var(--color-md-on-surface)] focus:border-[var(--color-md-primary)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-11px font-semibold text-[var(--color-md-on-surface-variant)]">{unit}</span>
        </div>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Más ${label.toLowerCase()}`} className={stepButton}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="text-10px text-[var(--color-md-on-surface-variant)]">
        De {min} a {max} {unit}
      </p>
    </div>
  );
};

/** Límites efectivos: un descanso nunca más largo que la sesión (el largo, al menos 10 min). */
function effectiveLimits(config: StudyConfig): Record<StudyDurationKey, { min: number; max: number }> {
  return {
    focusMin: STUDY_LIMITS.focusMin,
    shortBreakMin: { min: STUDY_LIMITS.shortBreakMin.min, max: Math.min(STUDY_LIMITS.shortBreakMin.max, config.focusMin) },
    longBreakMin: {
      min: STUDY_LIMITS.longBreakMin.min,
      max: Math.min(STUDY_LIMITS.longBreakMin.max, Math.max(STUDY_LIMITS.longBreakMin.min, config.focusMin)),
    },
    longBreakEvery: STUDY_LIMITS.longBreakEvery,
  };
}

// Nombres cortos en todos los tamaños: en PC el panel mide 360 px y los largos se cortaban
// («Clásico 2…»). Los minutos del perfil elegido ya se ven arriba (25/5/15 · cada 4)
const PROFILE_OPTIONS: { value: StudyProfileId; label: string }[] = [
  ...Object.values(STUDY_PRESETS).map((p) => ({ value: p.id as StudyProfileId, label: p.shortLabel })),
  { value: 'custom', label: 'Propio' },
];

/**
 * Ritmo del Pomodoro: perfiles rápidos (Clásico, Inicio rápido, Deep Work) o tiempos propios
 * (al tocar un valor el perfil pasa solo a «Personalizado»), auto-inicio de pausas y sesiones, y
 * volver a los valores estándar. Con una fase en marcha, el cambio vale desde la siguiente.
 */
export const StudyRhythmPanel: React.FC = () => {
  const timer = useStudyTimer();
  const { config } = timer;
  const profile = studyProfileOf(config);
  const [showCustom, setShowCustom] = useState(profile === 'custom');
  const limits = effectiveLimits(config);
  const isDefault =
    profile === 'classic' &&
    config.autoStartBreaks === DEFAULT_STUDY_CONFIG.autoStartBreaks &&
    config.autoStartPomodoros === DEFAULT_STUDY_CONFIG.autoStartPomodoros;
  const appliesNext = !isPhaseUntouched(timer);

  const set = (key: StudyDurationKey) => (value: number) => studyTimer.setConfig({ [key]: value });

  return (
    <section className="md-card space-y-3 rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-4 shadow-xs sm:p-5" aria-label="Ritmo">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
          <SlidersHorizontal className="h-4 w-4 text-[var(--color-md-primary)]" aria-hidden="true" />
          Ritmo
        </h3>
        <span className="font-mono text-xs font-bold text-[var(--color-md-on-surface)]">
          {config.focusMin}/{config.shortBreakMin}/{config.longBreakMin} · cada {config.longBreakEvery}
        </span>
      </div>

      <SegmentedControl<StudyProfileId>
        value={profile}
        onChange={(value) => {
          if (value === 'custom') setShowCustom(true);
          else studyTimer.applyPreset(value);
        }}
        ariaLabel="Perfil de tiempos"
        options={PROFILE_OPTIONS}
        // Cuatro opciones en el teléfono: letra un poco menor y sin partir «Deep Work»
        className="[&_button]:px-1 [&_button]:text-11px [&_span]:whitespace-nowrap sm:[&_button]:text-xs"
      />

      {/* Ajustar a mano: fila desplegable con aspecto de botón */}
      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        aria-expanded={showCustom}
        aria-controls="study-custom-times"
        className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl bg-[var(--color-md-secondary-container)] px-3.5 text-left text-sm font-bold text-[var(--color-md-on-secondary-container)] transition-[filter,transform] duration-150 hover:brightness-95 active:scale-[0.99]"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">Ajustar los tiempos a mano</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ${showCustom ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {showCustom && (
        <div id="study-custom-times" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Stepper id="study-focus" label="Concentración" icon={<Timer className="h-3.5 w-3.5" />} unit="min" value={config.focusMin} {...limits.focusMin} onChange={set('focusMin')} />
          <Stepper id="study-short" label="Descanso corto" icon={<Coffee className="h-3.5 w-3.5" />} unit="min" value={config.shortBreakMin} {...limits.shortBreakMin} onChange={set('shortBreakMin')} />
          <Stepper id="study-long" label="Descanso largo" icon={<Coffee className="h-3.5 w-3.5" />} unit="min" value={config.longBreakMin} {...limits.longBreakMin} onChange={set('longBreakMin')} />
          <Stepper id="study-every" label="Descanso largo cada" icon={<Repeat className="h-3.5 w-3.5" />} unit="sesiones" value={config.longBreakEvery} {...limits.longBreakEvery} onChange={set('longBreakEvery')} />
        </div>
      )}

      <div className="divide-y divide-[var(--color-md-outline-variant)]/60 rounded-2xl bg-[var(--color-md-surface-container)] px-3">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--color-md-on-surface)]">Iniciar las pausas solas</span>
            <span className="block text-11px text-[var(--color-md-on-surface-variant)]">Al terminar la sesión, la pausa empieza sin tocar nada.</span>
          </span>
          <M3Switch checked={config.autoStartBreaks} onChange={(v) => studyTimer.setConfig({ autoStartBreaks: v })} label="Iniciar las pausas solas" />
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--color-md-on-surface)]">Iniciar las sesiones solas</span>
            <span className="block text-11px text-[var(--color-md-on-surface-variant)]">Al terminar la pausa, la siguiente sesión empieza sola.</span>
          </span>
          <M3Switch checked={config.autoStartPomodoros} onChange={(v) => studyTimer.setConfig({ autoStartPomodoros: v })} label="Iniciar las sesiones solas" />
        </div>
      </div>

      {appliesNext && (
        <p className="text-11px text-[var(--color-md-on-surface-variant)]">Hay una fase en marcha: los cambios de tiempo valen desde la siguiente.</p>
      )}

      <button
        type="button"
        onClick={() => {
          studyTimer.resetConfig();
          setShowCustom(false);
        }}
        disabled={isDefault}
        // Solo se ve activo si hay algo distinto de los valores de fábrica
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[var(--color-md-outline)] text-sm font-bold text-[var(--color-md-primary)] transition-[background-color,transform] duration-150 hover:bg-[var(--color-md-primary)]/[0.08] active:scale-[0.98] active:bg-[var(--color-md-primary)]/[0.14] disabled:pointer-events-none disabled:border-[var(--color-md-outline-variant)] disabled:text-[var(--color-md-on-surface-variant)] disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Restaurar valores por defecto
      </button>
    </section>
  );
};
