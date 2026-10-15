import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Users,
  BookOpen,
  CalendarCheck,
} from 'lucide-react';
import { useProfessors } from '../hooks/useProfessors';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { ProfessorForm } from './ProfessorForm';
import { Modal } from '../../../shared/components/Modal';
import type { Professor, CreateProfessorDTO } from '../types';

export const ProfessorsView: React.FC = () => {
  const { professors, isLoading, addProfessor, updateProfessor, removeProfessor } = useProfessors();
  const { getSubjectById } = useSubjects();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | undefined>(undefined);
  const [profToDelete, setProfToDelete] = useState<Professor | null>(null);

  const handleOpenCreate = () => {
    setEditingProfessor(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prof: Professor) => {
    setEditingProfessor(prof);
    setIsModalOpen(true);
  };

  const handleSubmit = async (dto: CreateProfessorDTO) => {
    if (editingProfessor) {
      await updateProfessor(editingProfessor.id, dto);
    } else {
      await addProfessor(dto);
    }
    setIsModalOpen(false);
  };

  const confirmDelete = async () => {
    if (profToDelete) {
      await removeProfessor(profToDelete.id);
      setProfToDelete(null);
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
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Cuerpo Docente y Asesorías
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Directorio oficial de profesores, cubículos de consulta y medios de contacto.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md shadow-cove-blue/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Registrar Catedrático
        </button>
      </div>

      {professors.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-cove-blue/10 text-cove-blue flex items-center justify-center mx-auto mb-3">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            No hay profesores registrados
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mb-4 max-w-sm mx-auto">
            Guarda la información de tus catedráticos para consultar rápidamente horarios de asesoría y correos.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-cove-blue/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar primer catedrático
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {professors.map((prof) => (
            <div
              key={prof.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col justify-between group hover:border-cove-sky/50"
            >
              <div>
                {/* Cabecera de la Ficha Docente */}
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-cove-navy via-cove-deep to-cove-blue text-cove-sand border border-cove-sky/30 flex items-center justify-center font-black text-sm shadow-md ring-2 ring-cove-sky/20 shrink-0">
                      {prof.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-black text-slate-900 group-hover:text-cove-blue transition-colors line-clamp-2 leading-snug">
                        {prof.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md text-[10px] font-bold bg-cove-sky/15 text-cove-deep border border-cove-sky/20">
                        Catedrático Titular
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(prof)}
                      className="p-2 text-slate-400 hover:text-cove-blue hover:bg-cove-blue/10 rounded-xl transition-colors cursor-pointer"
                      title="Editar profesor"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setProfToDelete(prof)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Eliminar profesor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Medios de Contacto y Ubicación en el Campus */}
                <div className="mt-4 space-y-2 text-xs">
                  {prof.email && (
                    <a
                      href={`mailto:${prof.email}`}
                      className="flex items-center gap-2.5 p-2 rounded-2xl bg-slate-50/80 hover:bg-cove-blue/10 border border-slate-200/60 hover:border-cove-sky/40 text-slate-700 hover:text-cove-blue transition-all truncate"
                    >
                      <div className="w-6 h-6 rounded-lg bg-cove-blue/10 text-cove-blue flex items-center justify-center shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate font-medium">{prof.email}</span>
                    </a>
                  )}

                  {prof.phone && (
                    <a
                      href={`tel:${prof.phone}`}
                      className="flex items-center gap-2.5 p-2 rounded-2xl bg-slate-50/80 hover:bg-emerald-50 border border-slate-200/60 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 transition-all"
                    >
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium">{prof.phone}</span>
                    </a>
                  )}

                  {prof.office && (
                    <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-slate-50/80 border border-slate-200/60 text-slate-700">
                      <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate font-medium">{prof.office}</span>
                    </div>
                  )}

                  {prof.notes && (
                    <div className="mt-3 p-3.5 bg-cove-sand/35 border border-cove-gold/60 rounded-2xl text-[11px] text-slate-900 leading-relaxed shadow-2xs">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                        <CalendarCheck className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Horario de Asesoría Universitaria:</span>
                      </div>
                      <p className="font-medium text-slate-800 pl-5.5 italic">"{prof.notes}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Materias a Cargo */}
              <div className="mt-5 pt-3.5 border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                  Cátedras Asignadas:
                </span>
                {prof.subjectIds.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Sin materias vinculadas</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {prof.subjectIds.map((sid) => {
                      const sub = getSubjectById(sid);
                      if (!sub) return null;
                      return (
                        <span
                          key={sid}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-white shadow-2xs"
                          style={{ backgroundColor: sub.color }}
                        >
                          <BookOpen className="w-3 h-3" />
                          {sub.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProfessor ? 'Editar Datos del Catedrático' : 'Registrar Nuevo Catedrático'}
      >
        <ProfessorForm
          initialData={editingProfessor}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={profToDelete !== null}
        onClose={() => setProfToDelete(null)}
        title="¿Eliminar Catedrático?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            ¿Deseas desvincular a <strong>{profToDelete?.name}</strong>? Sus materias y apuntes no sufrirán cambios.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setProfToDelete(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
