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

/** Nota de voz grabada dentro de un apunte (tabla noteAudios). */
export interface NoteAudio {
  id: string;
  noteId: string;
  name: string;
  /** p. ej. "audio/webm;codecs=opus" (Android/Chrome/Windows) o "audio/mp4" (Safari). */
  mimeType: string;
  blob: Blob;
  /** Medida al grabar: los WebM de MediaRecorder no traen la duración en sus metadatos. */
  durationMs: number;
  createdAt: string;
}

export type CreateNoteDTO = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateNoteDTO = Partial<CreateNoteDTO>;
export type CreateNoteImageDTO = Omit<NoteImage, 'id' | 'createdAt'>;
