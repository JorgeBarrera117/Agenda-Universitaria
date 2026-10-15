export interface Note {
  id: string;
  subjectId: string;
  title: string;
  content: string; // Markdown
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteImage {
  id: string;
  noteId: string;
  name: string;
  mimeType: string;
  blob: Blob;
  createdAt: string;
}

export type CreateNoteDTO = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateNoteDTO = Partial<CreateNoteDTO>;
export type CreateNoteImageDTO = Omit<NoteImage, 'id' | 'createdAt'>;
