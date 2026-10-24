import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  BookPlus,
  MapPin,
  Award,
  Clock,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { useSubjects } from '../hooks/useSubjects';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { useNotes } from '../../notes/hooks/useNotes';
import { SubjectForm } from './SubjectForm';
import { SubjectIcon } from './SubjectIcon';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { SubjectDocumentsModal } from './SubjectDocumentsModal';
import { useSubjectDocuments } from '../hooks/useSubjectDocuments';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import { Modal } from '../../../shared/components/Modal';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { useScrollCollapse } from '../../../shared/hooks/useScrollCollapse';
import { Button, Card } from '../../../shared/components/atoms';
import type { Subject, CreateSubjectDTO } from '../types';

interface SubjectsViewProps {
  onNavigateToNotes?: (subjectId?: string) => void;
  onEditorActiveChange?: (isActive: boolean) => void;
  isActive?: boolean;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  onNavigateToNotes,
  onEditorActiveChange,
  isActive = true,
}) => {
  const { subjects, addSubject, updateSubject, removeSubject } = useSubjects();
  const { professors } = useProfessors();
  const { slots } = useSchedule();
  const { notes } = useNotes();
  const isScrolled = useScrollCollapse(48);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | undefined>(undefined);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [selectedSubjectForDocs, setSelectedSubjectForDocs] = useState<Subject | null>(null);
  const { getDocumentCountForSubject } = useSubjectDocuments();

  useEffect(() => {
    onEditorActiveChange?.(isModalOpen);
    return () => {
      onEditorActiveChange?.(false);
    };
  }, [isModalOpen, onEditorActiveChange]);

  // Estadísticas del semestre memoizadas para rendimiento
  const totalCredits = useMemo(
    () => subjects.reduce((sum, s) => sum + (s.credits || 0), 0),
    [subjects]
  );
  const totalSlotsCount = slots.length;

  const handleOpenCreate = useCallback(() => {
    setEditingSubject(undefined);
    setIsModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((subject: Subject) => {
    setEditingSubject(subject);
    setIsModalOpen(true);
  }, []);

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

  // Vista de Edición / Creación Dedicada a Pantalla Completa
  if (isModalOpen) {
    return (
      <div className="w-full pb-8">
        <ErrorBoundary
          fallbackTitle="Error al abrir el formulario de asignatura"
          onReset={() => setIsModalOpen(false)}
        >
          <SubjectForm
            key={editingSubject?.id || 'new-subject'}
            initialData={editingSubject}
            onSubmit={handleSubmit}
            onCancel={() => setIsModalOpen(false)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {/* 1. ENCABEZADO DEL APARTADO (Compacto) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Plan de Asignaturas
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF]">
              {subjects.length}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Catálogo curricular que estructura tus horarios, apuntes y docentes.
          </p>
        </div>
        <div
          className={`hidden sm:block shrink-0 origin-right transition-all duration-200 ${
            isScrolled ? 'scale-75 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
          }`}
        >
          <Button
            variant="success"
            size="sm"
            icon={<BookPlus className="w-4 h-4 stroke-[2.4]" />}
            onClick={handleOpenCreate}
            className="h-9 px-4 text-xs font-bold shadow-xs ring-2 ring-[#006E1C]/20 dark:ring-[#78DC77]/30 hover:scale-[1.02] whitespace-nowrap"
          >
            Inscribir Asignatura
          </Button>
        </div>
      </div>

      {/* 2. RESUMEN MÉTRICO COMPACTO (Jerarquía Nivel 2) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {/* Métrica 1: Asignaturas */}
        <div className="p-2 sm:p-2.5 rounded-2xl bg-[var(--color-md-card-bg)] border border-[var(--color-md-outline-variant)] shadow-2xs flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              {subjects.length}
            </div>
            <div className="text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              Materias
            </div>
          </div>
        </div>

        {/* Métrica 2: Créditos */}
        <div className="p-2 sm:p-2.5 rounded-2xl bg-[var(--color-md-card-bg)] border border-[var(--color-md-outline-variant)] shadow-2xs flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              {totalCredits}
            </div>
            <div className="text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              Créditos
            </div>
          </div>
        </div>

        {/* Métrica 3: Bloques */}
        <div className="p-2 sm:p-2.5 rounded-2xl bg-[var(--color-md-card-bg)] border border-[var(--color-md-outline-variant)] shadow-2xs flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
              {totalSlotsCount}
            </div>
            <div className="text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
              Bloques
            </div>
          </div>
        </div>
      </div>

      {/* 3. CATÁLOGO DE ASIGNATURAS */}
      {subjects.length === 0 ? (
        <Card padding="relaxed" className="text-center py-12 border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-cove-blue/10 dark:bg-cove-blue/20 text-cove-blue dark:text-cove-sky flex items-center justify-center mx-auto mb-2.5">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            No tienes asignaturas registradas
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-sm mx-auto">
            Registra tus materias del ciclo universitario para estructurar horarios y apuntes.
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={handleOpenCreate}
            className="shadow-xs"
          >
            Inscribir primera asignatura
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
          {subjects.map((subject) => {
            const classCount = slots.filter((s) => s.subjectId === subject.id).length;
            const noteCount = notes.filter((n) => n.subjectId === subject.id).length;
            const docCount = getDocumentCountForSubject(subject.id);
            const prof = professors.find(
              (p) => p.id === subject.professorId || (p.subjectIds || []).includes(subject.id)
            );

            return (
              <Card
                key={subject.id}
                padding="compact"
                accentColor={subject.color}
                interactive
                className="flex flex-col justify-between gap-2.5 group"
              >
                {/* 1. Cabecera: Ícono + Código + Nombre + Botones de Acción */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0 ring-1 ring-white/20"
                      style={{ backgroundColor: subject.color }}
                      title={subject.name}
                    >
                      <SubjectIcon icon={subject.icon} className="w-4 h-4 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9.5px] font-mono font-black bg-black text-white dark:bg-white dark:text-black tracking-wider">
                        {subject.code || 'ASIGNATURA'}
                      </span>

                      <h3 className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] group-hover:text-[#00639B] dark:group-hover:text-[#96CCFF] transition-colors leading-snug line-clamp-2 mt-0.5">
                        {subject.name}
                      </h3>
                    </div>
                  </div>

                  {/* Micro-acciones discretas */}
                  <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                    <Button
                      variant="action-indigo"
                      size="icon-xs"
                      onClick={() => setSelectedSubjectForDocs(subject)}
                      title="Archivos y documentos vinculados"
                      aria-label="Ver documentos"
                      icon={<FolderOpen className="w-3.5 h-3.5" />}
                    />
                    <Button
                      variant="action-blue"
                      size="icon-xs"
                      onClick={() => handleOpenEdit(subject)}
                      title="Editar asignatura"
                      aria-label="Editar asignatura"
                      icon={<Edit2 className="w-3.5 h-3.5" />}
                    />
                    <Button
                      variant="action-rose"
                      size="icon-xs"
                      onClick={() => setSubjectToDelete(subject)}
                      title="Eliminar asignatura"
                      aria-label="Eliminar asignatura"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    />
                  </div>
                </div>

                {/* 2. Chips Académicos Condicionales */}
                <div className="space-y-1">
                  {/* Docente Asignado */}
                  {prof && (
                    <div className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] text-[10.5px]">
                      <ProfessorAvatar
                        name={prof.name}
                        icon={prof.icon}
                        color={prof.color}
                        size="xs"
                        className="shrink-0"
                      />
                      <span className="font-semibold truncate">
                        {prof.name}
                      </span>
                    </div>
                  )}

                  {/* Fila Chips: Aula + Créditos */}
                  {(subject.classroomDefault || (subject.credits !== undefined && subject.credits > 0)) && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      {subject.classroomDefault && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E2E7EF]/60 dark:bg-[#272A2F] text-[#41474D] dark:text-[#C2C7CF] font-medium truncate max-w-[150px]">
                          <MapPin className="w-3 h-3 text-[#00639B] dark:text-[#96CCFF] shrink-0" />
                          <span className="truncate">{subject.classroomDefault}</span>
                        </span>
                      )}
                      {subject.credits !== undefined && subject.credits > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFDCC1] dark:bg-[#683D00] text-[#2E1500] dark:text-[#FFDCC1] font-bold">
                          <Award className="w-3 h-3 text-[#8F4E00] dark:text-[#FFB77C] shrink-0" />
                          <span>{subject.credits} cr.</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Pie de Tarjeta: Métricas y Acciones Thumb Zone */}
                <div className="pt-1.5 border-t border-[#C2C7CE]/30 dark:border-white/5 flex items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-[10.5px]">
                    <span className="flex items-center gap-0.5 text-slate-500 font-medium">
                      <Clock className="w-3 h-3 text-[#00639B] dark:text-[#96CCFF]" />
                      {classCount}
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] font-bold text-[10px]">
                      <FileText className="w-2.5 h-2.5" />
                      {noteCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedSubjectForDocs(subject)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold text-[#00639B] dark:text-[#92CCFF] bg-[#D0E4FF]/60 dark:bg-[#004B76]/50 hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                      title="Archivos de esta asignatura"
                    >
                      <FolderOpen className="w-3 h-3 stroke-[2.2]" />
                      <span>{docCount > 0 ? `${docCount}` : 'Docs'}</span>
                    </button>

                    {onNavigateToNotes && (
                      <Button
                        variant="action-indigo"
                        size="xs"
                        onClick={() => onNavigateToNotes(subject.id)}
                        title="Ver apuntes"
                        aria-label="Ver apuntes"
                        icon={<BookOpen className="w-3 h-3 stroke-[2.2]" />}
                        className="text-[11px] py-1 px-2.5 h-7 font-bold whitespace-nowrap"
                      >
                        Apuntes
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={subjectToDelete !== null}
        onClose={() => setSubjectToDelete(null)}
        title="¿Dar de Baja Asignatura?"
        maxWidth="sm"
      >
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            Estás a punto de dar de baja <strong className="text-slate-900 dark:text-white">{subjectToDelete?.name}</strong>. Esta acción eliminará permanentemente sus horarios y apuntes asociados en la base de datos local.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setSubjectToDelete(null)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              Confirmar baja
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Documentos y Recursos de la Asignatura */}
      <SubjectDocumentsModal
        subject={selectedSubjectForDocs}
        isOpen={selectedSubjectForDocs !== null}
        onClose={() => setSelectedSubjectForDocs(null)}
      />

      {/* Botón Flotante Reubicable (FAB) */}
      {isActive && (
        <DraggableFAB
          colorScheme="subjects"
          onClick={handleOpenCreate}
          label="Inscribir Asignatura"
          icon={<BookPlus className="w-6 h-6 stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
