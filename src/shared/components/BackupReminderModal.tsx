import React from 'react';
import { DatabaseBackup } from 'lucide-react';
import { Modal, ModalActions } from './Modal';
import { Button } from './atoms';

interface BackupReminderModalProps {
  /** Días sin copia de seguridad (null = nunca se hizo una). */
  daysWithoutBackup: number | null;
  onBackupNow: () => void;
  onLater: () => void;
}

/**
 * Recordatorio de copia de seguridad: los datos viven solo en este dispositivo y sin una copia se
 * pierden si el teléfono se pierde o se borra la app. Se puede desactivar en Ajustes.
 */
export const BackupReminderModal: React.FC<BackupReminderModalProps> = ({ daysWithoutBackup, onBackupNow, onLater }) => (
  <Modal isOpen onClose={onLater} title="¿Hacemos una copia de seguridad?" maxWidth="sm">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]">
        <DatabaseBackup className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="space-y-2 text-sm text-[var(--color-md-on-surface-variant)]">
        <p>
          {daysWithoutBackup === null
            ? 'Aún no has guardado ninguna copia de tu agenda.'
            : `Hace ${daysWithoutBackup} días que no guardas una copia de tu agenda.`}{' '}
          Tus materias, horario y apuntes viven solo en este dispositivo: con una copia no los pierdes si cambias de
          teléfono o algo falla.
        </p>
        <p className="text-xs">Puedes activar la copia automática o apagar este recordatorio en Ajustes.</p>
      </div>
    </div>
    <ModalActions>
      <Button variant="ghost" size="sm" onClick={onLater}>
        Más tarde
      </Button>
      <Button variant="primary" size="sm" icon={<DatabaseBackup className="h-4 w-4" aria-hidden="true" />} onClick={onBackupNow}>
        Hacer una copia
      </Button>
    </ModalActions>
  </Modal>
);
