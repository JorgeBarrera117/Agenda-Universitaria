import React, { Suspense, lazy, useState } from 'react';
import { Download, ScanQrCode, Send } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { TransferTile } from './TransferTile';
import { canScanTransfer, hostKind } from '../services/transferAvailability';
import type { TransferDirection } from '../services/transferProtocol';

const HostTransferModal = lazy(() => import('./HostTransferModal').then((m) => ({ default: m.HostTransferModal })));
const PhoneTransferModal = lazy(() => import('./PhoneTransferModal').then((m) => ({ default: m.PhoneTransferModal })));

/** Qué abrir: el menú de opciones, el lector de QR o directamente mostrar un QR para recibir/enviar. */
export type TransferAction = 'choose' | 'scan' | TransferDirection;

interface TransferLauncherProps {
  initialAction?: TransferAction;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

/**
 * Punto de entrada único a la transferencia por QR (menú Compartir del inicio y Ajustes).
 * - PC: elegir entre recibir del teléfono o enviar al teléfono (la PC muestra el QR).
 * - Teléfono: escanear el QR de otro dispositivo, o mostrar uno para enviar o recibir de otro
 *   teléfono.
 */
export const TransferLauncher: React.FC<TransferLauncherProps> = ({ initialAction = 'choose', onClose, onShowToast }) => {
  const [action, setAction] = useState<TransferAction>(initialAction);
  const kind = hostKind();
  const isPhone = kind === 'phone';

  if (action === 'scan' && canScanTransfer()) {
    return (
      <Suspense fallback={null}>
        <PhoneTransferModal onClose={onClose} onShowToast={onShowToast} />
      </Suspense>
    );
  }

  if ((action === 'to-pc' || action === 'to-phone') && kind) {
    return (
      <Suspense fallback={null}>
        <HostTransferModal direction={action} onClose={onClose} onShowToast={onShowToast} />
      </Suspense>
    );
  }

  if (!kind) return null;

  return (
    <Modal isOpen onClose={onClose} title={isPhone ? 'Pasar datos con otro dispositivo' : 'Pasar datos con el teléfono'} maxWidth="sm">
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-md-on-surface-variant)]">
          {isPhone
            ? 'Por wifi o con el punto de acceso de un teléfono, sin cables ni internet. Todo viaja cifrado.'
            : 'Por tu wifi, sin cables ni internet. El teléfono y la computadora deben estar en la misma red.'}
        </p>

        {isPhone && (
          <TransferTile
            icon={<ScanQrCode className="h-4 w-4" />}
            title="Escanear un código"
            subtitle="El que muestra la PC u otro teléfono"
            onClick={() => setAction('scan')}
          />
        )}
        <TransferTile
          icon={<Send className="h-4 w-4" />}
          title={isPhone ? 'Enviar a otro teléfono' : 'Enviar al teléfono'}
          subtitle={isPhone ? 'Este teléfono muestra un código' : 'Lleva al teléfono los datos de aquí'}
          onClick={() => setAction('to-phone')}
        />
        <TransferTile
          icon={<Download className="h-4 w-4" />}
          title={isPhone ? 'Recibir de otro teléfono' : 'Recibir del teléfono'}
          subtitle={isPhone ? 'Este teléfono muestra un código' : 'Trae aquí los datos del teléfono'}
          onClick={() => setAction('to-pc')}
        />
      </div>
    </Modal>
  );
};
