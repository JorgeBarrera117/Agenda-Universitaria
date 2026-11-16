import React, { useState } from 'react';
import { PinPad } from './PinPad';

interface NewPinFlowProps {
  /** PIN nuevo confirmado (4 a 6 dígitos). */
  onDone: (pin: string) => void | Promise<void>;
  onCancel?: () => void;
}

const MAX_LENGTH = 6;
const MIN_LENGTH = 4;

/**
 * Elegir un PIN nuevo: se escribe (de 4 a 6 números) y se repite para confirmarlo. Lo usan la
 * activación del bloqueo, «Cambiar PIN» y la recuperación con el código.
 */
export const NewPinFlow: React.FC<NewPinFlowProps> = ({ onDone, onCancel }) => {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const confirm = async (value: string) => {
    if (value !== first) {
      setError('Los PIN no coinciden. Vuelve a escribirlo.');
      window.setTimeout(() => {
        setSecond('');
        setError(null);
      }, 700);
      return;
    }
    setIsSaving(true);
    try {
      await onDone(value);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="text-center">
        <p className="text-base font-medium text-[var(--color-md-on-surface)]">
          {step === 'enter' ? 'Elige un PIN' : 'Repite el PIN'}
        </p>
        <p className="mt-1 min-h-[1.25rem] text-xs text-[var(--color-md-on-surface-variant)]" role="alert">
          {error ?? (step === 'enter' ? 'De 4 a 6 números. No uses tu fecha de nacimiento.' : 'Para confirmar que lo recuerdas.')}
        </p>
      </div>

      {step === 'enter' ? (
        <PinPad value={first} onChange={setFirst} length={MAX_LENGTH} />
      ) : (
        <PinPad
          value={second}
          onChange={setSecond}
          length={first.length}
          onComplete={(value) => void confirm(value)}
          hasError={error !== null}
          disabled={isSaving}
        />
      )}

      <div className="flex w-full max-w-xs items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            if (step === 'confirm') {
              setStep('enter');
              setSecond('');
              setError(null);
            } else {
              onCancel?.();
            }
          }}
          className="h-10 rounded-full px-4 text-sm font-medium text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/[0.08]"
        >
          {step === 'confirm' ? 'Atrás' : 'Cancelar'}
        </button>
        {step === 'enter' && (
          <button
            type="button"
            disabled={first.length < MIN_LENGTH}
            onClick={() => setStep('confirm')}
            className="h-10 rounded-full bg-[var(--color-md-primary)] px-5 text-sm font-medium text-[var(--color-md-on-primary)] disabled:opacity-40"
          >
            Continuar
          </button>
        )}
      </div>
    </div>
  );
};
