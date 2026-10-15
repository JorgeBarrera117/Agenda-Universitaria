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
    <div className="space-y-6">
      {/* Resumen Métrico del Semestre (Distribuido Horizontalmente) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Métrica 1: Asignaturas */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-4 transition-all hover:shadow-xs">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 sm:w-6 sm:h-6" />
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
        </div>

        {/* Métrica 2: Créditos */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-4 transition-all hover:shadow-xs">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4 sm:w-6 sm:h-6" />
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
        </div>

        {/* Métrica 3: Bloques */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-4 transition-all hover:shadow-xs">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-6 sm:h-6" />
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
        </div>
      </div>

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Plan de Asignaturas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Catálogo curricular que estructura tus horarios, apuntes y docentes.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Inscribir Asignatura
        </button>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-cove-blue/10 dark:bg-cove-blue/20 text-cove-blue dark:text-cove-sky flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            No tienes asignaturas registradas
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
            Registra tus materias del ciclo universitario para poder armar tu horario y clasificar tus apuntes.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-cove-blue/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Inscribir primera asignatura
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {subjects.map((subject) => {
            const classCount = slots.filter((s) => s.subjectId === subject.id).length;
            const noteCount = notes.filter((n) => n.subjectId === subject.id).length;
            const prof = professors.find((p) => p.id === subject.professorId || p.subjectIds.includes(subject.id));

            return (
              <div
                key={subject.id}
                style={{
                  background: `linear-gradient(145deg, ${subject.color}1f 0%, ${subject.color}0c 100%), var(--card-bg, #ffffff)`,
                  borderColor: `${subject.color}45`,
                }}
                className="rounded-3xl p-5 sm:p-6 border shadow-2xs hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden flex flex-row items-stretch justify-between gap-3 sm:gap-4 group"
              >
                {/* Contenido Principal (Izquierda) */}
                <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3.5">
                  <div className="flex items-start gap-3">
                    {/* Badge / Avatar con el Ícono y Color de la Asignatura */}
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ring-2 ring-white/30 shrink-0"
                      style={{ backgroundColor: subject.color }}
                      title={subject.name}
                    >
                      <SubjectIcon icon={subject.icon} className="w-6 h-6 text-white" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Código de Asignatura */}
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-black bg-cove-navy text-white shadow-2xs tracking-wider">
                          {subject.code || 'ASIGNATURA'}
                        </span>
                      </div>

                      <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white group-hover:text-cove-blue dark:group-hover:text-cove-sky transition-colors leading-snug line-clamp-2">
                        {subject.name}
                      </h3>
                    </div>
                  </div>

                  {/* Ficha de Credenciales Académicas */}
                  <div className="space-y-2 text-xs">
                    {/* Catedrático / Profesor Asignado */}
                    {prof ? (
                      <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 shadow-2xs">
                        <ProfessorAvatar
                          name={prof.name}
                          icon={prof.icon}
                          color={prof.color}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold truncate text-slate-900 dark:text-white text-xs">
                            {prof.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {prof.office || prof.email || 'Docente titular'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 italic">
                        <User className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                        <span>Sin docente asignado</span>
                      </div>
                    )}

                    {subject.classroomDefault ? (
                      <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300">
                        <MapPin className="w-4 h-4 text-cove-sky shrink-0" />
                        <span className="truncate font-semibold">{subject.classroomDefault}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 italic">
                        <MapPin className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                        <span>Aula por asignar</span>
                      </div>
                    )}

                    {subject.credits !== undefined ? (
                      <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-cove-sand/40 dark:bg-amber-950/40 border border-cove-gold/60 dark:border-amber-800/60 text-slate-900 dark:text-amber-200 font-bold">
                        <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{subject.credits} Créditos Académicos</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 italic">
                        <Award className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                        <span>Créditos sin especificar</span>
                      </div>
                    )}
                  </div>

                  {/* Métricas al pie */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold gap-2">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-bold">
                      <Clock className="w-3.5 h-3.5 text-cove-blue dark:text-cove-sky" />
                      {classCount} {classCount === 1 ? 'bloque' : 'bloques'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-cove-blue/10 dark:bg-cove-blue/25 text-cove-blue dark:text-cove-sky border border-cove-sky/30 dark:border-cove-sky/40">
                      <FileText className="w-3 h-3" />
                      {noteCount} {noteCount === 1 ? 'apunte' : 'apuntes'}
                    </span>
                  </div>
                </div>


                {/* Columna Vertical de Acciones (Derecha) - Alineada y Proporcional */}
                <div className="flex flex-col justify-center items-center shrink-0 pl-2 sm:pl-3 py-0.5 gap-2.5 sm:gap-3">
                  {/* Botón 1: Ver apuntes de la materia (Superior - Índigo para apuntes) */}
                  <button
                    onClick={() => onNavigateToNotes && onNavigateToNotes(subject.id)}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-700 to-slate-900 hover:from-indigo-400 hover:via-violet-600 hover:to-slate-900 ring-1 ring-violet-300/40 text-white flex items-center justify-center transition-all active:scale-95 shadow-sm hover:shadow-md shadow-indigo-950/20 cursor-pointer"
                    title="Ver o tomar apuntes de esta asignatura"
                    aria-label="Ver apuntes"
                  >
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </button>

                  {/* Botón 2: Editar asignatura (Centro - Azul para editar) */}
                  <button
                    onClick={() => handleOpenEdit(subject)}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-cove-navy hover:from-blue-500 hover:via-blue-600 hover:to-cove-navy ring-1 ring-sky-300/40 text-white flex items-center justify-center transition-all active:scale-95 shadow-sm hover:shadow-md shadow-blue-950/20 cursor-pointer"
                    title="Editar asignatura"
                    aria-label="Editar asignatura"
                  >
                    <Edit2 className="w-4 h-4 text-white" />
                  </button>

                  {/* Botón 3: Eliminar asignatura (Inferior - Rojo para eliminar) */}
                  <button
                    onClick={() => setSubjectToDelete(subject)}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-red-500 via-rose-600 to-slate-900 hover:from-red-400 hover:via-rose-500 hover:to-slate-900 ring-1 ring-rose-300/40 text-white flex items-center justify-center transition-all active:scale-95 shadow-sm hover:shadow-md shadow-red-950/20 cursor-pointer"
                    title="Eliminar asignatura"
                    aria-label="Eliminar asignatura"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
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
