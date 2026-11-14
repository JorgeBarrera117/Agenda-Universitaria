import { db } from '../../../shared/db/AppDatabase';
import type { NoteAudio } from '../types';

export interface INoteAudioRepository {
  getByNoteId(noteId: string): Promise<NoteAudio[]>;
  add(noteId: string, name: string, blob: Blob, mimeType: string, durationMs: number): Promise<NoteAudio>;
  rename(id: string, name: string): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByNoteId(noteId: string): Promise<void>;
}

const MAX_NAME_LENGTH = 80;

/** Repositorio Dexie de las notas de voz de cada apunte (el audio se guarda como Blob en IndexedDB). */
export class DexieNoteAudioRepository implements INoteAudioRepository {
  async getByNoteId(noteId: string): Promise<NoteAudio[]> {
    const audios = await db.noteAudios.where('noteId').equals(noteId).toArray();
    return audios.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async add(noteId: string, name: string, blob: Blob, mimeType: string, durationMs: number): Promise<NoteAudio> {
    const audio: NoteAudio = {
      id: crypto.randomUUID(),
      noteId,
      name: name.trim().slice(0, MAX_NAME_LENGTH) || 'Nota de voz',
      mimeType,
      blob,
      durationMs: Math.max(0, Math.round(durationMs)),
      createdAt: new Date().toISOString(),
    };
    await db.noteAudios.add(audio);
    return audio;
  }

  async rename(id: string, name: string): Promise<void> {
    const clean = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!clean) throw new Error('Escribe un nombre para la grabación.');
    await db.noteAudios.update(id, { name: clean });
  }

  async delete(id: string): Promise<void> {
    await db.noteAudios.delete(id);
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    await db.noteAudios.where('noteId').equals(noteId).delete();
  }
}

export const noteAudioRepository = new DexieNoteAudioRepository();
