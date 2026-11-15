import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { DAY_NAMES, type ScheduleSlot } from '../types';

interface DeleteSlotDialogProps {
  /** Clase a quitar; null = cerrado. */
  slot: ScheduleSlot | null;
  subjectName?: string;
  onCancel: () => void;
  onConfirm: (slot: ScheduleSlot) => Promise<void>;
}

/**
 * Confirmación para quitar una clase del horario (la usan el horario y la ficha de la materia).
 * Dice exactamente qué bloque se borra (día y horas): una materia suele tener varias clases y es
 * fácil confundir cuál se está quitando. La materia y sus apuntes no se tocan.
 */
export const DeleteSlotDialog: React.FC<DeleteSlotDialogProps> = ({ slot, subjectName, onCancel, onConfirm }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!slot) return;
    setIsDeleting(true);
    try {
      await onConfirm(slot);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={slot !== null} onClose={onCancel} title="¿Eliminar esta clase?" maxWidth="sm">
      {slot && (
        <p className="text-sm text-[var(--color-md-on-surface-variant)]">
          Se quitará del horario la clase{subjectName ? <> de <strong className="text-[var(--color-md-on-surface)]">{subjectName}</strong></> : null} del{' '}
          <strong className="text-[var(--color-md-on-surface)]">
            {DAY_NAMES[slot.dayOfWeek].toLowerCase()}, {slot.startTime} – {slot.endTime}
          </strong>
          . La materia y tus apuntes se conservan.
        </p>
      )}
      <ModalActions>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isDeleting}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          isLoading={isDeleting}
          onClick={() => void handleConfirm()}
        >
          Eliminar
        </Button>
      </ModalActions>
    </Modal>
  );
};
