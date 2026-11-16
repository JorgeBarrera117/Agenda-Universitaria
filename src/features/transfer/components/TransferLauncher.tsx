import React, { Suspense, lazy, useState } from 'react';
import { Download, Send } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { TransferTile } from './TransferTile';
import { canHostTransfer, canScanTransfer } from '../services/transferAvailability';
import type { TransferDirection } from '../services/transferProtocol';

const PcTransferModal = lazy(() => import('./PcTransferModal').then((m) => ({ default: m.PcTransferModal })));
const PhoneTransferModal = lazy(() => import('./PhoneTransferModal').then((m) => ({ default: m.PhoneTransferModal })));

interface TransferLauncherProps {
  onClose: () => void;
  onShowToast: (message: string) => void;
}

/**
 * Acceso directo a la transferencia por QR (menú ⋮ del inicio). Se monta al abrirlo.
 * - Teléfono: abre el lector de QR al momento.
 * - PC: primero pregunta si se recibe o se envía, porque la dirección la decide la PC.
 */
export const TransferLauncher: React.FC<TransferLauncherProps> = ({ onClose, onShowToast }) => {
  const [direction, setDirection] = useState<TransferDirection | null>(null);

  if (canScanTransfer()) {
    return (
      <Suspense fallback={null}>
        <PhoneTransferModal onClose={onClose} onShowToast={onShowToast} />
      </Suspense>
    );
  }

  if (!canHostTransfer()) return null;

  if (direction) {
    return (
      <Suspense fallback={null}>
        <PcTransferModal direction={direction} onClose={onClose} onShowToast={onShowToast} />
      </Suspense>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="Pasar datos con el teléfono" maxWidth="sm">
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-md-on-surface-variant)]">
          Por tu wifi, sin cables ni internet. El teléfono y la computadora deben estar en la misma red.
        </p>
        <TransferTile
          icon={<Download className="h-4 w-4" />}
          title="Recibir del teléfono"
          subtitle="Trae aquí los datos del teléfono"
          onClick={() => setDirection('to-pc')}
        />
        <TransferTile
          icon={<Send className="h-4 w-4" />}
          title="Enviar al teléfono"
          subtitle="Lleva al teléfono los datos de aquí"
          onClick={() => setDirection('to-phone')}
        />
      </div>
    </Modal>
  );
};
