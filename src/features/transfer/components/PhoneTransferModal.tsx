import React, { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Monitor } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { restoreFromRawJson } from '../../../shared/utils/backup';
import { QrScanner } from './QrScanner';
import { connectToPc, receiveBackupFromPc, sendBackupToPc, type PcConnection } from '../services/phoneTransferClient';
import { parseInviteText, type TransferInvite } from '../services/transferProtocol';

interface PhoneTransferModalProps {
  onClose: () => void;
  onShowToast: (message: string) => void;
}

type Phase =
  | { kind: 'scanning'; hint: string | null }
  | { kind: 'connecting' }
  | { kind: 'confirm'; invite: TransferInvite; connection: PcConnection }
  | { kind: 'working'; label: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * App de Android: escanea el QR de la PC, se conecta y, tras confirmar, envía o recibe los datos.
 * La dirección (enviar o recibir) la elige la PC y va dentro del QR.
 */
export const PhoneTransferModal: React.FC<PhoneTransferModalProps> = ({ onClose, onShowToast }) => {
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning', hint: null });

  const handleDetected = useCallback((text: string): boolean => {
    const invite = parseInviteText(text);
    if (!invite) {
      setPhase({
        kind: 'scanning',
        hint: text.startsWith('agenda-transfer:')
          ? 'Ese código es de otra versión de la agenda. Actualiza las dos apps.'
          : 'Ese código no es de la Agenda Universitaria.',
      });
      return false;
    }
    setPhase({ kind: 'connecting' });
    void connectToPc(invite)
      .then((connection) => setPhase({ kind: 'confirm', invite, connection }))
      .catch((error: unknown) => setPhase({ kind: 'error', message: errorMessage(error, 'No se pudo conectar con la computadora.') }));
    return true;
  }, []);

  const run = async (invite: TransferInvite, connection: PcConnection) => {
    try {
      if (invite.direction === 'to-pc') {
        setPhase({ kind: 'working', label: 'Preparando, cifrando y enviando tus datos…' });
        await sendBackupToPc(connection, invite);
        setPhase({ kind: 'done', message: `Datos enviados a «${connection.pcName}». Termina de confirmar en la computadora.` });
      } else {
        setPhase({ kind: 'working', label: 'Recibiendo los datos de la computadora…' });
        const jsonText = await receiveBackupFromPc(connection, invite);
        setPhase({ kind: 'working', label: 'Guardando los datos…' });
        await restoreFromRawJson(jsonText);
        setPhase({ kind: 'done', message: `Listo: este teléfono ya tiene los datos de «${connection.pcName}».` });
        onShowToast('Datos de la computadora guardados en este teléfono.');
      }
    } catch (error: unknown) {
      setPhase({ kind: 'error', message: errorMessage(error, 'La transferencia falló. Vuelve a intentarlo.') });
    }
  };

  const close = () => {
    if (phase.kind === 'working') return;
    onClose();
  };

  return (
    <Modal isOpen onClose={close} title="Pasar datos con la PC" maxWidth="md">
      {phase.kind === 'scanning' && (
        <div className="space-y-4">
          <QrScanner onDetected={handleDetected} />
          <p role="status" className="min-h-[2.5rem] text-center text-sm text-[var(--color-md-on-surface-variant)]">
            {phase.hint ?? 'Apunta la cámara al código que muestra la app de Windows.'}
          </p>
          <ModalActions>
            <Button variant="ghost" size="sm" onClick={close}>
              Cancelar
            </Button>
          </ModalActions>
        </div>
      )}

      {phase.kind === 'connecting' && <StatusLine icon={<Loader2 className="h-5 w-5 animate-spin" />} text="Conectando con la computadora…" />}

      {phase.kind === 'confirm' && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-md-on-surface)]">
            <Monitor className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
            Conectado con «{phase.connection.pcName}»
          </p>
          {phase.invite.direction === 'to-pc' ? (
            <p className="text-sm text-[var(--color-md-on-surface-variant)]">
              Se enviará una copia de todos tus datos (materias, horario y apuntes con sus fotos y audios) a la computadora.
              Allí tendrás que confirmar antes de que se guarden.
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-3 text-xs text-[var(--color-md-on-surface)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
              Las materias, docentes, horario y apuntes de este teléfono se reemplazarán por los de la computadora. No se
              puede deshacer: si quieres conservar lo de aquí, haz antes una copia.
            </p>
          )}
          <ModalActions>
            <Button variant="ghost" size="sm" onClick={close}>
              Cancelar
            </Button>
            {phase.invite.direction === 'to-pc' ? (
              <Button variant="primary" size="sm" onClick={() => void run(phase.invite, phase.connection)}>
                Enviar
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={() => void run(phase.invite, phase.connection)}>
                Recibir y reemplazar
              </Button>
            )}
          </ModalActions>
        </div>
      )}

      {phase.kind === 'working' && <StatusLine icon={<Loader2 className="h-5 w-5 animate-spin" />} text={phase.label} />}

      {phase.kind === 'done' && (
        <div className="space-y-4">
          <StatusLine icon={<CheckCircle2 className="h-5 w-5" />} text={phase.message} />
          <ModalActions>
            <Button variant="primary" size="sm" onClick={close}>
              Listo
            </Button>
          </ModalActions>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="space-y-4">
          <StatusLine icon={<AlertTriangle className="h-5 w-5" />} text={phase.message} />
          <ModalActions>
            <Button variant="ghost" size="sm" onClick={close}>
              Cerrar
            </Button>
            <Button variant="primary" size="sm" onClick={() => setPhase({ kind: 'scanning', hint: null })}>
              Volver a escanear
            </Button>
          </ModalActions>
        </div>
      )}
    </Modal>
  );
};

const StatusLine: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <p role="status" className="flex items-start gap-3 py-2 text-sm text-[var(--color-md-on-surface)]">
    <span className="shrink-0 text-[var(--color-md-primary)]" aria-hidden="true">
      {icon}
    </span>
    <span>{text}</span>
  </p>
);
