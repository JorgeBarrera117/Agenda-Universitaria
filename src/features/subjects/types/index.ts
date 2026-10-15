export interface Subject {
  id: string;
  name: string;
  code?: string;
  color: string;
  credits?: number;
  classroomDefault?: string;
  createdAt: string;
}

export type CreateSubjectDTO = Omit<Subject, 'id' | 'createdAt'>;
export type UpdateSubjectDTO = Partial<CreateSubjectDTO>;
