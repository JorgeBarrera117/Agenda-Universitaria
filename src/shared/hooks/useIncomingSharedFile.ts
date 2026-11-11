import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { WidgetBridge } from '../plugins/widgetBridge';
import type { NoteSharePackage } from '../../features/notes/services/noteShareService';
import type { ProfessorSharePackage } from '../../features/professors/services/professorShareService';

/** Archivo compartido con el que se abrió la app, ya validado. */
export type IncomingSharedFile =
  | { kind: 'note'; sharePackage: NoteSharePackage }
  | { kind: 'contact'; sharePackage: ProfessorSharePackage };

const UNKNOWN_FILE_MESSAGE = 'El archivo no es un apunte ni un contacto de Agenda Universitaria.';

/**
 * Tipo declarado en el archivo ("note" en .agnote, "single_professor" en .agcontact). Ambos
 * formatos escriben "type" al principio, así que basta con mirar el inicio y no se analiza dos
 * veces un apunte grande; si no aparece ahí (archivo editado a mano) se lee el JSON completo.
 */
function declaredType(content: string): string | undefined {
  const head = /"type"\s*:\s*"([a-z_]{1,40})"/.exec(content.slice(0, 300));
  if (head) return head[1];
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
      const { type } = parsed as { type: unknown };
      return typeof type === 'string' ? type : undefined;
    }
  } catch {
    // No es JSON: se informa como archivo desconocido
  }
  return undefined;
}

/**
 * Apunte (.agnote) o contacto (.agcontact) con el que se abrió la app, p. ej. tocado en WhatsApp.
 * Solo en Android: el plugin nativo emite "incomingFile" con el URI, se lee con readContentUri y
 * se valida con el parser de su formato antes de ofrecerlo. El evento queda retenido hasta que
 * este listener se registra, así que también llega en un arranque en frío. onError debe ser
 * estable (useCallback): si cambia, el listener se vuelve a registrar.
 */
export function useIncomingSharedFile(onError: (message: string) => void): {
  incoming: IncomingSharedFile | null;
  clearIncoming: () => void;
} {
  const [incoming, setIncoming] = useState<IncomingSharedFile | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const handle = WidgetBridge.addListener('incomingFile', ({ uri }) => {
      void (async () => {
        try {
          const { content } = await WidgetBridge.readContentUri({ uri });
          // Carga diferida: los validadores (DOMPurify en apuntes) no pesan en el arranque
          let next: IncomingSharedFile;
          switch (declaredType(content)) {
            case 'note': {
              const { parseAgnoteContent } = await import('../../features/notes/services/noteShareService');
              next = { kind: 'note', sharePackage: parseAgnoteContent(content) };
              break;
            }
            case 'single_professor': {
              const { parseAgcontactContent } = await import('../../features/professors/services/professorShareService');
              next = { kind: 'contact', sharePackage: parseAgcontactContent(content) };
              break;
            }
            default:
              throw new Error(UNKNOWN_FILE_MESSAGE);
          }
          if (!disposed) setIncoming(next);
        } catch (err) {
          if (!disposed) onError(err instanceof Error ? err.message : 'No se pudo abrir el archivo recibido.');
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
