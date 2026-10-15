import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Users,
  CalendarCheck,
  ExternalLink,
} from 'lucide-react';
import { useProfessors } from '../hooks/useProfessors';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import { ProfessorForm } from './ProfessorForm';
import { ProfessorAvatar } from './ProfessorAvatar';
import { Modal } from '../../../shared/components/Modal';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
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
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Cuerpo Docente y Asesorías
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Directorio oficial de profesores, cubículos de consulta y medios de contacto.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-amber-500 text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md shadow-amber-500/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Registrar Catedrático
        </button>
      </div>

      {professors.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-cove-blue/10 dark:bg-cove-blue/20 text-cove-blue dark:text-cove-sky flex items-center justify-center mx-auto mb-3">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            No hay profesores registrados
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
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
          {professors.map((prof) => {
            const primarySubject = prof.subjectIds.length > 0 ? getSubjectById(prof.subjectIds[0]) : null;
            const cardColor = primarySubject?.color || '#006BBB';

            return (
              <div
                key={prof.id}
                style={{
                  background: `linear-gradient(145deg, ${cardColor}1f 0%, ${cardColor}0c 100%), var(--card-bg, #ffffff)`,
                  borderColor: `${cardColor}40`,
                }}
                className="rounded-3xl p-5 sm:p-6 border shadow-2xs hover:shadow-lg hover:-translate-y-0.5 transition-all relative overflow-hidden flex flex-row items-stretch justify-between gap-3 sm:gap-4 group"
              >
                {/* Contenido Principal (Izquierda) */}
                <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3.5">
                <div>
                  {/* Cabecera de la Ficha Docente */}
                  <div className="flex items-center gap-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <ProfessorAvatar
                      name={prof.name}
                      icon={prof.icon}
                      color={prof.color}
                      size="lg"
                      className="border border-white/20"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-cove-blue dark:group-hover:text-cove-sky transition-colors line-clamp-2 leading-snug">
                        {prof.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md text-[10px] font-bold bg-cove-sky/15 text-cove-deep dark:text-cove-sky border border-cove-sky/20">
                        Catedrático Titular
                      </span>
                    </div>
                  </div>

                  {/* Medios de Contacto y Ubicación en el Campus */}
                  <div className="mt-3.5 space-y-2 text-xs">
                    {prof.email && (
                      <a
                        href={`mailto:${prof.email}`}
                        className="group/contact flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-sky-50/90 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-cove-sky/60 text-slate-700 dark:text-slate-300 hover:text-cove-blue dark:hover:text-cove-sky transition-all truncate shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
                        title={`Enviar correo electrónico a ${prof.email}`}
                        aria-label={`Enviar correo a ${prof.name}`}
                      >
                        {/* Ícono con forma de botón táctil */}
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cove-blue to-cove-sky text-white flex items-center justify-center shrink-0 shadow-xs group-hover/contact:scale-105 group-hover/contact:shadow-sm transition-all">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                            Correo Electrónico
                          </span>
                          <span className="block truncate font-bold text-slate-800 dark:text-slate-200 group-hover/contact:text-cove-blue dark:group-hover/contact:text-cove-sky text-xs">
                            {prof.email}
                          </span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/contact:text-cove-blue shrink-0 opacity-0 group-hover/contact:opacity-100 transition-opacity" />
                      </a>
                    )}

                    {prof.phone && (
                      <a
                        href={`tel:${prof.phone}`}
                        className="group/contact flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-emerald-50/90 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-300 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all truncate shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
                        title={`Llamar al ${prof.phone}`}
                        aria-label={`Llamar a ${prof.name}`}
                      >
                        {/* Ícono con forma de botón táctil */}
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-xs group-hover/contact:scale-105 group-hover/contact:shadow-sm transition-all">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                            Teléfono / Contacto
                          </span>
                          <span className="block truncate font-bold text-slate-800 dark:text-slate-200 group-hover/contact:text-emerald-700 dark:group-hover/contact:text-emerald-400 text-xs font-mono">
                            {prof.phone}
                          </span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/contact:text-emerald-600 shrink-0 opacity-0 group-hover/contact:opacity-100 transition-opacity" />
                      </a>
                    )}

                    {prof.office && (
                      <div className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 shadow-2xs">
                        <div className="w-8 h-8 rounded-xl bg-amber-100/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                            Cubículo / Ubicación
                          </span>
                          <span className="block truncate font-medium text-slate-800 dark:text-slate-200 text-xs">
                            {prof.office}
                          </span>
                        </div>
                      </div>
                    )}

                    {prof.notes && (
                      <div className="mt-3 p-3 bg-cove-sand/35 dark:bg-amber-950/30 border border-cove-gold/60 dark:border-amber-800/60 rounded-2xl text-[11px] text-slate-900 dark:text-amber-100 leading-relaxed shadow-2xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 mb-0.5">
                          <CalendarCheck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                          <span>Horario de Asesoría:</span>
                        </div>
                        <p className="font-medium text-slate-800 dark:text-slate-200 italic">"{prof.notes}"</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Materias a Cargo */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
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
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-xs font-bold text-white shadow-2xs"
                            style={{ backgroundColor: sub.color }}
                          >
                            <SubjectIcon icon={sub.icon} className="w-3 h-3 shrink-0" />
                            {sub.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Vertical de Acciones (Derecha: Editar y Eliminar) - Alineada y Proporcional */}
              <div className="flex flex-col justify-center items-center shrink-0 pl-2 sm:pl-3 py-0.5 gap-2.5 sm:gap-3">
                {/* Botón 1: Editar profesor (Azul para editar) */}
                <button
                  onClick={() => handleOpenEdit(prof)}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-cove-navy hover:from-blue-500 hover:via-blue-600 hover:to-cove-navy ring-1 ring-sky-300/40 text-white flex items-center justify-center transition-all active:scale-95 shadow-sm hover:shadow-md shadow-blue-950/20 cursor-pointer"
                  title="Editar datos del catedrático"
                  aria-label="Editar profesor"
                >
                  <Edit2 className="w-4 h-4 text-white" />
                </button>

                {/* Botón 2: Eliminar profesor (Rojo para eliminar) */}
                <button
                  onClick={() => setProfToDelete(prof)}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-red-500 via-rose-600 to-slate-900 hover:from-red-400 hover:via-rose-500 hover:to-slate-900 ring-1 ring-rose-300/40 text-white flex items-center justify-center transition-all active:scale-95 shadow-sm hover:shadow-md shadow-red-950/20 cursor-pointer"
                  title="Eliminar catedrático"
                  aria-label="Eliminar profesor"
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

      {/* Botón Flotante Móvil Reubicable (FAB con Snap a Bordes) */}
      <DraggableFAB
        colorScheme="professors"
        onClick={handleOpenCreate}
        label="Registrar Catedrático"
      />
    </div>
  );
};
