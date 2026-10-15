export interface Subject {
  id: string;
  name: string;
  code?: string;
  color: string;
  icon?: string;
  credits?: number;
  classroomDefault?: string;
  professorId?: string;
  createdAt: string;
}

export type CreateSubjectDTO = Omit<Subject, 'id' | 'createdAt'>;
export type UpdateSubjectDTO = Partial<CreateSubjectDTO>;
