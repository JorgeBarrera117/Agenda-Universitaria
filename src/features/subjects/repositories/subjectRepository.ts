import { db } from '../../../shared/db/AppDatabase';
import type { Subject, CreateSubjectDTO, UpdateSubjectDTO } from '../types';

export interface ISubjectRepository {
  getAll(): Promise<Subject[]>;
  getById(id: string): Promise<Subject | undefined>;
  create(data: CreateSubjectDTO): Promise<Subject>;
  update(id: string, data: UpdateSubjectDTO): Promise<void>;
  delete(id: string): Promise<void>;
}

export class DexieSubjectRepository implements ISubjectRepository {
  async getAll(): Promise<Subject[]> {
    return db.subjects.toArray();
  }

  async getById(id: string): Promise<Subject | undefined> {
    return db.subjects.get(id);
  }

  async create(data: CreateSubjectDTO): Promise<Subject> {
    const subject: Subject = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await db.subjects.add(subject);
    return subject;
  }

  async update(id: string, data: UpdateSubjectDTO): Promise<void> {
    await db.subjects.update(id, data);
  }

  async delete(id: string): Promise<void> {
    // Transacción atómica: si se borra una materia, borramos también los slots del horario asociados
    await db.transaction('rw', [db.subjects, db.scheduleSlots, db.notes, db.professors], async () => {
      await db.scheduleSlots.where('subjectId').equals(id).delete();
      await db.notes.where('subjectId').equals(id).delete();
      
      // Actualizar referencias en profesores
      const profs = await db.professors.toArray();
      for (const p of profs) {
        if (p.subjectIds.includes(id)) {
          await db.professors.update(p.id, {
            subjectIds: p.subjectIds.filter((sid) => sid !== id),
          });
        }
      }

      await db.subjects.delete(id);
    });
  }
}

export const subjectRepository = new DexieSubjectRepository();
