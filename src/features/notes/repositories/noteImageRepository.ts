import { db } from '../../../shared/db/AppDatabase';
import { compressImage } from '../utils/imageCompression';
import type { NoteImage } from '../types';

export interface INoteImageRepository {
  getByNoteId(noteId: string): Promise<NoteImage[]>;
  getById(id: string): Promise<NoteImage | undefined>;
  addFromFile(noteId: string, file: File): Promise<NoteImage>;
  addBlob(noteId: string, name: string, blob: Blob, mimeType: string): Promise<NoteImage>;
  delete(id: string): Promise<void>;
  deleteByNoteId(noteId: string): Promise<void>;
}

export class DexieNoteImageRepository implements INoteImageRepository {
  async getByNoteId(noteId: string): Promise<NoteImage[]> {
    const images = await db.noteImages.where('noteId').equals(noteId).toArray();
    return images.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getById(id: string): Promise<NoteImage | undefined> {
    return db.noteImages.get(id);
  }

  async addFromFile(noteId: string, file: File): Promise<NoteImage> {
    // Comprimir en el cliente antes de persistir el Blob en IndexedDB
    const { blob, mimeType } = await compressImage(file);
    return this.addBlob(noteId, file.name, blob, mimeType);
  }

  async addBlob(noteId: string, name: string, blob: Blob, mimeType: string): Promise<NoteImage> {
    const noteImage: NoteImage = {
      id: crypto.randomUUID(),
      noteId,
      name,
      mimeType,
      blob,
      createdAt: new Date().toISOString(),
    };
    await db.noteImages.add(noteImage);
    return noteImage;
  }

  async delete(id: string): Promise<void> {
    await db.noteImages.delete(id);
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    await db.noteImages.where('noteId').equals(noteId).delete();
  }
}

export const noteImageRepository = new DexieNoteImageRepository();
