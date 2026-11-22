import { db } from '../../../shared/db/AppDatabase';
import { scheduleRepository } from '../../schedule/repositories/scheduleRepository';
import { subjectRepository } from '../repositories/subjectRepository';

export interface NewCycleOptions {
  /** Nombre del semestre que termina: queda guardado en cada materia archivada. */
  finishedSemesterName: string;
  /** Quitar las clases del horario semanal para inscribir las nuevas. */
  clearSchedule: boolean;
  /** Archivar las materias en curso (conservan apuntes, archivos y docente). */
  archiveSubjects: boolean;
  /**
   * Quitar de la agenda lo del semestre que termina: lo que ya pasó y las tareas hechas
   * (lo que viene después de `todayKey` se queda).
   */
  clearPastAgenda: boolean;
  /** Hoy, "YYYY-MM-DD". */
  todayKey: string;
}

export interface NewCycleResult {
  archivedSubjects: number;
  removedSlots: number;
  removedAgendaEvents: number;
}

/** ¿Es un evento del semestre que termina? Lo que ya pasó o una tarea ya hecha. */
export function isFinishedAgendaEvent(event: { date: string; endDate?: string; done?: boolean }, todayKey: string): boolean {
  return Boolean(event.done) || (event.endDate ?? event.date) < todayKey;
}

/**
 * Cierra el semestre en curso en una sola transacción: si algo falla, no cambia nada.
 * Nunca toca apuntes, fotos, archivos ni catedráticos: son el historial permanente del
 * estudiante, y los apuntes siguen asociados a su materia (ahora archivada).
 */
export async function startNewAcademicCycle(options: NewCycleOptions): Promise<NewCycleResult> {
  const finishedSemesterName = options.finishedSemesterName.trim() || 'Semestre anterior';
  return db.transaction('rw', [db.subjects, db.scheduleSlots, db.agendaEvents], async () => {
    const removedSlots = options.clearSchedule ? await scheduleRepository.clearAll() : 0;
    const archivedSubjects = options.archiveSubjects ? await subjectRepository.archiveActive(finishedSemesterName) : 0;
    const removedAgendaEvents = options.clearPastAgenda
      ? await db.agendaEvents.filter((event) => isFinishedAgendaEvent(event, options.todayKey)).delete()
      : 0;
    return { archivedSubjects, removedSlots, removedAgendaEvents };
  });
}
