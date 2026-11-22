import { db } from '../../../shared/db/AppDatabase';
import type { StudySession } from '../types';

export interface IStudyRepository {
  /** Guarda una sesión de concentración. */
  add(session: Omit<StudySession, 'id'>): Promise<StudySession>;
  /** Sesiones que empezaron desde `fromIso` (inclusive). */
  since(fromIso: string): Promise<StudySession[]>;
}

export class DexieStudyRepository implements IStudyRepository {
  async add(session: Omit<StudySession, 'id'>): Promise<StudySession> {
    const saved: StudySession = { ...session, minutes: Math.max(1, Math.round(session.minutes)), id: crypto.randomUUID() };
    await db.studySessions.add(saved);
    return saved;
  }

  async since(fromIso: string): Promise<StudySession[]> {
    return db.studySessions.where('startedAt').aboveOrEqual(fromIso).toArray();
  }
}

export const studyRepository = new DexieStudyRepository();
