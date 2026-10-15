import { useEffect, useRef } from 'react';
import {
  backButtonManager,
  type BackHandlerFn,
  BACK_PRIORITY,
} from '../services/backButtonManager';

export { BACK_PRIORITY };

/**
 * Hook para suscribir un componente a la pila global del botón Atrás de Android.
 *
 * @param handler Función a ejecutar cuando el usuario presiona el botón "Atrás".
 *                Retornar `true` o `void` si se consumió el evento.
 *                Retornar `false` si se desea propagar al siguiente nivel inferior.
 * @param priority Prioridad en la pila (definida en BACK_PRIORITY). Mayor valor = se ejecuta primero.
 * @param enabled Booleano para activar o desactivar la suscripción dinámicamente.
 */
export function useBackButton(
  handler: BackHandlerFn,
  priority: number,
  enabled: boolean = true
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const id = `back-${priority}-${Math.random().toString(36).slice(2, 8)}`;
    const unregister = backButtonManager.register({
      id,
      priority,
      handler: () => handlerRef.current(),
    });

    return () => {
      unregister();
    };
  }, [priority, enabled]);
}
