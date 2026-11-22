import { useLiveQuery } from 'dexie-react-hooks';
import { studyRepository } from '../repositories/studyRepository';

export interface StudyWeekStats {
  /** Minutos estudiados esta semana (de lunes a hoy). */
  totalMinutes: number;
  /** Minutos por materia ('' = sin materia), de mayor a menor. */
  bySubject: { subjectId: string; minutes: number }[];
  sessions: number;
}

const EMPTY: StudyWeekStats = { totalMinutes: 0, bySubject: [], sessions: 0 };

/** Lunes de esta semana a las 00:00 (hora local), en ISO. */
export function startOfWeekIso(now = new Date()): string {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday.toISOString();
}

/** "2 h 30 min", "45 min", "0 min". */
export function formatStudyMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Lo estudiado esta semana, en vivo (se actualiza al terminar cada sesión). */
export function useStudyWeekStats(): StudyWeekStats {
  return useLiveQuery(
    async () => {
      const sessions = await studyRepository.since(startOfWeekIso());
      const bySubject = new Map<string, number>();
      let totalMinutes = 0;
      for (const session of sessions) {
        totalMinutes += session.minutes;
        const key = session.subjectId ?? '';
        bySubject.set(key, (bySubject.get(key) ?? 0) + session.minutes);
      }
      return {
        totalMinutes,
        sessions: sessions.length,
        bySubject: [...bySubject.entries()].map(([subjectId, minutes]) => ({ subjectId, minutes })).sort((a, b) => b.minutes - a.minutes),
      };
    },
    [],
    EMPTY
  );
}
