import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../shared/db/AppDatabase';
import { subjectRepository } from '../repositories/subjectRepository';
import type { CreateSubjectDTO, UpdateSubjectDTO } from '../types';

export function useSubjects() {
  const subjects = useLiveQuery(
    () => db.subjects.toArray(),
    []
  );

  const addSubject = async (dto: CreateSubjectDTO) => {
    return subjectRepository.create(dto);
  };

  const updateSubject = async (id: string, dto: UpdateSubjectDTO) => {
    return subjectRepository.update(id, dto);
  };

  const removeSubject = async (id: string) => {
    return subjectRepository.delete(id);
  };

  const getSubjectById = (id?: string) => {
    if (!id || !subjects) return undefined;
    return subjects.find((s) => s.id === id);
  };

  return {
    subjects: subjects ?? [],
    isLoading: subjects === undefined,
    addSubject,
    updateSubject,
    removeSubject,
    getSubjectById,
  };
}
