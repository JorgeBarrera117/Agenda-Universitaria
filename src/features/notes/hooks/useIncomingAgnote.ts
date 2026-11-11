import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { WidgetBridge } from '../../../shared/plugins/widgetBridge';
import type { NoteSharePackage } from '../services/noteShareService';

/**
 * Apunte .agnote con el que se abrió la app (p. ej. tocado en WhatsApp). Solo en Android: el
 * plugin nativo emite "incomingFile" con el URI, se lee con readContentUri y se valida antes de
 * ofrecerlo. El evento queda retenido hasta que este listener se registra, así que también llega
 * en un arranque en frío. onError debe ser estable (useCallback): si cambia, el listener se
 * vuelve a registrar.
 */
export function useIncomingAgnote(onError: (message: string) => void): {
  incoming: NoteSharePackage | null;
  clearIncoming: () => void;
} {
  const [incoming, setIncoming] = useState<NoteSharePackage | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const handle = WidgetBridge.addListener('incomingFile', ({ uri }) => {
      void (async () => {
        try {
          const { content } = await WidgetBridge.readContentUri({ uri });
          // Carga diferida: el validador (DOMPurify) no pesa en el arranque de la app
          const { parseAgnoteContent } = await import('../services/noteShareService');
          const sharePackage = parseAgnoteContent(content);
          if (!disposed) setIncoming(sharePackage);
        } catch (err) {
          if (!disposed) onError(err instanceof Error ? err.message : 'No se pudo abrir el apunte recibido.');
        }
      })();
    });
    return () => {
      disposed = true;
      void handle.then((h) => h.remove());
    };
  }, [onError]);

  return { incoming, clearIncoming: () => setIncoming(null) };
}
