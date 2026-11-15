import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../shared/db/AppDatabase';
import { noteAudioRepository } from '../repositories/noteAudioRepository';

/** Notas de voz de un apunte, en vivo (se actualiza solo al grabar, renombrar o borrar). */
export function useNoteAudios(noteId?: string) {
  const audios = useLiveQuery(
    async () => {
      if (!noteId) return [];
      return noteAudioRepository.getByNoteId(noteId);
    },
    [noteId]
  );

  const addAudio = async (blob: Blob, mimeType: string, durationMs: number, name: string) => {
    if (!noteId) throw new Error('Guarda el apunte antes de añadir una grabación.');
    return noteAudioRepository.add(noteId, name, blob, mimeType, durationMs);
  };

  return {
    audios: audios ?? [],
    isLoading: audios === undefined,
    addAudio,
    renameAudio: (id: string, name: string) => noteAudioRepository.rename(id, name),
    removeAudio: (id: string) => noteAudioRepository.delete(id),
  };
}

/**
 * Una nota de voz por id, en vivo: la usa el reproductor insertado en el texto del apunte.
 * `audio` es undefined mientras carga y null si la grabación ya no existe.
 */
export function useNoteAudio(audioId: string) {
  const audio = useLiveQuery(async () => (audioId ? ((await noteAudioRepository.getById(audioId)) ?? null) : null), [audioId]);
  return {
    audio,
    renameAudio: (name: string) => noteAudioRepository.rename(audioId, name),
    removeAudio: () => noteAudioRepository.delete(audioId),
  };
}

/** Conteo de notas de voz por apunte (solo claves del índice, sin leer los audios). */
export function useNoteAudioCounts(): Record<string, number> {
  const counts = useLiveQuery(async () => {
    const noteIds = (await db.noteAudios.orderBy('noteId').keys()) as string[];
    const result: Record<string, number> = {};
    for (const id of noteIds) result[id] = (result[id] || 0) + 1;
    return result;
  }, []);
  return counts ?? {};
}
