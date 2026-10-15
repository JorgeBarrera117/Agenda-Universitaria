export interface Professor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  office?: string;
  notes?: string;
  subjectIds: string[];
  createdAt: string;
}

export type CreateProfessorDTO = Omit<Professor, 'id' | 'createdAt'>;
export type UpdateProfessorDTO = Partial<CreateProfessorDTO>;
