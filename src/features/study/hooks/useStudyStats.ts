import { useLiveQuery } from 'dexie-react-hooks';
import { studyRepository } from '../repositories/studyRepository';

export interface StudySubjectStats {
  /** '' = sin materia. */
  subjectId: string;
  minutes: number;
  /** Sesiones de concentración guardadas (terminadas o cortadas a mitad). */
  sessions: number;
}

export interface StudyWeekStats {
  /** Minutos estudiados esta semana (de lunes a hoy). */
  totalMinutes: number;
  /** Por materia, de más a menos minutos. */
  bySubject: StudySubjectStats[];
  sessions: number;
  /** Minutos de cada día, de lunes (0) a domingo (6). */
  byDay: number[];
}

const EMPTY: StudyWeekStats = { totalMinutes: 0, bySubject: [], sessions: 0, byDay: [0, 0, 0, 0, 0, 0, 0] };

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

/** "1 sesión", "3 sesiones". */
export function formatSessions(count: number): string {
  return `${count} ${count === 1 ? 'sesión' : 'sesiones'}`;
}

/** Lo estudiado esta semana, en vivo (se actualiza al terminar cada sesión). */
export function useStudyWeekStats(): StudyWeekStats {
  return useLiveQuery(
    async () => {
      const sessions = await studyRepository.since(startOfWeekIso());
      const bySubject = new Map<string, StudySubjectStats>();
      const byDay = [0, 0, 0, 0, 0, 0, 0];
      let totalMinutes = 0;
      for (const session of sessions) {
        totalMinutes += session.minutes;
        const key = session.subjectId ?? '';
        const row = bySubject.get(key) ?? { subjectId: key, minutes: 0, sessions: 0 };
        row.minutes += session.minutes;
        row.sessions += 1;
        bySubject.set(key, row);
        // Día de la semana local, con el lunes como 0
        byDay[(new Date(session.startedAt).getDay() + 6) % 7] += session.minutes;
      }
      return {
        totalMinutes,
        sessions: sessions.length,
        byDay,
        bySubject: [...bySubject.values()].sort((a, b) => b.minutes - a.minutes),
      };
    },
    [],
    EMPTY
  );
}
