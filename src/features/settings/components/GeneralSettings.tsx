import React, { useEffect, useState } from 'react';
import { ALargeSmall, Clock, Monitor } from 'lucide-react';
import { M3Switch, SettingsBlock, SettingsCard } from './SettingsPrimitives';
import { useAppSettings } from '../hooks/useAppSettings';
import { TEXT_SCALE_FACTORS, type TextScale, type TimeFormat } from '../types';

const TIME_FORMATS: { id: TimeFormat; label: string; example: string }[] = [
  { id: '24h', label: '24 horas', example: '15:00' },
  { id: '12h', label: '12 horas', example: '3:00 p. m.' },
];

const TEXT_SCALES: { id: TextScale; label: string }[] = [
  { id: 'small', label: 'Pequeño' },
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Grande' },
  { id: 'xlarge', label: 'Muy grande' },
];

/** Ajustes → General: formato de hora y, en Windows, iniciar con el sistema. */
export const GeneralSettings: React.FC = () => {
  const { settings, updateSettings } = useAppSettings();
  const desktop = window.electronAPI;
  const [launchAtLogin, setLaunchAtLogin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!desktop?.getLaunchAtLogin) return;
    let active = true;
    void desktop.getLaunchAtLogin().then((enabled) => {
      if (active) setLaunchAtLogin(enabled);
    });
    return () => {
      active = false;
    };
  }, [desktop]);

  const current = settings.timeFormat ?? '24h';
  const currentScale = settings.textScale ?? 'normal';

  return (
    <SettingsCard>
      <SettingsBlock
        title="Tamaño del texto"
        description="Agranda o achica las letras de toda la app. El cambio se ve al instante."
        icon={<ALargeSmall className="h-4 w-4" />}
      >
        <div role="radiogroup" aria-label="Tamaño del texto" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEXT_SCALES.map((option) => {
            const selected = currentScale === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updateSettings({ textScale: option.id })}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2 transition-colors ${
                  selected
                    ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                    : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-on-surface)]/[0.06]'
                }`}
              >
                {/* Muestra fija (en px): enseña cómo se verá cada tamaño sin depender del actual */}
                <span aria-hidden="true" className="font-display font-medium leading-none" style={{ fontSize: `${Math.round(20 * TEXT_SCALE_FACTORS[option.id])}px` }}>
                  Aa
                </span>
                <span className="text-xs font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 rounded-xl bg-[var(--color-md-surface-container-high)] px-3 py-2 text-sm text-[var(--color-md-on-surface)]">
          Así se lee un texto con este tamaño: <strong>Cálculo Diferencial · Aula 204</strong>
        </p>
      </SettingsBlock>

      <SettingsBlock title="Formato de hora" description="Cómo se ven las horas en el horario, avisos y widgets." icon={<Clock className="h-4 w-4" />}>
        <div role="radiogroup" aria-label="Formato de hora" className="grid grid-cols-2 gap-2">
          {TIME_FORMATS.map((option) => {
            const selected = current === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updateSettings({ timeFormat: option.id })}
                className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                    : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-on-surface)]/[0.06]'
                }`}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block font-mono text-xs opacity-80">{option.example}</span>
              </button>
            );
          })}
        </div>
      </SettingsBlock>

      {desktop?.getLaunchAtLogin && (
        <SettingsBlock
          title="Esta computadora"
          description="Al cerrar la ventana, la agenda sigue en la bandeja del sistema (junto al reloj) para avisarte."
          icon={<Monitor className="h-4 w-4" />}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--color-md-on-surface)]">Iniciar con Windows</p>
              <p className="text-11px text-[var(--color-md-on-surface-variant)]">Se abre oculta al encender la computadora.</p>
            </div>
            <M3Switch
              checked={launchAtLogin ?? false}
              disabled={launchAtLogin === null}
              onChange={(enabled) => void desktop.setLaunchAtLogin(enabled).then(setLaunchAtLogin)}
              label="Iniciar con Windows"
            />
          </div>
        </SettingsBlock>
      )}
    </SettingsCard>
  );
};
