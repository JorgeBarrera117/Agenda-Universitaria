import { useSyncExternalStore } from 'react';

/**
 * ¿Coincide la media query? Se actualiza al cambiar el tamaño de la ventana. Sirve cuando el
 * cambio es de estructura (qué se muestra y dónde), no solo de estilo: para estilo basta Tailwind.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
