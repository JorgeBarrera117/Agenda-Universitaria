import { db } from '../../../shared/db/AppDatabase';
import type { Note, CreateNoteDTO, UpdateNoteDTO } from '../types';

export interface INoteRepository {
  getAll(): Promise<Note[]>;
  getBySubjectId(subjectId: string): Promise<Note[]>;
  getById(id: string): Promise<Note | undefined>;
  search(query: string, subjectId?: string): Promise<Note[]>;
  create(data: CreateNoteDTO): Promise<Note>;
  update(id: string, data: UpdateNoteDTO): Promise<void>;
  delete(id: string): Promise<void>;
}

export class DexieNoteRepository implements INoteRepository {
  async getAll(): Promise<Note[]> {
    const notes = await db.notes.toArray();
    return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getBySubjectId(subjectId: string): Promise<Note[]> {
    const notes = await db.notes.where('subjectId').equals(subjectId).toArray();
    return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getById(id: string): Promise<Note | undefined> {
    return db.notes.get(id);
  }

  async search(query: string, subjectId?: string): Promise<Note[]> {
    const cleanQuery = query.toLowerCase().trim();
    let collection = db.notes.toCollection();

    if (subjectId) {
      collection = db.notes.where('subjectId').equals(subjectId);
    }

    const notes = await collection.filter((note) => {
      const matchTitle = note.title.toLowerCase().includes(cleanQuery);
      const matchContent = note.content.toLowerCase().includes(cleanQuery);
      const matchTag = note.tags.some((t) => t.toLowerCase().includes(cleanQuery));
      return matchTitle || matchContent || matchTag;
    }).toArray();

    return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async create(data: CreateNoteDTO): Promise<Note> {
    const now = new Date().toISOString();
    const note: Note = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.notes.add(note);
    return note;
  }

  async update(id: string, data: UpdateNoteDTO): Promise<void> {
    await db.notes.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.notes, db.noteImages], async () => {
      await db.noteImages.where('noteId').equals(id).delete();
      await db.notes.delete(id);
    });
  }
}

export const noteRepository = new DexieNoteRepository();
