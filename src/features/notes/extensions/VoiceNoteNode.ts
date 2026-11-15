import { Node, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import { VoiceNoteNodeView } from '../components/VoiceNoteNodeView';
import { VOICE_NOTE_ATTR } from '../utils/voiceNoteEmbeds';

/**
 * Nodo de bloque «nota de voz»: solo guarda el id de la grabación (el audio vive en IndexedDB,
 * tabla noteAudios) y su nombre al insertarla, que se muestra si la grabación ya no está en este
 * dispositivo. Es un átomo: se selecciona, mueve, copia o borra entero, como una foto.
 */
export const VoiceNoteNode = Node.create({
  name: 'voiceNote',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      audioId: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute(VOICE_NOTE_ATTR) ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({ [VOICE_NOTE_ATTR]: String(attributes.audioId ?? '') }),
      },
      name: {
        default: 'Nota de voz',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-name') ?? 'Nota de voz',
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-name': String(attributes.name ?? '') }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[${VOICE_NOTE_ATTR}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'voice-note-embed' })];
  },

  // Fuera del conteo de palabras y de la vista previa en texto plano
  renderText() {
    return '';
  },

  addNodeView() {
    return ReactNodeViewRenderer(VoiceNoteNodeView, {
      // Los controles del reproductor (reproducir, barra de posición, menú ⋮) son del reproductor:
      // TipTap solo los reconoce si el toque cae justo en el <button>/<input>, no en su ícono SVG,
      // y entonces ProseMirror seleccionaba el bloque y el toque no llegaba al botón
      stopEvent: ({ event }) => event.target instanceof Element && event.target.closest('button, input, a') !== null,
    });
  },
});
