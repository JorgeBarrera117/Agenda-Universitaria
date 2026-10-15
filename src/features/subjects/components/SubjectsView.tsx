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
} from 'lucide-react';
import { useSubjects } from '../hooks/useSubjects';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { useNotes } from '../../notes/hooks/useNotes';
import { SubjectForm } from './SubjectForm';
import { Modal } from '../../../shared/components/Modal';
import type { Subject, CreateSubjectDTO } from '../types';

export const SubjectsView: React.FC = () => {
  const { subjects, isLoading, addSubject, updateSubject, removeSubject } = useSubjects();
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
      {/* Resumen del Plan Académico / Semestre (UX) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cove-blue/10 text-cove-blue flex items-center justify-center font-bold">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{subjects.length}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Asignaturas Inscritas
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cove-sand/50 text-slate-800 flex items-center justify-center font-bold">
            <Award className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalCredits}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Créditos Académicos
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cove-sky/15 text-cove-deep flex items-center justify-center font-bold">
            <Clock className="w-6 h-6 text-cove-sky" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalSlotsCount}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Bloques Semanales
            </div>
          </div>
        </div>
      </div>

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Plan de Asignaturas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Catálogo curricular que estructura tus horarios, apuntes y docentes.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md shadow-cove-blue/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Inscribir Asignatura
        </button>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-cove-blue/10 text-cove-blue flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            No tienes asignaturas registradas
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mb-4 max-w-sm mx-auto">
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

            return (
              <div
                key={subject.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden flex flex-col justify-between group hover:border-cove-sky/50"
              >
                {/* Franja superior distintiva de color con borde redondeado */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: subject.color }}
                />

                <div>
                  {/* Encabezado: Código, Nombre y Acciones */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-2xs shrink-0"
                          style={{ backgroundColor: subject.color }}
                        />
                        <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-black bg-cove-navy text-white shadow-2xs tracking-wider">
                          {subject.code || 'ASIGNATURA'}
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-slate-900 group-hover:text-cove-blue transition-colors leading-snug line-clamp-2">
                        {subject.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(subject)}
                        className="p-2 text-slate-400 hover:text-cove-blue hover:bg-cove-blue/10 rounded-xl transition-colors cursor-pointer"
                        title="Editar asignatura"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSubjectToDelete(subject)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Eliminar asignatura"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Ficha de Credenciales Académicas */}
                  <div className="mt-5 space-y-2 text-xs">
                    {subject.classroomDefault ? (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-slate-700">
                        <MapPin className="w-4 h-4 text-cove-sky shrink-0" />
                        <span className="truncate font-semibold">{subject.classroomDefault}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 text-slate-400 italic">
                        <MapPin className="w-4 h-4 text-slate-300 shrink-0" />
                        <span>Aula pendiente de asignar</span>
                      </div>
                    )}

                    {subject.credits !== undefined ? (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-cove-sand/40 border border-cove-gold/60 text-slate-900 font-bold">
                        <Award className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{subject.credits} Créditos Académicos Oficiales</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 text-slate-400 italic">
                        <Award className="w-4 h-4 text-slate-300 shrink-0" />
                        <span>Créditos no especificados</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Métricas y Acceso Rápido al pie de la tarjeta */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <Clock className="w-3.5 h-3.5 text-cove-blue" />
                    {classCount} {classCount === 1 ? 'bloque semanal' : 'bloques semanales'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-cove-blue/10 text-cove-blue border border-cove-sky/30 shadow-2xs">
                    <FileText className="w-3.5 h-3.5" />
                    {noteCount} {noteCount === 1 ? 'apunte' : 'apuntes'}
                  </span>
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
    </div>
  );
};
