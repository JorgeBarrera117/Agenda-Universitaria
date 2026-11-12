export interface Subject {
  id: string;
  name: string;
  code?: string;
  color: string;
  icon?: string;
  credits?: number;
  classroomDefault?: string;
  professorId?: string;
  /**
   * Materia de un semestre ya concluido (Ajustes → Finalizar semestre). Se conserva con todos
   * sus apuntes y archivos para consulta; ausente o false = materia en curso.
   */
  isArchived?: boolean;
  /** Semestre en que se cursó (p. ej. "Semestre 2026-I"); se guarda al archivarla. */
  semester?: string;
  createdAt: string;
}

export type CreateSubjectDTO = Omit<Subject, 'id' | 'createdAt'>;
export type UpdateSubjectDTO = Partial<CreateSubjectDTO>;
