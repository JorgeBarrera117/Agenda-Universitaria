import React from 'react';
import { Bell, CheckCircle2, Clock, Loader2, Send, ShieldAlert, Volume2 } from 'lucide-react';
import { M3Switch, SettingsBlock, SettingsCard, ToggleChip } from './SettingsPrimitives';
import type { AppSettings } from '../types';

type SpecificNotificationKey = 'notify15MinBefore' | 'notifyAtClassStart' | 'notificationSound';

interface NotificationSettingsProps {
  settings: AppSettings;
  hasPermission: boolean | null;
  isTesting: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  onToggleSpecific: (key: SpecificNotificationKey) => void;
  onRequestPermission: () => void;
  onTestNotification: () => void;
}

const MOMENTS: { key: SpecificNotificationKey; label: string; icon: React.ReactNode }[] = [
  { key: 'notify15MinBefore', label: '15 min antes', icon: <Clock className="h-4 w-4" /> },
  { key: 'notifyAtClassStart', label: 'Al iniciar', icon: <Bell className="h-4 w-4" /> },
  { key: 'notificationSound', label: 'Sonido', icon: <Volume2 className="h-4 w-4" /> },
];

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  settings,
  hasPermission,
  isTesting,
  onToggleNotifications,
  onToggleSpecific,
  onRequestPermission,
  onTestNotification,
}) => (
  <SettingsCard>
    <section className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-[var(--color-md-on-surface)]">Recordatorios de clases</h3>
        <p className="text-xs text-[var(--color-md-on-surface-variant)]">Alertas locales en tu teléfono antes de cada materia.</p>
      </div>
      <M3Switch checked={settings.notificationsEnabled} onChange={onToggleNotifications} label="Recordatorios de clases" />
    </section>

    {/* Estado del permiso del sistema y prueba */}
    <div className="flex flex-col gap-2 rounded-xl bg-[var(--color-md-surface-container)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-xs font-semibold text-[var(--color-md-on-surface)]" role="status">
        {hasPermission === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
        ) : hasPermission ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--color-md-primary)]" aria-hidden="true" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
        )}
        Permiso del sistema:{' '}
        {hasPermission === null ? 'comprobando…' : hasPermission ? 'concedido' : 'pendiente'}
      </p>
      <div className="flex items-center gap-2">
        {hasPermission === false && (
          <button
            type="button"
            onClick={onRequestPermission}
            className="inline-flex h-9 items-center rounded-full bg-[var(--color-md-primary)] px-4 text-xs font-bold text-[var(--color-md-on-primary)] shadow-2xs transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-95"
          >
            Conceder
          </button>
        )}
        <button
          type="button"
          onClick={onTestNotification}
          disabled={isTesting}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-md-outline)] px-4 text-xs font-bold text-[var(--color-md-primary)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-95 disabled:opacity-50"
        >
          {isTesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Probar aviso
        </button>
      </div>
    </div>

    <SettingsBlock
      title="Momentos de aviso"
      description={settings.notificationsEnabled ? 'Elige cuándo avisarte.' : 'Activa los recordatorios para elegir los momentos.'}
    >
      <div className="flex flex-wrap gap-2">
        {MOMENTS.map((moment) => (
          <ToggleChip
            key={moment.key}
            selected={settings[moment.key]}
            onToggle={() => onToggleSpecific(moment.key)}
            icon={moment.icon}
            label={moment.label}
            disabled={!settings.notificationsEnabled}
          />
        ))}
      </div>
    </SettingsBlock>
  </SettingsCard>
);
