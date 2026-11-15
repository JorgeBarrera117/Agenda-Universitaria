import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { VoiceNoteEmbed } from './VoiceNotes';

/**
 * Reproductor de la nota de voz dentro del editor. Se selecciona con un toque (barra de acciones:
 * mover, subir, bajar, quitar del texto) y en PC también se arrastra con el mouse.
 */
export const VoiceNoteNodeView = ({ node, deleteNode, selected }: ReactNodeViewProps) => {
  const audioId = typeof node.attrs.audioId === 'string' ? node.attrs.audioId : '';
  const name = typeof node.attrs.name === 'string' ? node.attrs.name : '';
  return (
    <NodeViewWrapper className={`voice-note-node ${selected ? 'is-selected' : ''}`} data-drag-handle="">
      <VoiceNoteEmbed audioId={audioId} fallbackName={name} onRemoved={deleteNode} />
    </NodeViewWrapper>
  );
};
