import React, { useState, useEffect } from 'react';
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

  // Vista de Edición / Creación Dedicada a Pantalla Completa (Aprovechando todo el espacio en PC)
  if (isModalOpen) {
    return (
      <div className="w-full pb-12">
        <SubjectForm
          initialData={editingSubject}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. ENCABEZADO DEL APARTADO (JERARQUÍA NIVEL 1 EN EL BODY) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Plan de Asignaturas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF]">
              {subjects.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
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
            size="md"
            icon={<BookPlus className="w-4 h-4 lg:w-5 lg:h-5 stroke-[2.4]" />}
            onClick={handleOpenCreate}
            className="lg:min-h-[48px] lg:px-6 lg:py-3 lg:text-sm shadow-md hover:shadow-lg ring-2 ring-[#006E1C]/25 dark:ring-[#78DC77]/35 hover:scale-[1.02] whitespace-nowrap"
          >
            Inscribir Asignatura
          </Button>
        </div>
      </div>

      {/* 2. RESUMEN MÉTRICO DEL SEMESTRE (JERARQUÍA NIVEL 2) */}
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
            size="lg"
            icon={<Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />}
            onClick={handleOpenCreate}
            className="shadow-md"
          >
            Inscribir primera asignatura
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {subjects.map((subject) => {
            const classCount = slots.filter((s) => s.subjectId === subject.id).length;
            const noteCount = notes.filter((n) => n.subjectId === subject.id).length;
            const docCount = getDocumentCountForSubject(subject.id);
            const prof = professors.find((p) => p.id === subject.professorId || p.subjectIds.includes(subject.id));

            return (
              <Card
                key={subject.id}
                padding="normal"
                accentColor={subject.color}
                interactive
                className="flex flex-col justify-between gap-3 group"
              >
                {/* 1. Cabecera Superior: Ícono + Código + Título (100% ancho) + Botones de Acción */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {/* Badge / Avatar con el Ícono y Color de la Asignatura */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md ring-2 ring-white/30 shrink-0"
                      style={{ backgroundColor: subject.color }}
                      title={subject.name}
                    >
                      <SubjectIcon icon={subject.icon} className="w-5 h-5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Código de Asignatura (Modo Claro: Fondo Negro / Texto Blanco | Modo Oscuro: Fondo Blanco / Texto Negro) */}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-mono font-black bg-black text-white dark:bg-white dark:text-black tracking-wider shadow-2xs">
                        {subject.code || 'ASIGNATURA'}
                      </span>

                      <h3 className="text-base sm:text-lg font-bold text-[#191C20] dark:text-[#E2E2E6] group-hover:text-[#00639B] dark:group-hover:text-[#96CCFF] transition-colors leading-snug line-clamp-2 mt-0.5">
                        {subject.name}
                      </h3>
                    </div>
                  </div>

                  {/* Botones de Acción Superiores alineados a la derecha */}
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
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

                {/* 2. Chips Académicos Dinámicos (Sin cajas vacías punteadas innecesarias) */}
                <div className="space-y-1.5">
                  {/* Catedrático / Profesor Asignado */}
                  {prof && (
                    <div className="flex items-center gap-2 p-1.5 px-2.5 rounded-xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/30 dark:border-white/5 text-[#191C20] dark:text-[#E2E2E6] shadow-2xs">
                      <ProfessorAvatar
                        name={prof.name}
                        icon={prof.icon}
                        color={prof.color}
                        size="xs"
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold truncate text-[#191C20] dark:text-[#E2E2E6] text-[11px] leading-tight">
                          {prof.name}
                        </div>
                        <div className="text-[10px] text-[#41474D] dark:text-[#C2C7CF] truncate">
                          {prof.office || prof.email || 'Docente titular'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fila de Chips: Aula y Créditos (Solo si existen) */}
                  {(subject.classroomDefault || (subject.credits !== undefined && subject.credits > 0)) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {subject.classroomDefault && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E2E7EF]/70 dark:bg-[#272A2F] border border-[#C2C7CE]/40 dark:border-white/10 text-[#41474D] dark:text-[#C2C7CF] text-[11px] font-medium">
                          <MapPin className="w-3.5 h-3.5 text-[#00639B] dark:text-[#96CCFF] shrink-0" />
                          <span className="truncate">{subject.classroomDefault}</span>
                        </span>
                      )}
                      {subject.credits !== undefined && subject.credits > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFDCC1] dark:bg-[#683D00] text-[#2E1500] dark:text-[#FFDCC1] text-[11px] font-bold">
                          <Award className="w-3.5 h-3.5 text-[#8F4E00] dark:text-[#FFB77C] shrink-0" />
                          <span>{subject.credits} {subject.credits === 1 ? 'crédito' : 'créditos'}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Pie de Tarjeta: Métricas a la izquierda y Botón de Apuntes/Docs a la derecha */}
                <div className="pt-2 border-t border-[#C2C7CE]/30 dark:border-white/5 flex flex-wrap items-center justify-between text-xs font-semibold gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[#41474D] dark:text-[#C2C7CF] font-medium text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-[#00639B] dark:text-[#96CCFF]" />
                      {classCount}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF]">
                      <FileText className="w-3 h-3" />
                      {noteCount} {noteCount === 1 ? 'apunte' : 'apuntes'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedSubjectForDocs(subject)}
                      className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs sm:text-[13px] font-extrabold text-[#00639B] dark:text-[#92CCFF] bg-[#D0E4FF]/70 dark:bg-[#004B76]/60 hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                      title="Abrir o vincular documentos de esta asignatura"
                    >
                      <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
                      <span>{docCount > 0 ? `Archivos (${docCount})` : 'Archivos'}</span>
                    </button>

                    {onNavigateToNotes && (
                      <Button
                        variant="action-indigo"
                        size="xs"
                        onClick={() => onNavigateToNotes(subject.id)}
                        title="Ver o tomar apuntes de esta asignatura"
                        aria-label="Ver apuntes"
                        icon={<BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />}
                        className="font-extrabold whitespace-nowrap"
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
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Estás a punto de dar de baja <strong className="text-slate-900 dark:text-white">{subjectToDelete?.name}</strong>. Esta acción eliminará permanentemente sus horarios y apuntes asociados en la base de datos local.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setSubjectToDelete(null)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Confirmar baja
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Prototipo de Documentos y Recursos de la Asignatura */}
      <SubjectDocumentsModal
        subject={selectedSubjectForDocs}
        isOpen={selectedSubjectForDocs !== null}
        onClose={() => setSelectedSubjectForDocs(null)}
      />

      {/* Botón Flotante Reubicable (FAB con Snap a Bordes y seguimiento en scroll) */}
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
