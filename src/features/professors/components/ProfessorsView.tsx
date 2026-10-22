import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Users,
  UserPlus,
  CalendarCheck,
  Search,
  X,
  ChevronRight,
} from 'lucide-react';
import { useProfessors } from '../hooks/useProfessors';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import { ProfessorForm } from './ProfessorForm';
import { ProfessorAvatar } from './ProfessorAvatar';
import { Modal } from '../../../shared/components/Modal';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { Button, Card } from '../../../shared/components/atoms';
import type { Professor, CreateProfessorDTO } from '../types';

interface ProfessorsViewProps {
  onEditorActiveChange?: (isActive: boolean) => void;
  isActive?: boolean;
}

export const ProfessorsView: React.FC<ProfessorsViewProps> = ({
  onEditorActiveChange,
  isActive = true,
}) => {
  const { professors, addProfessor, updateProfessor, removeProfessor } = useProfessors();
  const { getSubjectById } = useSubjects();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | undefined>(undefined);
  const [profToDelete, setProfToDelete] = useState<Professor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdvisoriesModalOpen, setIsAdvisoriesModalOpen] = useState(false);

  useEffect(() => {
    onEditorActiveChange?.(isModalOpen);
    return () => {
      onEditorActiveChange?.(false);
    };
  }, [isModalOpen, onEditorActiveChange]);

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

  // Filtrado y ordenamiento alfabético estilo Telegram
  const filteredProfessors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sorted = [...professors].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );

    if (!query) return sorted;

    return sorted.filter((prof) => {
      if (prof.name.toLowerCase().includes(query)) return true;
      if (prof.email?.toLowerCase().includes(query)) return true;
      if (prof.phone?.includes(query)) return true;
      if (prof.office?.toLowerCase().includes(query)) return true;
      if (prof.notes?.toLowerCase().includes(query)) return true;
      // Buscar también por nombre de las materias asignadas
      return prof.subjectIds.some((sid) => {
        const sub = getSubjectById(sid);
        return sub?.name.toLowerCase().includes(query);
      });
    });
  }, [professors, searchQuery, getSubjectById]);

  // Vista de Edición / Creación Dedicada a Pantalla Completa (Aprovechando todo el espacio en PC)
  if (isModalOpen) {
    return (
      <div className="w-full pb-12">
        <ProfessorForm
          initialData={editingProfessor}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* 1. ENCABEZADO DEL APARTADO (JERARQUÍA NIVEL 1 EN EL BODY) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Contactos Docentes
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF]">
              {professors.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Directorio oficial de catedráticos, cubículos y horarios de asesoría.
          </p>
        </div>
        <div className="hidden sm:block shrink-0">
          <Button
            variant="primary"
            size="lg"
            icon={<UserPlus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.4]" />}
            onClick={handleOpenCreate}
            className="shadow-md hover:shadow-lg ring-2 ring-[#00639B]/25 dark:ring-[#96CCFF]/35 hover:scale-[1.02]"
          >
            Registrar Catedrático
          </Button>
        </div>
      </div>

      {/* 2. TARJETA INFORMATIVA DE ASESORÍAS Y CUBÍCULOS (JERARQUÍA NIVEL 2) */}
      <div className="bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setIsAdvisoriesModalOpen(true)}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-[#E2E7EF]/50 dark:hover:bg-[#272A2F]/50 transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#D7E8CD] dark:bg-[#234E27] text-[#0E2010] dark:text-[#D7E8CD] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <CalendarCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] block group-hover:text-[#386A20] dark:group-hover:text-[#B1F194] transition-colors">
                Consultar asesorías y cubículos
              </span>
              <span className="text-xs text-[#43474E] dark:text-[#8C9199] block mt-0.5">
                Directorio rápido de horarios de atención y oficinas docentes
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#72777F] dark:text-[#8C9199] group-hover:text-[#386A20] dark:group-hover:text-[#B1F194] transition-colors shrink-0" />
        </button>
      </div>

      {/* 3. BARRA DE BÚSQUEDA Y CONTENIDO DEL DIRECTORIO (JERARQUÍA NIVEL 3) */}
      <div className="relative">
        <div className="relative flex items-center bg-[#E2E7EF] dark:bg-[#272A2F] border border-transparent focus-within:border-[#00639B] dark:focus-within:border-[#92CCFF] focus-within:ring-2 focus-within:ring-[#00639B]/20 rounded-full h-12 sm:h-14 px-4 sm:px-5 shadow-xs transition-all">
          <div className="pr-3 text-[#43474E] dark:text-[#C3C7D0]">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, cubículo, materia o correo..."
            className="w-full py-2 pr-9 text-xs sm:text-sm bg-transparent text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#43474E] dark:placeholder:text-[#8C9199] outline-none font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-4 p-1.5 rounded-full text-[#43474E] hover:text-[#191C20] dark:text-[#C3C7D0] dark:hover:text-[#E2E2E6] hover:bg-[#1D2024]/10 dark:hover:bg-[#E2E2E6]/10 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Encabezado de Sección Alfabética */}
      <div className="flex items-center justify-between px-1.5 pt-1">
        <span className="text-[11px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider">
          Directorio Alfabético • {filteredProfessors.length}{' '}
          {filteredProfessors.length === 1 ? 'Catedrático' : 'Catedráticos'}
        </span>
        {searchQuery && (
          <span className="text-[11px] text-[#00639B] dark:text-[#92CCFF] font-semibold">
            Filtrando resultados
          </span>
        )}
      </div>

      {/* Lista Agrupada Continua de Contactos (Material Design 3 Elevated List) */}
      {filteredProfessors.length === 0 ? (
        <Card padding="relaxed" className="text-center py-12 border-dashed border-[#C3C7D0] dark:border-[#43474E]">
          <div className="w-12 h-12 rounded-full bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1">
            {searchQuery ? 'No se encontraron catedráticos' : 'No hay catedráticos registrados'}
          </h3>
          <p className="text-xs text-[#43474E] dark:text-[#8C9199] mb-4 max-w-sm mx-auto">
            {searchQuery
              ? `No hay coincidencias para "${searchQuery}". Intenta con otro nombre, cubículo o materia.`
              : 'Registra a tus profesores para tener a mano sus contactos y horarios de asesoría.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 text-xs font-bold text-[#00639B] dark:text-[#92CCFF] bg-[#D0E4FF]/60 dark:bg-[#004B76]/50 rounded-full hover:bg-[#D0E4FF] transition-colors cursor-pointer"
            >
              Borrar filtro de búsqueda
            </button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              icon={<Plus className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />}
              onClick={handleOpenCreate}
              className="shadow-md"
            >
              Registrar primer catedrático
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3.5">
          {filteredProfessors.map((prof) => (
            <div
              key={prof.id}
              className="flex flex-col justify-between gap-2.5 p-3.5 sm:p-4 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[24px] sm:rounded-[28px] shadow-xs hover:bg-[#E2E7EF]/40 dark:hover:bg-[#272A2F]/40 hover:border-[#00639B]/40 transition-all group"
            >
              {/* Fila Superior: Avatar + Nombre Completo y Materias + Botones de Edición/Borrado */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Avatar Circular M3 */}
                  <ProfessorAvatar
                    name={prof.name}
                    icon={prof.icon}
                    color={prof.color}
                    size="contact"
                    shape="circle"
                    className="shrink-0 ring-2 ring-white/60 dark:ring-white/10 shadow-2xs mt-0.5"
                  />

                  {/* Nombre y Materias Vinculadas con 100% de ancho libre */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-[#191C20] dark:text-[#E2E2E6] leading-snug break-words group-hover:text-[#00639B] dark:group-hover:text-[#92CCFF] transition-colors">
                      {prof.name}
                    </h3>

                    {/* Materias vinculadas como micro-pills */}
                    <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                      {prof.subjectIds.length > 0 ? (
                        prof.subjectIds.map((sid) => {
                          const sub = getSubjectById(sid);
                          if (!sub) return null;
                          return (
                            <span
                              key={sid}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-2xs max-w-full"
                              style={{ backgroundColor: sub.color }}
                            >
                              <SubjectIcon icon={sub.icon} className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate max-w-[160px] sm:max-w-[220px]">{sub.name}</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[11px] text-[#72777F] dark:text-[#8C9199] italic">
                          Sin materias asignadas
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones de Gestión (Editar / Eliminar) en Esquina Superior Derecha sin colisionar */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(prof)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] hover:text-[#001D32] dark:hover:text-[#D0E4FF] flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xs"
                    title="Editar datos del catedrático"
                    aria-label="Editar profesor"
                  >
                    <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setProfToDelete(prof)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#FFDAD6] dark:bg-[#93000A] text-[#410002] dark:text-[#FFDAD6] hover:opacity-90 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xs"
                    title="Eliminar catedrático"
                    aria-label="Eliminar profesor"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

              {/* Fila Inferior: Cubículo, Horario de Asesoría y Botones de Contacto Directo (Llamar / Correo) */}
              {(prof.office || prof.notes || prof.phone || prof.email) && (
                <div className="flex items-center justify-between flex-wrap gap-2 pl-0 sm:pl-14 pt-1">
                  {/* Chips de Ubicación y Asesoría */}
                  <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                    {prof.office && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#191C20] dark:text-[#E2E2E6] bg-[#E2E7EF] dark:bg-[#272A2F] px-2.5 py-1 rounded-lg max-w-full">
                        <MapPin className="w-3 h-3 text-[#BA1A1A] dark:text-[#FFB4AB] shrink-0" />
                        <span className="truncate max-w-[180px] sm:max-w-[240px]">{prof.office}</span>
                      </span>
                    )}

                    {prof.notes && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0E2010] dark:text-[#D7E8CD] bg-[#D7E8CD] dark:bg-[#234E27] px-2.5 py-1 rounded-lg max-w-full">
                        <CalendarCheck className="w-3 h-3 text-[#386A20] dark:text-[#B1F194] shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-[280px]">{prof.notes}</span>
                      </span>
                    )}
                  </div>

                  {/* Botones de Contacto Rápido (Teléfono y Correo) */}
                  {(prof.phone || prof.email) && (
                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                      {prof.phone && (
                        <a
                          href={`tel:${prof.phone}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#D7E8CD] dark:bg-[#234E27] text-[#0E2010] dark:text-[#D7E8CD] hover:opacity-90 transition-all active:scale-95 shadow-2xs"
                          title={`Llamar a ${prof.name} (${prof.phone})`}
                          aria-label="Llamar al profesor"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>Llamar</span>
                        </a>
                      )}

                      {prof.email && (
                        <a
                          href={`mailto:${prof.email}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] hover:opacity-90 transition-all active:scale-95 shadow-2xs"
                          title={`Enviar correo a ${prof.email}`}
                          aria-label="Enviar correo al profesor"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span>Correo</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Directorio de Asesorías y Cubículos */}
      <Modal
        isOpen={isAdvisoriesModalOpen}
        onClose={() => setIsAdvisoriesModalOpen(false)}
        title="Directorio de Asesorías y Cubículos"
        maxWidth="md"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Horarios de atención fuera de clase y ubicación física de los docentes en el campus.
          </p>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-white/5">
            {professors.filter((p) => p.office || p.notes).length === 0 ? (
              <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                No hay catedráticos con información de cubículo o asesorías registrada.
              </div>
            ) : (
              professors
                .filter((p) => p.office || p.notes)
                .map((p) => (
                  <div key={p.id} className="pt-2.5 first:pt-0 flex items-start gap-3">
                    <ProfessorAvatar
                      name={p.name}
                      icon={p.icon}
                      color={p.color}
                      size="sm"
                      shape="circle"
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {p.name}
                      </div>
                      {p.office && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>Cubículo: {p.office}</span>
                        </div>
                      )}
                      {p.notes && (
                        <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                          <CalendarCheck className="w-3 h-3 shrink-0" />
                          <span>Asesorías: {p.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setIsAdvisoriesModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={profToDelete !== null}
        onClose={() => setProfToDelete(null)}
        title="¿Eliminar Catedrático?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            ¿Deseas desvincular a <strong className="text-slate-900 dark:text-white">{profToDelete?.name}</strong>? Sus materias y apuntes no sufrirán cambios.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setProfToDelete(null)}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {/* Botón Flotante Móvil Reubicable (FAB con Snap a Bordes - Estilo Telegram) */}
      {isActive && (
        <DraggableFAB
          colorScheme="professors"
          onClick={handleOpenCreate}
          label="Registrar Catedrático"
          icon={<UserPlus className="w-6 h-6 text-white stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
