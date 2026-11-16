import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Fingerprint, KeyRound, Lock } from 'lucide-react';
import { BACK_PRIORITY, useBackButton } from '../../../shared/hooks/useBackButton';
import { formInputClass } from '../../../shared/components/form';
import { PinPad } from './PinPad';
import { NewPinFlow } from './NewPinFlow';
import {
  changePin,
  getLockConfig,
  getLockoutRemainingMs,
  verifyPin,
  verifyRecoveryCode,
} from '../services/appLockService';
import { authenticateWithBiometric, isBiometricAvailable } from '../services/biometricService';

interface AppLockScreenProps {
  onUnlock: () => void;
}

type Mode = 'pin' | 'recovery' | 'new-pin';

/**
 * Pantalla de bloqueo: tapa toda la app hasta escribir el PIN, usar la huella (Android) o el código
 * de recuperación (que permite elegir un PIN nuevo). El botón Atrás no la salta.
 */
export const AppLockScreen: React.FC<AppLockScreenProps> = ({ onUnlock }) => {
  const [config] = useState(getLockConfig);
  const [mode, setMode] = useState<Mode>('pin');
  const [pin, setPin] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(getLockoutRemainingMs);
  const [biometricReady, setBiometricReady] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const autoPrompted = useRef(false);

  // El botón Atrás de Android no debe dejar ver la app detrás
  useBackButton(() => true, BACK_PRIORITY.OVERLAY + 50);

  // Cuenta atrás tras varios intentos fallidos
  useEffect(() => {
    if (lockoutMs <= 0) return;
    const timer = window.setInterval(() => setLockoutMs(getLockoutRemainingMs()), 500);
    return () => window.clearInterval(timer);
  }, [lockoutMs]);

  const tryBiometric = useCallback(async () => {
    if (await authenticateWithBiometric()) onUnlock();
  }, [onUnlock]);

  // Huella: si está activada y disponible, se ofrece sola al abrir
  useEffect(() => {
    if (!config?.biometric) return;
    let active = true;
    void isBiometricAvailable().then((available) => {
      if (!active || !available) return;
      setBiometricReady(true);
      if (!autoPrompted.current) {
        autoPrompted.current = true;
        void tryBiometric();
      }
    });
    return () => {
      active = false;
    };
  }, [config?.biometric, tryBiometric]);

  const submitPin = async (value: string) => {
    setIsChecking(true);
    const ok = await verifyPin(value);
    setIsChecking(false);
    if (ok) {
      onUnlock();
      return;
    }
    setHasError(true);
    setLockoutMs(getLockoutRemainingMs());
    window.setTimeout(() => {
      setPin('');
      setHasError(false);
    }, 650);
  };

  const submitRecovery = async () => {
    setIsChecking(true);
    const ok = await verifyRecoveryCode(recoveryCode);
    setIsChecking(false);
    if (ok) {
      setMode('new-pin');
      return;
    }
    setLockoutMs(getLockoutRemainingMs());
    setRecoveryError('El código no es correcto. Revisa que lo hayas escrito igual que lo anotaste.');
  };

  const lockoutSeconds = Math.ceil(lockoutMs / 1000);

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agenda bloqueada"
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-y-auto bg-[var(--color-md-surface)] px-4 py-8 text-[var(--color-md-on-surface)]"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      data-no-swipe="true"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="relative">
            <img src="./app-icon-claro.svg" alt="" className="h-16 w-16 rounded-2xl bg-white object-contain p-1 shadow-sm" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] ring-4 ring-[var(--color-md-surface)]">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </span>
          <div>
            <h1 className="text-xl font-medium">Agenda Universitaria</h1>
            <p className="mt-1 min-h-[1.25rem] text-sm text-[var(--color-md-on-surface-variant)]" role="alert">
              {lockoutMs > 0
                ? `Demasiados intentos. Espera ${lockoutSeconds} s.`
                : mode === 'recovery'
                  ? 'Escribe tu código de recuperación'
                  : mode === 'new-pin'
                    ? 'Código correcto: elige un PIN nuevo'
                    : hasError
                      ? 'PIN incorrecto'
                      : 'Escribe tu PIN para entrar'}
            </p>
          </div>
        </div>

        {mode === 'pin' && config && (
          <>
            <PinPad
              value={pin}
              onChange={setPin}
              length={config.pinLength}
              onComplete={(value) => void submitPin(value)}
              hasError={hasError}
              disabled={isChecking || lockoutMs > 0}
              extraAction={
                biometricReady ? (
                  <button
                    type="button"
                    onClick={() => void tryBiometric()}
                    aria-label="Desbloquear con huella"
                    className="flex h-16 w-16 items-center justify-center rounded-full text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/[0.08]"
                  >
                    <Fingerprint className="h-7 w-7" aria-hidden="true" />
                  </button>
                ) : null
              }
            />
            <button
              type="button"
              onClick={() => {
                setMode('recovery');
                setRecoveryError(null);
              }}
              className="h-10 rounded-full px-4 text-sm font-medium text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/[0.08]"
            >
              ¿Olvidaste tu PIN?
            </button>
          </>
        )}

        {mode === 'recovery' && (
          <form
            className="w-full space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRecovery();
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[var(--color-md-on-surface)]">Código de recuperación</span>
              <input
                value={recoveryCode}
                onChange={(event) => {
                  setRecoveryCode(event.target.value);
                  setRecoveryError(null);
                }}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="XXXX-XXXX-XXXX"
                className={`${formInputClass} text-center font-mono text-lg tracking-widest`}
              />
            </label>
            <p className="text-xs leading-relaxed text-[var(--color-md-on-surface-variant)]">
              {recoveryError ?? 'Es el código que la app te mostró al activar el bloqueo.'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMode('pin')}
                className="h-10 rounded-full px-4 text-sm font-medium text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/[0.08]"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={isChecking || lockoutMs > 0 || recoveryCode.replace(/[^a-z0-9]/gi, '').length < 12}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--color-md-primary)] px-5 text-sm font-medium text-[var(--color-md-on-primary)] disabled:opacity-40"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Verificar
              </button>
            </div>
          </form>
        )}

        {mode === 'new-pin' && (
          <NewPinFlow
            onDone={async (newPin) => {
              await changePin(newPin);
              onUnlock();
            }}
            onCancel={onUnlock}
          />
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
