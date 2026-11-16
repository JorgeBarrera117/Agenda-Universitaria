import React, { useState } from 'react';
import { Download, MonitorSmartphone, ScanQrCode, Send } from 'lucide-react';
import { SettingsBlock, SettingsCard } from '../../settings/components/SettingsPrimitives';
import { hostKind } from '../services/transferAvailability';
import { TransferTile } from './TransferTile';
import { TransferLauncher, type TransferAction } from './TransferLauncher';

interface DeviceTransferCardProps {
  onShowToast: (message: string) => void;
}

/**
 * Ajustes → Datos y copias de seguridad: pasar los datos a otro dispositivo por wifi con un
 * código QR.
 * - Windows: recibir del teléfono o enviar al teléfono.
 * - Android: además, escanear el código de otro dispositivo.
 */
export const DeviceTransferCard: React.FC<DeviceTransferCardProps> = ({ onShowToast }) => {
  const [action, setAction] = useState<TransferAction | null>(null);
  const kind = hostKind();

  if (!kind) return null;
  const isPhone = kind === 'phone';

  return (
    <SettingsCard>
      <SettingsBlock
        title={isPhone ? 'Pasar datos con otro dispositivo' : 'Pasar datos con el teléfono'}
        description={
          isPhone
            ? 'Con otro teléfono o con la PC, por wifi o con el punto de acceso de un teléfono. Sin cables ni internet.'
            : 'Por tu wifi, sin cables ni internet. El teléfono y la computadora deben estar en la misma red.'
        }
        icon={<MonitorSmartphone className="h-4 w-4" />}
      >
        <div className={`grid grid-cols-1 gap-2 ${isPhone ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {isPhone && (
            <TransferTile
              icon={<ScanQrCode className="h-4 w-4" />}
              title="Escanear un código"
              subtitle="El de la PC u otro teléfono"
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
      </SettingsBlock>

      {action && <TransferLauncher initialAction={action} onClose={() => setAction(null)} onShowToast={onShowToast} />}
    </SettingsCard>
  );
};
