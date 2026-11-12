import React, { useState, useEffect, useMemo } from 'react';
import {
  Import,
  MessageSquareText,
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
  Share2,
} from 'lucide-react';
import { useProfessors } from '../hooks/useProfessors';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import { ProfessorForm } from './ProfessorForm';
import { ProfessorAvatar } from './ProfessorAvatar';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { Modal } from '../../../shared/components/Modal';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { useScrollCollapse } from '../../../shared/hooks/useScrollCollapse';
import { Button, Card } from '../../../shared/components/atoms';
import type { Professor, CreateProfessorDTO } from '../types';
import { HEADER_SCRIM_CLASS, TONAL_CHIP_CLASS } from '../../../shared/styles/surfaces';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import {
  AGCONTACT_EXTENSION,
  AGCONTACT_MIME_TYPE,
  exportProfessorToAgcontact,
  parseAgcontactContent,
  shareProfessorContact,
  type ProfessorSharePackage,
} from '../services/professorShareService';
import { professorImportedMessage } from '../utils/importMessage';
import { ImportProfessorModal } from './ImportProfessorModal';
import { useSharedFilePicker } from '../../../shared/hooks/useSharedFilePicker';

interface ProfessorsViewProps {
  onEditorActiveChange?: (isActive: boolean) => void;
  isActive?: boolean;
}

