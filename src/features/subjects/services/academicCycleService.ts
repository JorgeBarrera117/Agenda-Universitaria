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
}

export interface NewCycleResult {
  archivedSubjects: number;
  removedSlots: number;
}

/**
 * Cierra el semestre en curso en una sola transacción: si algo falla, no cambia nada.
 * Nunca toca apuntes, fotos, archivos ni catedráticos: son el historial permanente del
 * estudiante, y los apuntes siguen asociados a su materia (ahora archivada).
 */
export async function startNewAcademicCycle(options: NewCycleOptions): Promise<NewCycleResult> {
  const finishedSemesterName = options.finishedSemesterName.trim() || 'Semestre anterior';
  return db.transaction('rw', [db.subjects, db.scheduleSlots], async () => {
    const removedSlots = options.clearSchedule ? await scheduleRepository.clearAll() : 0;
    const archivedSubjects = options.archiveSubjects ? await subjectRepository.archiveActive(finishedSemesterName) : 0;
    return { archivedSubjects, removedSlots };
  });
}
