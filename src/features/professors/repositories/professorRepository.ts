import { db } from '../../../shared/db/AppDatabase';
import type { Professor, CreateProfessorDTO, UpdateProfessorDTO } from '../types';

export interface IProfessorRepository {
  getAll(): Promise<Professor[]>;
  getById(id: string): Promise<Professor | undefined>;
  create(data: CreateProfessorDTO): Promise<Professor>;
  update(id: string, data: UpdateProfessorDTO): Promise<void>;
  delete(id: string): Promise<void>;
}

export class DexieProfessorRepository implements IProfessorRepository {
  async getAll(): Promise<Professor[]> {
    return db.professors.toArray();
  }

  async getById(id: string): Promise<Professor | undefined> {
    return db.professors.get(id);
  }

  async create(data: CreateProfessorDTO): Promise<Professor> {
    const professor: Professor = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    await db.transaction('rw', [db.professors, db.subjects], async () => {
      await db.professors.add(professor);

      // Sincronización bidireccional: asignar este docente a las materias seleccionadas
      if (professor.subjectIds && professor.subjectIds.length > 0) {
        for (const subjectId of professor.subjectIds) {
          await db.subjects.update(subjectId, { professorId: professor.id });
        }
      }
    });

    return professor;
  }

  async update(id: string, data: UpdateProfessorDTO): Promise<void> {
    await db.transaction('rw', [db.professors, db.subjects], async () => {
      await db.professors.update(id, data);

      if (data.subjectIds) {
        // Encontrar materias que tenían asignado a este profesor
        const assignedSubjects = await db.subjects.where('professorId').equals(id).toArray();
        for (const sub of assignedSubjects) {
          if (!data.subjectIds.includes(sub.id)) {
            await db.subjects.update(sub.id, { professorId: undefined });
          }
        }

        // Asignar a las materias seleccionadas
        for (const sid of data.subjectIds) {
          await db.subjects.update(sid, { professorId: id });
        }
      }
    });
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.professors, db.scheduleSlots, db.subjects], async () => {
      // Limpiar referencia de profesor en los slots de horario y en las materias
      await db.scheduleSlots.where('professorId').equals(id).modify({ professorId: undefined });
      await db.subjects.where('professorId').equals(id).modify({ professorId: undefined });
      await db.professors.delete(id);
    });
  }
}

export const professorRepository = new DexieProfessorRepository();
