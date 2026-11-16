import React, { Suspense, lazy, useState } from 'react';
import { MonitorSmartphone, ScanQrCode, Send, Download } from 'lucide-react';
import { SettingsBlock, SettingsCard } from '../../settings/components/SettingsPrimitives';
import { canHostTransfer, canScanTransfer } from '../services/transferAvailability';
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
            : 'Abre la app de Windows en Ajustes → Datos y copias de seguridad → Pasar datos con el teléfono, y escanea el código que aparece. Los dos deben estar en la misma red wifi.'
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

const TransferTile: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }> = ({
  icon,
  title,
  subtitle,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-transparent bg-[var(--color-md-primary-container)] px-3 py-2 text-left text-[var(--color-md-on-primary-container)] transition-all duration-150 ease-out hover:brightness-[0.97] active:scale-[0.98]"
  >
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]"
    >
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block truncate text-xs font-bold">{title}</span>
      <span className="block truncate text-[11px] opacity-80">{subtitle}</span>
    </span>
  </button>
);
