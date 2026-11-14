import { db } from '../../../shared/db/AppDatabase';
import type { Subject, CreateSubjectDTO, UpdateSubjectDTO } from '../types';

export interface ISubjectRepository {
  getAll(): Promise<Subject[]>;
  getById(id: string): Promise<Subject | undefined>;
  create(data: CreateSubjectDTO): Promise<Subject>;
  update(id: string, data: UpdateSubjectDTO): Promise<void>;
  delete(id: string): Promise<void>;
  /** Archiva las materias en curso con el semestre en que se cursaron. Devuelve cuántas archivó. */
  archiveActive(semester: string): Promise<number>;
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

    await db.transaction('rw', [db.subjects, db.professors], async () => {
      await db.subjects.add(subject);

      // Sincronización bidireccional: si se asignó un docente, vincular esta materia a su lista
      if (subject.professorId) {
        const prof = await db.professors.get(subject.professorId);
        if (prof && !(prof.subjectIds || []).includes(subject.id)) {
          await db.professors.update(prof.id, {
            subjectIds: [...(prof.subjectIds || []), subject.id],
          });
        }
      }
    });

    return subject;
  }

  async update(id: string, data: UpdateSubjectDTO): Promise<void> {
    await db.transaction('rw', [db.subjects, db.professors], async () => {
      const existing = await db.subjects.get(id);
      if (!existing) return;

      const oldProfessorId = existing.professorId;
      const newProfessorId = data.professorId;

      await db.subjects.update(id, data);

      // Si cambió el profesor asignado, sincronizar ambas entidades
      if (data.professorId !== undefined && oldProfessorId !== newProfessorId) {
        // Desvincular del docente previo
        if (oldProfessorId) {
          const oldProf = await db.professors.get(oldProfessorId);
          if (oldProf && (oldProf.subjectIds || []).includes(id)) {
            await db.professors.update(oldProf.id, {
              subjectIds: (oldProf.subjectIds || []).filter((sid) => sid !== id),
            });
          }
        }
        // Vincular al nuevo docente
        if (newProfessorId) {
          const newProf = await db.professors.get(newProfessorId);
          if (newProf && !(newProf.subjectIds || []).includes(id)) {
            await db.professors.update(newProf.id, {
              subjectIds: [...(newProf.subjectIds || []), id],
            });
          }
        }
      }
    });
  }

  async delete(id: string): Promise<void> {
    // Transacción atómica: si se borra una materia, borramos también los slots del horario asociados
    await db.transaction('rw', [db.subjects, db.scheduleSlots, db.notes, db.noteImages, db.noteAudios, db.professors], async () => {
      await db.scheduleSlots.where('subjectId').equals(id).delete();
      // Fotos y notas de voz de sus apuntes también (antes quedaban huérfanas en la base de datos)
      const noteIds = (await db.notes.where('subjectId').equals(id).primaryKeys()) as string[];
      if (noteIds.length > 0) {
        await db.noteImages.where('noteId').anyOf(noteIds).delete();
        await db.noteAudios.where('noteId').anyOf(noteIds).delete();
      }
      await db.notes.where('subjectId').equals(id).delete();
      
      // Actualizar referencias en profesores
      const profs = await db.professors.toArray();
      for (const p of profs) {
        if ((p.subjectIds || []).includes(id)) {
          await db.professors.update(p.id, {
            subjectIds: (p.subjectIds || []).filter((sid) => sid !== id),
          });
        }
      }

      await db.subjects.delete(id);
    });
  }

  async archiveActive(semester: string): Promise<number> {
    // Solo cambia la marca y el semestre: sus apuntes (note.subjectId), archivos y docente
    // siguen apuntando a la misma materia
    return db.subjects.filter((subject) => !subject.isArchived).modify({ isArchived: true, semester });
  }
}

export const subjectRepository = new DexieSubjectRepository();
