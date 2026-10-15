import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  MapPin,
  Award,
  Clock,
  FileText,
  User,
} from 'lucide-react';
import { useSubjects } from '../hooks/useSubjects';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { useNotes } from '../../notes/hooks/useNotes';
import { SubjectForm } from './SubjectForm';
import { SubjectIcon } from './SubjectIcon';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import { Modal } from '../../../shared/components/Modal';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { Button, Card, Badge } from '../../../shared/components/atoms';
import type { Subject, CreateSubjectDTO } from '../types';

interface SubjectsViewProps {
  onNavigateToNotes?: (subjectId?: string) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({ onNavigateToNotes }) => {
  const { subjects, isLoading, addSubject, updateSubject, removeSubject } = useSubjects();
  const { professors } = useProfessors();
  const { slots } = useSchedule();
  const { notes } = useNotes();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | undefined>(undefined);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  // Estadísticas del semestre (UX Académico)
  const totalCredits = subjects.reduce((sum, s) => sum + (s.credits || 0), 0);
  const totalSlotsCount = slots.length;

  const handleOpenCreate = () => {
    setEditingSubject(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setIsModalOpen(true);
  };

  const handleSubmit = async (dto: CreateSubjectDTO) => {
    if (editingSubject) {
      await updateSubject(editingSubject.id, dto);
    } else {
      await addSubject(dto);
    }
    setIsModalOpen(false);
  };

  const confirmDelete = async () => {
    if (subjectToDelete) {
      await removeSubject(subjectToDelete.id);
      setSubjectToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-cove-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Resumen Métrico del Semestre (Distribuido Horizontalmente) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
        {/* Métrica 1: Asignaturas */}
        <Card padding="compact" className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {subjects.length}
            </div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              <span className="sm:hidden">Materias</span>
              <span className="hidden sm:inline">Asignaturas Inscritas</span>
            </div>
          </div>
        </Card>

        {/* Métrica 2: Créditos */}
        <Card padding="compact" className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {totalCredits}
            </div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              <span className="sm:hidden">Créditos</span>
              <span className="hidden sm:inline">Créditos Académicos</span>
            </div>
          </div>
        </Card>

        {/* Métrica 3: Bloques */}
        <Card padding="compact" className="flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              {totalSlotsCount}
            </div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              <span className="sm:hidden">Bloques</span>
              <span className="hidden sm:inline">Bloques Semanales</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Plan de Asignaturas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Catálogo curricular que estructura tus horarios, apuntes y docentes.
          </p>
        </div>
        <Button
          variant="success"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreate}
          className="hidden sm:inline-flex"
        >
          Inscribir Asignatura
        </Button>
      </div>

      {subjects.length === 0 ? (
        <Card padding="relaxed" className="text-center py-14 border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-cove-blue/10 dark:bg-cove-blue/20 text-cove-blue dark:text-cove-sky flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            No tienes asignaturas registradas
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
            Registra tus materias del ciclo universitario para poder armar tu horario y clasificar tus apuntes.
          </p>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            Inscribir primera asignatura
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {subjects.map((subject) => {
            const classCount = slots.filter((s) => s.subjectId === subject.id).length;
            const noteCount = notes.filter((n) => n.subjectId === subject.id).length;
            const prof = professors.find((p) => p.id === subject.professorId || p.subjectIds.includes(subject.id));

            return (
              <Card
                key={subject.id}
                padding="normal"
                accentColor={subject.color}
                interactive
                className="flex flex-row items-stretch justify-between gap-3 group"
              >
                {/* Contenido Principal (Izquierda) */}
                <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                  <div className="flex items-start gap-2.5">
                    {/* Badge / Avatar con el Ícono y Color de la Asignatura */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md ring-2 ring-white/30 shrink-0"
                      style={{ backgroundColor: subject.color }}
                      title={subject.name}
                    >
                      <SubjectIcon icon={subject.icon} className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      {/* Código de Asignatura */}
                      <Badge variant="navy" size="xs">
                        {subject.code || 'ASIGNATURA'}
                      </Badge>

                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-cove-blue dark:group-hover:text-cove-sky transition-colors leading-snug line-clamp-2">
                        {subject.name}
                      </h3>
                    </div>
                  </div>

                  {/* Ficha de Credenciales Académicas */}
                  <div className="space-y-1.5 text-xs">
                    {/* Catedrático / Profesor Asignado */}
                    {prof ? (
                      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 shadow-2xs">
                        <ProfessorAvatar
                          name={prof.name}
                          icon={prof.icon}
                          color={prof.color}
                          size="xs"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold truncate text-slate-900 dark:text-white text-[11px] leading-tight">
                            {prof.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {prof.office || prof.email || 'Docente titular'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 italic text-[11px]">
                        <User className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                        <span>Sin docente asignado</span>
                      </div>
                    )}

                    {subject.classroomDefault ? (
                      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-cove-sky shrink-0" />
                        <span className="truncate font-semibold">{subject.classroomDefault}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 italic text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                        <span>Aula por asignar</span>
                      </div>
                    )}

                    {subject.credits !== undefined ? (
                      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-cove-sand/40 dark:bg-amber-950/40 border border-cove-gold/60 dark:border-amber-800/60 text-slate-900 dark:text-amber-200 font-bold text-[11px]">
                        <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{subject.credits} Créditos Académicos</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 italic text-[11px]">
                        <Award className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                        <span>Créditos sin especificar</span>
                      </div>
                    )}
                  </div>

                  {/* Métricas al pie */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold gap-2">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-bold text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-cove-blue dark:text-cove-sky" />
                      {classCount} {classCount === 1 ? 'bloque' : 'bloques'}
                    </span>
                    <Badge variant="primary" size="xs" icon={<FileText className="w-3 h-3" />}>
                      {noteCount} {noteCount === 1 ? 'apunte' : 'apuntes'}
                    </Badge>
                  </div>
                </div>

                {/* Columna Vertical de Acciones (Derecha) - Estandarizada con Átomo Button */}
                <div className="flex flex-col justify-center items-center shrink-0 pl-1.5 sm:pl-2 py-0.5 gap-2 sm:gap-2.5">
                  {/* Botón 1: Ver apuntes */}
                  <Button
                    variant="action-indigo"
                    size="icon-md"
                    onClick={() => onNavigateToNotes && onNavigateToNotes(subject.id)}
                    title="Ver o tomar apuntes de esta asignatura"
                    aria-label="Ver apuntes"
                    icon={<BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                  />

                  {/* Botón 2: Editar asignatura */}
                  <Button
                    variant="action-blue"
                    size="icon-md"
                    onClick={() => handleOpenEdit(subject)}
                    title="Editar asignatura"
                    aria-label="Editar asignatura"
                    icon={<Edit2 className="w-4 h-4 text-white" />}
                  />

                  {/* Botón 3: Eliminar asignatura */}
                  <Button
                    variant="action-rose"
                    size="icon-md"
                    onClick={() => setSubjectToDelete(subject)}
                    title="Eliminar asignatura"
                    aria-label="Eliminar asignatura"
                    icon={<Trash2 className="w-4 h-4 text-white" />}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSubject ? 'Editar Asignatura' : 'Inscribir Nueva Asignatura'}
      >
        <SubjectForm
          initialData={editingSubject}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={subjectToDelete !== null}
        onClose={() => setSubjectToDelete(null)}
        title="¿Dar de Baja Asignatura?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Estás a punto de dar de baja <strong>{subjectToDelete?.name}</strong>. Esta acción eliminará permanentemente sus horarios y apuntes asociados en la base de datos local.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setSubjectToDelete(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Confirmar baja
            </button>
          </div>
        </div>
      </Modal>

      {/* Botón Flotante Móvil Reubicable (FAB con Snap a Bordes) */}
      <DraggableFAB
        colorScheme="subjects"
        onClick={handleOpenCreate}
        label="Inscribir Asignatura"
      />
    </div>
  );
};
