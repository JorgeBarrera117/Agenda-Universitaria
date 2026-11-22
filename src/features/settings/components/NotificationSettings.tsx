import React from 'react';
import { Bell, CheckCircle2, Clock, ExternalLink, Loader2, Send, ShieldAlert, Sunrise, Volume2 } from 'lucide-react';
import { M3Switch, SettingsBlock, SettingsCard, ToggleChip } from './SettingsPrimitives';
import { NotificationTonePicker } from './NotificationTonePicker';
import { REMINDER_LEAD_OPTIONS, type AppSettings, type NotificationSoundTone, type ReminderLeadMinutes } from '../types';
import { TimePickerField } from '../../../shared/components/pickers/TimePickerField';

type SpecificNotificationKey = 'notify15MinBefore' | 'notifyAtClassStart' | 'notificationSound';

interface NotificationSettingsProps {
  settings: AppSettings;
  hasPermission: boolean | null;
  isTesting: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  onToggleSpecific: (key: SpecificNotificationKey) => void;
  onRequestPermission: () => void;
  onTestNotification: () => void;
  onSelectTone: (tone: NotificationSoundTone) => void;
  /** Cambia otros ajustes de avisos (anticipación, resumen del día). */
  onUpdate: (partial: Partial<AppSettings>) => void;
}

const MOMENTS: { key: SpecificNotificationKey; label: string; icon: React.ReactNode }[] = [
  { key: 'notify15MinBefore', label: 'Antes de la clase', icon: <Clock className="h-4 w-4" /> },
  { key: 'notifyAtClassStart', label: 'Al iniciar', icon: <Bell className="h-4 w-4" /> },
  { key: 'notificationSound', label: 'Sonido', icon: <Volume2 className="h-4 w-4" /> },
];

/** Solo en la versión de escritorio: acceso a los ajustes de notificaciones de Windows. */
const DesktopNotificationLink: React.FC = () => {
  const desktop = window.electronAPI;
  if (!desktop?.openNotificationSettings) return null;
  return (
    <button
      type="button"
      onClick={() => void desktop.openNotificationSettings()}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-md-primary)] hover:underline"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      Ajustes de notificaciones de Windows
    </button>
  );
};

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  settings,
  hasPermission,
  isTesting,
  onToggleNotifications,
  onToggleSpecific,
  onRequestPermission,
  onTestNotification,
  onSelectTone,
  onUpdate,
}) => (
  <SettingsCard>
    <section className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-[var(--color-md-on-surface)]">Recordatorios de clases</h3>
        <p className="text-xs text-[var(--color-md-on-surface-variant)]">Alertas locales en este dispositivo antes de cada materia.</p>
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
      {settings.notificationsEnabled && settings.notify15MinBefore && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold text-[var(--color-md-on-surface)]">¿Cuánto antes?</p>
          <div role="radiogroup" aria-label="Minutos de anticipación" className="flex flex-wrap gap-2">
            {REMINDER_LEAD_OPTIONS.map((minutes) => {
              const selected = (settings.reminderLeadMinutes ?? 15) === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onUpdate({ reminderLeadMinutes: minutes as ReminderLeadMinutes })}
                  className={`h-8 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    selected
                      ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                      : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/[0.06]'
                  }`}
                >
                  {minutes === 60 ? '1 h' : `${minutes} min`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </SettingsBlock>

    <SettingsBlock
      title="Resumen del día"
      description="Cada mañana, un aviso con las clases que tienes ese día."
      icon={<Sunrise className="h-4 w-4" />}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`flex items-center gap-2 text-xs font-semibold ${settings.dailySummaryEnabled ? 'text-[var(--color-md-on-surface)]' : 'text-[var(--color-md-on-surface-variant)]'}`}>
          <span aria-hidden="true">Hora del aviso</span>
          <TimePickerField
            id="daily-summary-time"
            value={settings.dailySummaryTime || '07:00'}
            disabled={!settings.notificationsEnabled || !settings.dailySummaryEnabled}
            onChange={(time) => time && onUpdate({ dailySummaryTime: time })}
            ariaLabel="Hora del resumen del día"
            dialogTitle="Hora del resumen del día"
            className="w-36"
          />
        </div>
        <M3Switch
          checked={Boolean(settings.dailySummaryEnabled)}
          disabled={!settings.notificationsEnabled}
          onChange={(enabled) => onUpdate({ dailySummaryEnabled: enabled })}
          label="Resumen del día"
        />
      </div>
    </SettingsBlock>

    {settings.notificationsEnabled && settings.notificationSound && (
      <SettingsBlock title="Tono de notificación" description="Elige la campana o timbre para tus alertas de clase. Toca ▶ para escucharlo." icon={<Volume2 className="h-4 w-4" />}>
        <NotificationTonePicker value={settings.notificationTone} onSelect={onSelectTone} />
      </SettingsBlock>
    )}

    <DesktopNotificationLink />
  </SettingsCard>
);
