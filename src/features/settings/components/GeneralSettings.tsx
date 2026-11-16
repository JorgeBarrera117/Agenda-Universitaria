import React, { useEffect, useState } from 'react';
import { Clock, Monitor } from 'lucide-react';
import { M3Switch, SettingsBlock, SettingsCard } from './SettingsPrimitives';
import { useAppSettings } from '../hooks/useAppSettings';
import type { TimeFormat } from '../types';

const TIME_FORMATS: { id: TimeFormat; label: string; example: string }[] = [
  { id: '24h', label: '24 horas', example: '15:00' },
  { id: '12h', label: '12 horas', example: '3:00 p. m.' },
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

  return (
    <SettingsCard>
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
              <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">Se abre oculta al encender la computadora.</p>
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
