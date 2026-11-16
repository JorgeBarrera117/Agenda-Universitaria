import React, { useEffect, useState } from 'react';
import { Check, Copy, Fingerprint, KeyRound, LockKeyhole, ShieldCheck, Timer } from 'lucide-react';
import { M3Switch, SettingsBlock, SettingsCard } from '../../settings/components/SettingsPrimitives';
import { PinPad } from './PinPad';
import { NewPinFlow } from './NewPinFlow';
import {
  LOCK_AFTER_OPTIONS,
  changePin,
  disableLock,
  enableLock,
  getLockConfig,
  getLockoutRemainingMs,
  updateLockOptions,
  verifyPin,
  type LockAfterMinutes,
} from '../services/appLockService';
import { isBiometricAvailable } from '../services/biometricService';

interface SecuritySettingsProps {
  onShowToast: (message: string) => void;
}

type View = 'main' | 'setup' | 'recovery-code' | 'verify-change' | 'verify-disable' | 'change';

const LOCK_AFTER_LABELS: Record<LockAfterMinutes, string> = {
  0: 'Siempre',
  1: '1 min',
  5: '5 min',
  15: '15 min',
};

/** Ajustes → Bloqueo de la app: PIN, código de recuperación, huella y cuándo volver a pedirlo. */
export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ onShowToast }) => {
  const [config, setConfig] = useState(getLockConfig);
  const [view, setView] = useState<View>('main');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [verifyValue, setVerifyValue] = useState('');
  const [verifyError, setVerifyError] = useState(false);

  useEffect(() => {
    void isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  const refresh = () => setConfig(getLockConfig());

  const verifyCurrent = async (value: string, next: () => void) => {
    if (await verifyPin(value)) {
      setVerifyValue('');
      next();
      return;
    }
    setVerifyError(true);
    window.setTimeout(() => {
      setVerifyValue('');
      setVerifyError(false);
    }, 650);
  };

  if (view === 'setup' || view === 'change') {
    return (
      <SettingsCard>
        <NewPinFlow
          onCancel={() => setView('main')}
          onDone={async (pin) => {
            if (view === 'setup') {
              setRecoveryCode(await enableLock(pin));
              refresh();
              setView('recovery-code');
            } else {
              await changePin(pin);
              refresh();
              setView('main');
              onShowToast('PIN cambiado.');
            }
          }}
        />
      </SettingsCard>
    );
  }

  if (view === 'recovery-code' && recoveryCode) {
    return (
      <SettingsCard>
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
            <KeyRound className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-medium text-[var(--color-md-on-surface)]">Tu código de recuperación</h3>
            <p className="text-xs leading-relaxed text-[var(--color-md-on-surface-variant)]">
              Si olvidas el PIN, este código te deja entrar y elegir otro. Anótalo en un lugar seguro (fuera de este
              dispositivo): <strong>solo se muestra esta vez</strong>.
            </p>
          </div>
          <p className="select-all rounded-2xl bg-[var(--color-md-surface-container-high)] px-4 py-3 font-mono text-xl font-bold tracking-widest text-[var(--color-md-on-surface)]">
            {recoveryCode}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(recoveryCode).then(() => setCopied(true));
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-md-outline)] px-4 text-sm font-medium text-[var(--color-md-primary)]"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRecoveryCode(null);
                setCopied(false);
                setView('main');
                onShowToast('Bloqueo activado.');
              }}
              className="h-10 rounded-full bg-[var(--color-md-primary)] px-5 text-sm font-medium text-[var(--color-md-on-primary)]"
            >
              Ya lo anoté
            </button>
          </div>
        </div>
      </SettingsCard>
    );
  }

  if ((view === 'verify-change' || view === 'verify-disable') && config) {
    const lockedOut = getLockoutRemainingMs() > 0;
    return (
      <SettingsCard>
        <div className="flex flex-col items-center gap-4 py-2">
          <p className="text-center text-sm font-medium text-[var(--color-md-on-surface)]">
            {lockedOut ? 'Demasiados intentos. Espera unos segundos.' : verifyError ? 'PIN incorrecto' : 'Escribe tu PIN actual'}
          </p>
          <PinPad
            value={verifyValue}
            onChange={setVerifyValue}
            length={config.pinLength}
            hasError={verifyError}
            disabled={lockedOut}
            onComplete={(value) =>
              void verifyCurrent(value, () => {
                if (view === 'verify-change') {
                  setView('change');
                } else {
                  disableLock();
                  refresh();
                  setView('main');
                  onShowToast('Bloqueo desactivado.');
                }
              })
            }
          />
          <button
            type="button"
            onClick={() => {
              setVerifyValue('');
              setView('main');
            }}
            className="h-10 rounded-full px-4 text-sm font-medium text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/[0.08]"
          >
            Cancelar
          </button>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard>
      <section className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]">
          {config ? <ShieldCheck className="h-5 w-5" aria-hidden="true" /> : <LockKeyhole className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-bold text-[var(--color-md-on-surface)]">{config ? 'Bloqueo activo' : 'Protege tu agenda con un PIN'}</h3>
          <p className="text-xs leading-relaxed text-[var(--color-md-on-surface-variant)]">
            Al abrir la app se pide tu PIN{biometricAvailable ? ' o tu huella' : ''}, así nadie más puede ver tus apuntes en este
            dispositivo. Es una protección de acceso: tus datos no se cifran.
          </p>
        </div>
      </section>

      {!config ? (
        <button
          type="button"
          onClick={() => setView('setup')}
          className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-[var(--color-md-primary)] px-5 text-sm font-medium text-[var(--color-md-on-primary)]"
        >
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          Activar bloqueo con PIN
        </button>
      ) : (
        <>
          {biometricAvailable && (
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <Fingerprint className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--color-md-on-surface)]">Desbloquear con huella</span>
                  <span className="block text-xs text-[var(--color-md-on-surface-variant)]">O con el bloqueo de pantalla del teléfono.</span>
                </span>
              </span>
              <M3Switch
                checked={config.biometric}
                onChange={(enabled) => {
                  updateLockOptions({ biometric: enabled });
                  refresh();
                }}
                label="Desbloquear con huella"
              />
            </div>
          )}

          <SettingsBlock
            title="Volver a pedir el PIN"
            description="Después de salir de la app durante…"
            icon={<Timer className="h-4 w-4" />}
          >
            <div role="radiogroup" aria-label="Volver a pedir el PIN" className="flex flex-wrap gap-2">
              {LOCK_AFTER_OPTIONS.map((minutes) => {
                const selected = config.lockAfterMinutes === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      updateLockOptions({ lockAfterMinutes: minutes });
                      refresh();
                    }}
                    className={`h-8 rounded-lg border px-3 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                        : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/[0.06]'
                    }`}
                  >
                    {LOCK_AFTER_LABELS[minutes]}
                  </button>
                );
              })}
            </div>
            {config.lockAfterMinutes === 0 && (
              <p className="mt-2 text-[11px] text-[var(--color-md-on-surface-variant)]">
                Con «Siempre» también se pide al volver de tomar una foto o de compartir un archivo.
              </p>
            )}
          </SettingsBlock>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView('verify-change')}
              className="h-10 rounded-full border border-[var(--color-md-outline)] px-4 text-sm font-medium text-[var(--color-md-primary)]"
            >
              Cambiar PIN
            </button>
            <button
              type="button"
              onClick={() => setView('verify-disable')}
              className="h-10 rounded-full px-4 text-sm font-medium text-red-700 hover:bg-red-600/10 dark:text-red-300"
            >
              Desactivar bloqueo
            </button>
          </div>
        </>
      )}
    </SettingsCard>
  );
};
