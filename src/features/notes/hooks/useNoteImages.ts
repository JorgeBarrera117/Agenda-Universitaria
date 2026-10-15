import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../shared/db/AppDatabase';
import { noteImageRepository } from '../repositories/noteImageRepository';

export function useNoteImages(noteId?: string) {
  const images = useLiveQuery(
    async () => {
      if (!noteId) return [];
      return db.noteImages.where('noteId').equals(noteId).toArray();
    },
    [noteId]
  );

  const addImage = async (file: File) => {
    if (!noteId) throw new Error('Se requiere un ID de apunte para vincular la imagen.');
    return noteImageRepository.addFromFile(noteId, file);
  };

  const removeImage = async (id: string) => {
    return noteImageRepository.delete(id);
  };

  return {
    images: images ?? [],
    isLoading: images === undefined,
    addImage,
    removeImage,
  };
}
