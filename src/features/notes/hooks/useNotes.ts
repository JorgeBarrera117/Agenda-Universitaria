import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../shared/db/AppDatabase';
import { noteRepository } from '../repositories/noteRepository';
import type { CreateNoteDTO, UpdateNoteDTO } from '../types';

export function useNotes(subjectFilterId?: string, searchQuery?: string) {
  const notes = useLiveQuery(
    async () => {
      let queryCollection = db.notes.toCollection();

      if (subjectFilterId && subjectFilterId !== 'all') {
        queryCollection = db.notes.where('subjectId').equals(subjectFilterId);
      }

      let result = await queryCollection.toArray();

      if (searchQuery && searchQuery.trim().length > 0) {
        const clean = searchQuery.toLowerCase().trim();
        result = result.filter(
          (n) =>
            n.title.toLowerCase().includes(clean) ||
            n.content.toLowerCase().includes(clean) ||
            n.tags.some((t) => t.toLowerCase().includes(clean))
        );
      }

      return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    [subjectFilterId, searchQuery],
    []
  );

  const addNote = async (dto: CreateNoteDTO) => {
    return noteRepository.create(dto);
  };

  const updateNote = async (id: string, dto: UpdateNoteDTO) => {
    return noteRepository.update(id, dto);
  };

  const removeNote = async (id: string) => {
    return noteRepository.delete(id);
  };

  return {
    notes: notes ?? [],
    isLoading: false,
    addNote,
    updateNote,
    removeNote,
  };
}
