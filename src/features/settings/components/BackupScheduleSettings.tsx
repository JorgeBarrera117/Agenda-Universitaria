import React, { useEffect, useState } from 'react';
import { BellRing, CalendarClock, CloudOff, History } from 'lucide-react';
import { M3Switch, SettingsCard } from './SettingsPrimitives';
import { useAppSettings } from '../hooks/useAppSettings';
import {
  AUTO_BACKUP_INTERVAL_DAYS,
  BACKUP_REMINDER_AFTER_DAYS,
  autoBackupLocation,
  canAutoBackup,
  describeDaysAgo,
  getLastBackupAt,
} from '../../../shared/services/backupScheduleService';

/**
 * Copias programadas (Ajustes → Datos y copias de seguridad): cuándo fue el último respaldo, copia
 * automática semanal (solo donde se puede guardar sin preguntar) y recordatorio.
 */
export const BackupScheduleSettings: React.FC = () => {
  const { settings, updateSettings } = useAppSettings();
  const [lastBackup, setLastBackup] = useState<Date | null>(getLastBackupAt);
  const autoAvailable = canAutoBackup();

  // Se actualiza al exportar desde esta misma pantalla
  useEffect(() => {
    const refresh = () => setLastBackup(getLastBackupAt());
    window.addEventListener('agenda-backup-done', refresh);
    return () => window.removeEventListener('agenda-backup-done', refresh);
  }, []);

  const row = (
    icon: React.ReactNode,
    title: string,
    description: string,
    control: React.ReactNode
  ) => (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--color-md-on-surface)]">{title}</span>
          <span className="block text-xs text-[var(--color-md-on-surface-variant)]">{description}</span>
        </span>
      </span>
      {control}
    </div>
  );

  return (
    <SettingsCard>
      <p
        // Aviso informativo plano (sin relleno ni relieve): no compite con los botones de acción
        className={`flex items-center gap-2 border-l-2 py-1 pl-3 text-xs font-semibold ${
          lastBackup
            ? 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)]'
            : 'border-amber-500 text-amber-900 dark:text-amber-200'
        }`}
        role="status"
      >
        {lastBackup ? <History className="h-4 w-4 shrink-0" aria-hidden="true" /> : <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {lastBackup
          ? `Último respaldo: ${describeDaysAgo(lastBackup)} (${lastBackup.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })})`
          : 'Aún no has hecho ninguna copia de seguridad en este dispositivo.'}
      </p>

      {autoAvailable
        ? row(
            <CalendarClock className="h-4 w-4" aria-hidden="true" />,
            'Copia automática semanal',
            `Cada ${AUTO_BACKUP_INTERVAL_DAYS} días, al abrir la app, se guarda una copia en ${autoBackupLocation()}.`,
            <M3Switch
              checked={Boolean(settings.autoBackupEnabled)}
              onChange={(enabled) => updateSettings({ autoBackupEnabled: enabled })}
              label="Copia automática semanal"
            />
          )
        : null}

      {row(
        <BellRing className="h-4 w-4" aria-hidden="true" />,
        'Recordarme hacer una copia',
        settings.autoBackupEnabled && autoAvailable
          ? 'No hace falta mientras la copia automática esté activa.'
          : `Te avisa si pasan ${BACKUP_REMINDER_AFTER_DAYS} días sin copia de seguridad.`,
        <M3Switch
          checked={settings.backupReminderEnabled !== false}
          onChange={(enabled) => updateSettings({ backupReminderEnabled: enabled })}
          label="Recordarme hacer una copia"
        />
      )}

      {!autoAvailable && (
        <p className="text-11px leading-relaxed text-[var(--color-md-on-surface-variant)]">
          En el navegador no se pueden guardar copias solas (siempre pide permiso para descargar). En el teléfono o en la
          computadora sí.
        </p>
      )}
    </SettingsCard>
  );
};