export const ProfessorsView: React.FC<ProfessorsViewProps> = ({
  onEditorActiveChange,
  isActive = true,
}) => {
  const { professors, addProfessor, updateProfessor, removeProfessor } = useProfessors();
  const { subjects } = useSubjects();
  const isScrolled = useScrollCollapse(48);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | undefined>(undefined);
  const [profToDelete, setProfToDelete] = useState<Professor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdvisoriesModalOpen, setIsAdvisoriesModalOpen] = useState(false);

  // Mapa de materias para búsqueda O(1)
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

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

  // Filtrado y ordenamiento alfabético optimizado
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
      // Búsqueda O(1) por nombre de materia
      return (prof.subjectIds || []).some((sid) => {
        const sub = subjectMap.get(sid);
        return sub?.name.toLowerCase().includes(query);
      });
    });
  }, [professors, searchQuery, subjectMap]);

  // Avisos breves (p. ej. tras copiar un contacto al portapapeles)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const showToast = (text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text }));

  // Compartir contacto: hoja de compartir del sistema o, si no hay, portapapeles
  const handleShareProfessor = async (prof: Professor) => {
    const subjectNames = (prof.subjectIds || [])
      .map((sid) => subjectMap.get(sid)?.name)
      .filter((name): name is string => Boolean(name));
    try {
      const outcome = await shareProfessorContact(prof, subjectNames);
      if (outcome === 'copied') {
        showToast('Información de contacto copiada al portapapeles para enviar por WhatsApp');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo compartir el contacto.');
    }
  };

  // Compartir como archivo .agcontact: quien lo recibe lo abre directo en su agenda
  const handleShareAgcontact = async (prof: Professor) => {
    const subjectNames = (prof.subjectIds || [])
      .map((sid) => subjectMap.get(sid)?.name)
      .filter((name): name is string => Boolean(name));
    try {
      const result = await exportProfessorToAgcontact(prof, subjectNames);
      if (result.method === 'download') showToast(`Se descargó «${result.fileName}».`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo compartir el contacto.');
    }
  };

  // Importar un .agcontact elegido desde el almacenamiento del dispositivo
  const [importPackage, setImportPackage] = useState<ProfessorSharePackage | null>(null);
  const agcontactPicker = useSharedFilePicker({
    extension: AGCONTACT_EXTENSION,
    mimeType: AGCONTACT_MIME_TYPE,
    onContent: (content) => setImportPackage(parseAgcontactContent(content)),
    onError: showToast,
  });

  // Lista memoizada de profesores con datos de asesoría o cubículo para el modal
  const professorsWithAdvisories = useMemo(
    () => professors.filter((p) => p.office || p.notes),
    [professors]
  );

  // Vista de Edición / Creación Dedicada a Pantalla Completa
  if (isModalOpen) {
    return (
      <div className="w-full pb-8">
        <ErrorBoundary
          fallbackTitle="Error al abrir el formulario de docente"
          onReset={() => setIsModalOpen(false)}
        >
          <ProfessorForm
            initialData={editingProfessor}
            onSubmit={handleSubmit}
            onCancel={() => setIsModalOpen(false)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 w-full">
      <ContextualToast message={toast?.text ?? null} bottomOffset="nav" onClose={() => setToast(null)} />
      {/* 1. Encabezado del Apartado (Jerarquía Nivel 1 Compacta) */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${HEADER_SCRIM_CLASS}`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-black text-[var(--color-md-on-surface)] tracking-tight">
              Contactos Docentes
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
              {professors.length}
            </span>
          </div>
          <p className="text-xs text-[var(--color-md-on-surface-variant)] font-medium mt-0.5">
            Directorio de catedráticos, cubículos y horarios de asesoría.
          </p>
        </div>
        <div
          className={`flex shrink-0 flex-wrap items-center gap-2 origin-right transition-all duration-200 ${
            isScrolled ? 'sm:scale-75 sm:opacity-0 sm:pointer-events-none' : 'scale-100 opacity-100'
          }`}
        >
          <input {...agcontactPicker.inputProps} />
          <Button
            variant="secondary"
            size="sm"
            icon={<Import className="w-4 h-4 stroke-[2.3]" />}
            onClick={agcontactPicker.open}
            className="active:scale-95 whitespace-nowrap"
          >
            Importar (.agcontact)
          </Button>
          {/* En móvil se registra con el botón flotante */}
          <div className="hidden sm:block">
            <Button
              variant="primary"
              size="sm"
              icon={<UserPlus className="w-4 h-4 stroke-[2.3]" />}
              onClick={handleOpenCreate}
              className="shadow-sm hover:shadow ring-1 ring-[#00639B]/25 dark:ring-[#96CCFF]/35 active:scale-95 whitespace-nowrap"
            >
              Registrar Catedrático
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Banner Interactivo de Asesorías y Cubículos (Compactado) */}
      <div className="bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/40 dark:border-[#43474E]/40 rounded-2xl overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setIsAdvisoriesModalOpen(true)}
          className="w-full flex items-center justify-between p-2.5 sm:p-3 hover:bg-[#E2E7EF]/40 dark:hover:bg-[#272A2F]/40 transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#D7E8CD] dark:bg-[#234E27] text-[#0E2010] dark:text-[#D7E8CD] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <CalendarCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] block group-hover:text-[#386A20] dark:group-hover:text-[#B1F194] transition-colors truncate">
                Consultar asesorías y cubículos
              </span>
              <span className="text-[11px] text-[#43474E] dark:text-[#8C9199] block mt-0.5 truncate">
                Directorio rápido de horarios de atención y oficinas
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#72777F] dark:text-[#8C9199] group-hover:text-[#386A20] dark:group-hover:text-[#B1F194] transition-colors shrink-0 ml-2" />
        </button>
      </div>

      {/* 3. Barra de Búsqueda Compacta (M3 Search Bar) */}
      <div className="relative">
        <div className="relative flex items-center bg-[#E2E7EF] dark:bg-[#272A2F] border border-transparent focus-within:border-[#00639B] dark:focus-within:border-[#92CCFF] focus-within:ring-2 focus-within:ring-[#00639B]/20 rounded-full h-10 sm:h-11 px-3.5 sm:px-4 shadow-2xs transition-all">
          <div className="pr-2.5 text-[#43474E] dark:text-[#C3C7D0]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, cubículo, materia o correo..."
            className="w-full py-1.5 pr-8 text-xs sm:text-sm bg-transparent text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#43474E] dark:placeholder:text-[#8C9199] outline-none font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 rounded-full text-[#43474E] hover:text-[#191C20] dark:text-[#C3C7D0] dark:hover:text-[#E2E2E6] hover:bg-[#1D2024]/10 dark:hover:bg-[#E2E2E6]/10 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Subtítulo de Sección */}
      <div className="flex items-center justify-between px-1 pt-0.5">
        <span className={TONAL_CHIP_CLASS}>
          Directorio alfabético · {filteredProfessors.length}{' '}
          {filteredProfessors.length === 1 ? 'catedrático' : 'catedráticos'}
        </span>
        {searchQuery && (
          <span className={`${TONAL_CHIP_CLASS} text-[var(--color-md-primary)]`}>
            Filtrando resultados
          </span>
        )}
      </div>

      {/* Lista de Contactos (Material Design 3 High-Density Cards) */}
      {filteredProfessors.length === 0 ? (
        <Card padding="relaxed" className="text-center py-10 border-dashed">
          <div className="w-10 h-10 rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] flex items-center justify-center mx-auto mb-2.5">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-md-on-surface)] mb-1">
            {searchQuery ? 'No se encontraron catedráticos' : 'No hay catedráticos registrados'}
          </h3>
          <p className="text-xs text-[var(--color-md-on-surface-variant)] mb-3 max-w-sm mx-auto">
            {searchQuery
              ? `No hay coincidencias para "${searchQuery}". Intenta con otro término.`
              : 'Registra a tus profesores para tener a mano sus contactos y horarios de asesoría.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3.5 py-1.5 text-xs font-bold text-[var(--color-md-on-primary-container)] bg-[var(--color-md-primary-container)] rounded-full hover:bg-[var(--color-md-secondary-container)] transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer"
            >
              Borrar filtro
            </button>
          ) : (
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={handleOpenCreate}
              className="shadow-sm"
            >
              Registrar catedrático
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3">
          {filteredProfessors.map((prof) => {
            // Una sola acción de contacto visible: el correo si existe, si no el teléfono.
            // El otro canal, editar y eliminar quedan en el menú ⋮.
            const primaryContact: 'email' | 'phone' | null = prof.email ? 'email' : prof.phone ? 'phone' : null;

            return (
            <Card
              key={prof.id}
              padding="compact"
              interactive
              className="content-auto flex flex-col justify-between gap-2 group"
            >
              {/* Fila Superior: Avatar + Nombre + Micro-acciones de Edición/Borrado */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <ProfessorAvatar
                    name={prof.name}
                    icon={prof.icon}
                    color={prof.color}
                    size="contact"
                    shape="circle"
                    className="shrink-0 ring-1 ring-white/60 dark:ring-white/10 shadow-2xs mt-0.5"
                  />

                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-[var(--color-md-on-surface)] leading-tight break-words group-hover:text-[var(--color-md-primary)] transition-colors duration-150">
                      {prof.name}
                    </h3>

                    {/* Materias vinculadas */}
                    {(prof.subjectIds || []).length > 0 && (
                      <div className="flex items-center flex-wrap gap-1 mt-1">
                        {(prof.subjectIds || []).map((sid) => {
                          const sub = subjectMap.get(sid);
                          if (!sub) return null;
                          return (
                            <span
                              key={sid}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold text-white shadow-2xs max-w-full"
                              style={{ backgroundColor: sub.color }}
                            >
                              <SubjectIcon icon={sub.icon} className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate max-w-[140px] sm:max-w-[200px]">{sub.name}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones secundarias y de gestión agrupadas en el menú ⋮ */}
                <M3KebabMenu
                  items={[
                    ...(prof.phone && primaryContact !== 'phone'
                      ? [
                          {
                            id: 'call',
                            label: `Llamar (${prof.phone})`,
                            icon: <Phone className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                            onClick: () => {
                              window.location.href = `tel:${prof.phone}`;
                            },
                          },
                        ]
                      : []),
                    {
                      id: 'share-agcontact',
                      label: 'Compartir (.agcontact)',
                      icon: <Share2 className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                      onClick: () => void handleShareAgcontact(prof),
                    },
                    {
                      id: 'share',
                      label: 'Compartir como texto',
                      icon: <MessageSquareText className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                      onClick: () => void handleShareProfessor(prof),
                    },
                    {
                      id: 'edit',
                      label: 'Editar catedrático',
                      icon: <Edit2 className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                      onClick: () => handleOpenEdit(prof),
                    },
                    {
                      id: 'delete',
                      label: 'Eliminar catedrático',
                      icon: <Trash2 className="w-3.5 h-3.5" />,
                      variant: 'destructive',
                      onClick: () => setProfToDelete(prof),
                    },
                  ]}
                />
              </div>

              {/* Fila inferior: datos de solo lectura + una única acción de contacto */}
              {(prof.office || prof.notes || primaryContact) && (
                <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[var(--color-md-outline-variant)]">
                  <div className="flex items-center flex-wrap gap-1 min-w-0 text-[10px] font-medium">
                    {prof.office && (
                      <span className="inline-flex items-center gap-1 text-[var(--color-md-on-surface-variant)] bg-[var(--color-md-surface-container)] px-2 py-0.5 rounded-md max-w-full">
                        <MapPin className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-[130px] sm:max-w-[180px]">{prof.office}</span>
                      </span>
                    )}

                    {prof.notes && (
                      <span className="inline-flex items-center gap-1 text-[var(--color-md-on-secondary-container)] bg-[var(--color-md-secondary-container)] px-2 py-0.5 rounded-md max-w-full">
                        <CalendarCheck className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-[130px] sm:max-w-[180px]">{prof.notes}</span>
                      </span>
                    )}
                  </div>

                  {primaryContact && (
                    <a
                      href={primaryContact === 'email' ? `mailto:${prof.email}` : `tel:${prof.phone}`}
                      className="inline-flex items-center gap-1.5 h-7 px-3 ml-auto shrink-0 rounded-full text-[11px] font-bold whitespace-nowrap bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] hover:bg-[var(--color-md-primary-hover)] shadow-xs transition-all duration-150 ease-out active:scale-[0.98]"
                      aria-label={
                        primaryContact === 'email'
                          ? `Enviar correo a ${prof.name}`
                          : `Llamar a ${prof.name}`
                      }
                    >
                      {primaryContact === 'email' ? (
                        <Mail className="w-3 h-3 shrink-0" aria-hidden="true" />
                      ) : (
                        <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
                      )}
                      <span>{primaryContact === 'email' ? 'Correo' : 'Llamar'}</span>
                    </a>
                  )}
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}

      {/* Modal Directorio de Asesorías y Cubículos */}
      <Modal
        isOpen={isAdvisoriesModalOpen}
        onClose={() => setIsAdvisoriesModalOpen(false)}
        title="Directorio de Asesorías y Cubículos"
        maxWidth="md"
      >
        <div className="space-y-2.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Horarios de atención fuera de clase y ubicación física de los docentes en el campus.
          </p>
          <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-white/5">
            {professorsWithAdvisories.length === 0 ? (
              <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                No hay catedráticos con información de cubículo o asesorías registrada.
              </div>
            ) : (
              professorsWithAdvisories.map((p) => (
                <div key={p.id} className="pt-2 first:pt-0 flex items-start gap-2.5">
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
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>Cubículo: {p.office}</span>
                      </div>
                    )}
                    {p.notes && (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
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
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
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
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            ¿Deseas desvincular a <strong className="text-slate-900 dark:text-white">{profToDelete?.name}</strong>? Sus materias y apuntes no sufrirán cambios.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={() => setProfToDelete(null)}
              className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {/* Vista previa de un .agcontact importado a mano */}
      {importPackage && (
        <ImportProfessorModal
          key={`${importPackage.exportedAt}-${importPackage.professor.name}`}
          sharePackage={importPackage}
          onClose={() => setImportPackage(null)}
          onImported={(result) => {
            setImportPackage(null);
            showToast(professorImportedMessage(result));
          }}
        />
      )}

      {/* Botón Flotante Reubicable */}
      {isActive && (
        <DraggableFAB
          colorScheme="professors"
          onClick={handleOpenCreate}
          label="Registrar Catedrático"
          icon={<UserPlus className="w-6 h-6 stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
