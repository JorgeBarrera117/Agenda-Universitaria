import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../shared/db/AppDatabase';
import { professorRepository } from '../repositories/professorRepository';
import type { CreateProfessorDTO, UpdateProfessorDTO } from '../types';

export function useProfessors() {
  const professors = useLiveQuery(
    () => db.professors.toArray(),
    []
  );

  const addProfessor = async (dto: CreateProfessorDTO) => {
    return professorRepository.create(dto);
  };

  const updateProfessor = async (id: string, dto: UpdateProfessorDTO) => {
    return professorRepository.update(id, dto);
  };

  const removeProfessor = async (id: string) => {
    return professorRepository.delete(id);
  };

  const getProfessorById = (id?: string) => {
    if (!id || !professors) return undefined;
    return professors.find((p) => p.id === id);
  };

  return {
    professors: professors ?? [],
    isLoading: professors === undefined,
    addProfessor,
    updateProfessor,
    removeProfessor,
    getProfessorById,
  };
}
