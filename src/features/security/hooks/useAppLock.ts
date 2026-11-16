import { useCallback, useEffect, useRef, useState } from 'react';
import { getLockConfig, isLockEnabled } from '../services/appLockService';
import { isBiometricPromptActive } from '../services/biometricService';

/**
 * Estado del bloqueo de la app: bloqueada al abrir (si el bloqueo está activo) y otra vez al
 * volver después de estar fuera el tiempo elegido en Ajustes. Desactivarlo la desbloquea al momento.
 */
export function useAppLock() {
  const [locked, setLocked] = useState(isLockEnabled);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onChanged = () => {
      if (!isLockEnabled()) setLocked(false);
    };
    window.addEventListener('agenda-app-lock-changed', onChanged);
    return () => window.removeEventListener('agenda-app-lock-changed', onChanged);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      // El diálogo de la huella también pausa la app: no cuenta como «salir»
      if (isBiometricPromptActive()) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        return;
      }
      const config = getLockConfig();
      const since = hiddenAt.current;
      hiddenAt.current = null;
      if (!config || since === null) return;
      if (Date.now() - since >= config.lockAfterMinutes * 60_000) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const unlock = useCallback(() => setLocked(false), []);
  return { locked, unlock };
}
