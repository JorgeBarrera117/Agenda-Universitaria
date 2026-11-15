import { useCallback, useState } from 'react';
import { VOICE_NOTE_ATTR } from '../utils/voiceNoteEmbeds';

export interface VoiceNoteSlot {
  /** Marcador `<div data-voice-note>` del HTML ya insertado en la página. */
  element: HTMLElement;
  audioId: string;
  name: string;
}

/**
 * Lector del apunte: el HTML se muestra con dangerouslySetInnerHTML, así que los reproductores de
 * las notas de voz se montan después, con portales de React dentro de cada marcador.
 *
 * Devuelve un callback ref para el contenedor del HTML. Cambia con cada HTML nuevo: React lo vuelve
 * a llamar justo después de reemplazar el contenido y así se localizan los marcadores nuevos.
 */
export function useVoiceNoteSlots(html: string) {
  const [slots, setSlots] = useState<VoiceNoteSlot[]>([]);

  const containerRef = useCallback(
    (container: HTMLElement | null) => {
      if (!container || !html.includes(VOICE_NOTE_ATTR)) {
        setSlots((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      setSlots(
        Array.from(container.querySelectorAll<HTMLElement>(`[${VOICE_NOTE_ATTR}]`)).map((element) => ({
          element,
          audioId: element.getAttribute(VOICE_NOTE_ATTR) ?? '',
          name: element.getAttribute('data-name') ?? '',
        }))
      );
    },
    [html]
  );

  return { containerRef, slots };
}
