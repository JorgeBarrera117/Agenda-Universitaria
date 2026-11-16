import React, { Suspense, lazy, useState } from 'react';
import { MonitorSmartphone, ScanQrCode, Send, Download } from 'lucide-react';
import { SettingsBlock, SettingsCard } from '../../settings/components/SettingsPrimitives';
import { canHostTransfer, canScanTransfer } from '../services/transferAvailability';
import { TransferTile } from './TransferTile';
import type { TransferDirection } from '../services/transferProtocol';

// Se cargan al abrirlas: el lector de QR y el generador solo hacen falta en ese momento
const PcTransferModal = lazy(() => import('./PcTransferModal').then((m) => ({ default: m.PcTransferModal })));
const PhoneTransferModal = lazy(() => import('./PhoneTransferModal').then((m) => ({ default: m.PhoneTransferModal })));

interface DeviceTransferCardProps {
  onShowToast: (message: string) => void;
}

/**
 * Ajustes → Datos y copias de seguridad: pasar los datos entre el teléfono y la PC por wifi con un
 * código QR. En Windows se elige la dirección y se muestra el código; en Android se escanea.
 */
export const DeviceTransferCard: React.FC<DeviceTransferCardProps> = ({ onShowToast }) => {
  const [pcDirection, setPcDirection] = useState<TransferDirection | null>(null);
  const [scanning, setScanning] = useState(false);
  const host = canHostTransfer();
  const scan = canScanTransfer();

  if (!host && !scan) return null;

  return (
    <SettingsCard>
      <SettingsBlock
        title={host ? 'Pasar datos con el teléfono' : 'Pasar datos con la computadora'}
        description={
          host
            ? 'Por tu wifi, sin cables ni internet. El teléfono y la computadora deben estar en la misma red.'
            : 'En la app de Windows, en el inicio, toca ⋮ → Pasar datos con el teléfono y escanea el código que aparece. Los dos deben estar en la misma red wifi.'
        }
        icon={<MonitorSmartphone className="h-4 w-4" />}
      >
        {host ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <TransferTile
              icon={<Download className="h-4 w-4" />}
              title="Recibir del teléfono"
              subtitle="Trae aquí los datos del teléfono"
              onClick={() => setPcDirection('to-pc')}
            />
            <TransferTile
              icon={<Send className="h-4 w-4" />}
              title="Enviar al teléfono"
              subtitle="Lleva al teléfono los datos de aquí"
              onClick={() => setPcDirection('to-phone')}
            />
          </div>
        ) : (
          <TransferTile
            icon={<ScanQrCode className="h-4 w-4" />}
            title="Escanear código de la PC"
            subtitle="Enviar o recibir, según elegiste en la PC"
            onClick={() => setScanning(true)}
          />
        )}
      </SettingsBlock>

      <Suspense fallback={null}>
        {pcDirection && <PcTransferModal direction={pcDirection} onClose={() => setPcDirection(null)} onShowToast={onShowToast} />}
        {scanning && <PhoneTransferModal onClose={() => setScanning(false)} onShowToast={onShowToast} />}
      </Suspense>
    </SettingsCard>
  );
};
