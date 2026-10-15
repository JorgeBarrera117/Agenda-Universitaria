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
    await db.professors.add(professor);
    return professor;
  }

  async update(id: string, data: UpdateProfessorDTO): Promise<void> {
    await db.professors.update(id, data);
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.professors, db.scheduleSlots], async () => {
      // Limpiar referencia de profesor en los slots de horario
      await db.scheduleSlots.where('professorId').equals(id).modify({ professorId: undefined });
      await db.professors.delete(id);
    });
  }
}

export const professorRepository = new DexieProfessorRepository();
