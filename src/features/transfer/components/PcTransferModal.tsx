import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Smartphone, Wifi } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { restoreFromRawJson } from '../../../shared/utils/backup';
import { QrCodeSvg } from './QrCodeSvg';
import { onPcTransferEvent, startPcTransfer, stopPcTransfer, type PcTransferSession } from '../services/pcTransferService';
import { openTransferPayload } from '../services/transferCrypto';
import { describeBackupSummary, summarizeBackupJson, type BackupSummary, type TransferDirection } from '../services/transferProtocol';

interface PcTransferModalProps {
  direction: TransferDirection;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

type Phase =
  | { kind: 'preparing' }
  | { kind: 'waiting'; session: PcTransferSession; connected: boolean }
  | { kind: 'confirm'; jsonText: string; summary: BackupSummary | null }
  | { kind: 'restoring' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

/** Quita el prefijo que Electron añade a los errores de IPC ("Error invoking remote method…"). */
function cleanError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || fallback;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * App de Windows: muestra el QR y espera al teléfono. Recibir del teléfono pide confirmación (con
 * lo que trae el respaldo) antes de reemplazar los datos de la PC.
 */
export const PcTransferModal: React.FC<PcTransferModalProps> = ({ direction, onClose, onShowToast }) => {
  const [phase, setPhase] = useState<Phase>({ kind: 'preparing' });
  const [now, setNow] = useState(() => Date.now());
  const sessionRef = useRef<PcTransferSession | null>(null);
  const runId = useRef(0);

  const start = useCallback(() => {
    const id = ++runId.current;
    startPcTransfer(direction).then(
      (session) => {
        if (id !== runId.current) {
          stopPcTransfer();
          return;
        }
        sessionRef.current = session;
        setNow(Date.now());
        setPhase({ kind: 'waiting', session, connected: false });
      },
      (error: unknown) => {
        if (id === runId.current) setPhase({ kind: 'error', message: cleanError(error, 'No se pudo preparar la transferencia.') });
      }
    );
  }, [direction]);

  // Abre el servidor al mostrar la ventana y lo cierra al salir
  useEffect(() => {
    start();
    return () => {
      runId.current += 1;
      stopPcTransfer();
    };
  }, [start]);

  useEffect(
    () =>
      onPcTransferEvent((event) => {
        switch (event.type) {
          case 'connected':
            setPhase((current) => (current.kind === 'waiting' ? { ...current, connected: true } : current));
            break;
          case 'received': {
            const key = sessionRef.current?.invite.key;
            if (!key) return;
            void openTransferPayload(event.payload, key, 'to-pc')
              .then((jsonText) => setPhase({ kind: 'confirm', jsonText, summary: summarizeBackupJson(jsonText) }))
              .catch((error: unknown) => setPhase({ kind: 'error', message: cleanError(error, 'Los datos llegaron dañados.') }));
            break;
          }
          case 'sent':
            setPhase({ kind: 'done', message: 'Listo: el teléfono ya recibió los datos de esta computadora.' });
            break;
          case 'expired':
            setPhase({ kind: 'error', message: 'El código venció sin que el teléfono se conectara. Genera uno nuevo.' });
            break;
          case 'blocked':
            setPhase({ kind: 'error', message: 'Se cerró la conexión por demasiados intentos no válidos desde la red.' });
            break;
          case 'error':
            setPhase({ kind: 'error', message: 'La conexión falló. Vuelve a intentarlo.' });
            break;
        }
      }),
    []
  );

  // Cuenta atrás del código
  useEffect(() => {
    if (phase.kind !== 'waiting') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [phase.kind]);

  const retry = () => {
    setPhase({ kind: 'preparing' });
    start();
  };

  const replaceData = async (jsonText: string) => {
    setPhase({ kind: 'restoring' });
    try {
      await restoreFromRawJson(jsonText);
      setPhase({ kind: 'done', message: 'Listo: esta computadora ya tiene los datos del teléfono.' });
      onShowToast('Datos del teléfono guardados en esta computadora.');
    } catch (error: unknown) {
      setPhase({ kind: 'error', message: cleanError(error, 'No se pudieron guardar los datos recibidos.') });
    }
  };

  const close = () => {
    if (phase.kind === 'restoring') return;
    onClose();
  };

  const toPc = direction === 'to-pc';

  return (
    <Modal isOpen onClose={close} title={toPc ? 'Recibir del teléfono' : 'Enviar al teléfono'} maxWidth="md">
      {phase.kind === 'preparing' && (
        <StatusLine icon={<Loader2 className="h-5 w-5 animate-spin" />} text={toPc ? 'Preparando la conexión…' : 'Preparando y cifrando tus datos…'} />
      )}

      {phase.kind === 'waiting' && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/10">
              <QrCodeSvg value={phase.session.inviteText} size={224} label="Código para escanear con el teléfono" />
            </div>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--color-md-on-surface)]">
            <li>
              En el teléfono, en el inicio, toca <strong>⋮ → Pasar datos con la PC</strong> (también está en Ajustes → Datos
              y copias de seguridad).
            </li>
            <li>Apunta la cámara a este código.</li>
          </ol>

          {!toPc && (
            <p className="text-xs text-[var(--color-md-on-surface-variant)]">
              El teléfono reemplazará sus materias, horario y apuntes por los de esta computadora.
            </p>
          )}

          <p
            role="status"
            className="flex items-center gap-2 rounded-xl bg-[var(--color-md-surface-container-high)] px-3 py-2 text-sm text-[var(--color-md-on-surface)]"
          >
            {phase.connected ? (
              <>
                <Smartphone className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                Teléfono conectado. Confirma en el teléfono para continuar…
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--color-md-primary)]" aria-hidden="true" />
                Esperando al teléfono · el código vence en {formatRemaining(phase.session.expiresAt - now)}
              </>
            )}
          </p>

          <p className="flex items-start gap-2 text-11px leading-relaxed text-[var(--color-md-on-surface-variant)]">
            <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Los dos deben estar en la misma red wifi. Si Windows pregunta, permite el acceso en redes privadas. Los datos
            viajan cifrados y no pasan por internet.
          </p>

          <ModalActions>
            <Button variant="ghost" size="sm" onClick={close}>
              Cancelar
            </Button>
          </ModalActions>
        </div>
      )}

      {phase.kind === 'confirm' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-md-on-surface)]">
            Llegaron los datos del teléfono
            {phase.summary ? (
              <>
                : <strong>{describeBackupSummary(phase.summary)}</strong>.
              </>
            ) : (
              '.'
            )}
          </p>
          <p className="flex items-start gap-2 rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-3 text-xs text-[var(--color-md-on-surface)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
            Las materias, docentes, horario y apuntes de esta computadora se reemplazarán por los del teléfono. No se puede
            deshacer.
          </p>
          <ModalActions>
            <Button variant="ghost" size="sm" onClick={close}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={() => void replaceData(phase.jsonText)}>
              Reemplazar datos
            </Button>
          </ModalActions>
        </div>
      )}

      {phase.kind === 'restoring' && <StatusLine icon={<Loader2 className="h-5 w-5 animate-spin" />} text="Guardando los datos…" />}

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
            <Button variant="primary" size="sm" onClick={retry}>
              Generar otro código
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
