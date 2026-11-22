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
  ChevronRight,
  Share2,
} from 'lucide-react';
import { useProfessors } from '../hooks/useProfessors';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { ProfessorForm } from './ProfessorForm';
import { ProfessorAvatar } from './ProfessorAvatar';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { useAutoHideFabs } from '../../../shared/hooks/useAutoHideFabs';
import { Button, Card } from '../../../shared/components/atoms';
import type { Professor, CreateProfessorDTO } from '../types';
import {
  ABOVE_STRETCHED_CLASS,
  HEADER_SCRIM_CLASS,
  STRETCHED_CARD_BUTTON_CLASS,
} from '../../../shared/styles/surfaces';
import { useDetailSelection, type DetailRequest, type DetailReturn } from '../../../shared/navigation/detailNavigation';
import { ProfessorDetailView } from './ProfessorDetailView';
import { ProfessorContactSheet } from './ProfessorContactSheet';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { StickyToolbar } from '../../../shared/components/StickyToolbar';
import { SearchField } from '../../../shared/components/SearchField';
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
  /** Petición de App para abrir la ficha de un catedrático (desde la ficha de una materia). */
  detailRequest?: DetailRequest | null;
  /** Abrir la ficha técnica de una materia (pestaña Materias) recordando cómo volver. */
  onOpenSubjectDetail?: (subjectId: string, from?: DetailReturn) => void;
  /** Al cerrar una ficha a la que se llegó desde otra pestaña: volver ahí. */
  onReturnFromDetail?: (to: DetailReturn) => void;
}

export const ProfessorsView: React.FC<ProfessorsViewProps> = ({
  onEditorActiveChange,
  isActive = true,
  detailRequest,
  onOpenSubjectDetail,
  onReturnFromDetail,
}) => {
  const { professors, addProfessor, updateProfessor, removeProfessor } = useProfessors();
  const { subjects } = useSubjects();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | undefined>(undefined);
  const [profToDelete, setProfToDelete] = useState<Professor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdvisoriesModalOpen, setIsAdvisoriesModalOpen] = useState(false);

  // Mapa de materias para búsqueda O(1)
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  // Ficha de detalle abierta (por id: así refleja al momento lo que se edite)
  const detail = useDetailSelection('professor', detailRequest, onReturnFromDetail);
  const selectedProfessor = detail.selectedId ? professors.find((p) => p.id === detail.selectedId) : undefined;
  /** Materias que imparte: las de su lista y las que lo tienen como titular. */
  const subjectsOf = (prof: Professor) => {
    const ids = new Set(prof.subjectIds || []);
    return subjects.filter((s) => ids.has(s.id) || s.professorId === prof.id);
  };

  // Formulario o ficha a pantalla completa: App oculta el Navbar y la barra inferior
  const isFullScreen = isModalOpen || selectedProfessor !== undefined;
  useEffect(() => {
    onEditorActiveChange?.(isFullScreen);
    return () => {
      onEditorActiveChange?.(false);
    };
  }, [isFullScreen, onEditorActiveChange]);
  // Al bajar por la lista, el botón de agregar y el selector Materias | Profesores se apartan
  useAutoHideFabs(isActive && !isFullScreen);

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
      // Si se eliminó desde su ficha, se vuelve al directorio
      if (profToDelete.id === detail.selectedId) detail.dismiss();
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

  // "Contacto": el estudiante elige llamar, WhatsApp, Telegram o en qué app guardarlo
  const [contactProf, setContactProf] = useState<Professor | null>(null);
  const contactSubjectNames = useMemo(
    () =>
      (contactProf?.subjectIds || [])
        .map((sid) => subjectMap.get(sid)?.name)
        .filter((name): name is string => Boolean(name)),
    [contactProf, subjectMap]
  );
  const contactSheet = (
    <ProfessorContactSheet
      professor={contactProf}
      subjectNames={contactSubjectNames}
      onClose={() => setContactProf(null)}
      onNotify={showToast}
    />
  );

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

  // Confirmación de borrado: se usa en el directorio y en la ficha
  const deleteModal = (
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
        <ModalActions>
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
        </ModalActions>
      </div>
    </Modal>
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

  // Ficha de contacto del catedrático a pantalla completa
  if (selectedProfessor) {
    return (
      <>
        <ProfessorDetailView
          professor={selectedProfessor}
          subjects={subjectsOf(selectedProfessor)}
          onBack={detail.close}
          onEdit={() => handleOpenEdit(selectedProfessor)}
          onDelete={() => setProfToDelete(selectedProfessor)}
          onShareAgcontact={() => void handleShareAgcontact(selectedProfessor)}
          onShareText={() => void handleShareProfessor(selectedProfessor)}
          onOpenContact={() => setContactProf(selectedProfessor)}
          onSelectSubject={
            onOpenSubjectDetail
              ? (subject) => {
                  const from = detail.returnPoint('professors');
                  detail.dismiss();
                  onOpenSubjectDetail(subject.id, from);
                }
              : undefined
          }
        />
        {deleteModal}
        {contactSheet}
        <ContextualToast message={toast?.text ?? null} bottomOffset="compact" onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="glass-legible space-y-3.5 w-full">
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
          className={`flex shrink-0 flex-wrap items-center gap-2 origin-right transition-all duration-200 scale-100 opacity-100 scrolled:sm:scale-75 scrolled:sm:opacity-0 scrolled:sm:pointer-events-none`}
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
              className="shadow-sm hover:shadow ring-1 ring-[var(--color-md-primary)]/25 active:scale-95 whitespace-nowrap"
            >
              Registrar Catedrático
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Banner Interactivo de Asesorías y Cubículos (Compactado) */}
      <div className="md-card bg-[var(--md-card-surface)] border border-[var(--color-md-outline-variant)]/40 rounded-2xl overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setIsAdvisoriesModalOpen(true)}
          className="w-full flex items-center justify-between p-2.5 sm:p-3 hover:bg-[var(--color-md-surface-container-high)]/40 transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#D7E8CD] dark:bg-[#234E27] text-[#0E2010] dark:text-[#D7E8CD] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <CalendarCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-[var(--color-md-on-surface)] block group-hover:text-[#386A20] dark:group-hover:text-[#B1F194] transition-colors truncate">
                Consultar asesorías y cubículos
              </span>
              <span className="text-11px text-[var(--color-md-on-surface-variant)] block mt-0.5 truncate">
                Directorio rápido de horarios de atención y oficinas
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--color-md-outline)] group-hover:text-[#386A20] dark:group-hover:text-[#B1F194] transition-colors shrink-0 ml-2" />
        </button>
      </div>

      {/* 3. Barra de Búsqueda: se queda fija bajo el Navbar al hacer scroll */}
      <StickyToolbar>
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por nombre, materia o cubículo…"
          ariaLabel="Buscar catedráticos por nombre, materia, cubículo o correo"
        />
      </StickyToolbar>

      {/* Encabezado de la lista: texto alineado a la izquierda (no una píldora que parezca botón) */}
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-sm font-black text-[var(--color-md-on-surface)]">
          {searchQuery ? 'Resultados' : 'Directorio alfabético'}
          <span className="ml-1.5 text-xs font-medium text-[var(--color-md-on-surface-variant)]">
            {filteredProfessors.length} {filteredProfessors.length === 1 ? 'catedrático' : 'catedráticos'}
          </span>
        </h3>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="h-9 shrink-0 rounded-full px-3 text-xs font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10 active:scale-95"
          >
            Borrar búsqueda
          </button>
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
        // pb-28 en el teléfono: el último «Correo» queda libre de los botones flotantes
        <div className="grid grid-cols-1 gap-2.5 pb-28 sm:gap-3 md:grid-cols-2 md:pb-0 xl:grid-cols-3">
          {filteredProfessors.map((prof) => {
            // Acciones visibles: Correo (si hay correo) y Contacto (si hay teléfono: llamar,
            // WhatsApp, Telegram o guardarlo). La principal va rellena; la otra, tonal.
            const hasEmail = Boolean(prof.email?.trim());
            const hasPhone = Boolean(prof.phone?.trim());
            const assignedSubjects = (prof.subjectIds || []).flatMap((sid) => {
              const sub = subjectMap.get(sid);
              return sub ? [sub] : [];
            });

            return (
            <Card
              key={prof.id}
              padding="compact"
              tint={prof.color}
              interactive
              className="content-auto flex flex-col gap-2.5 group"
            >
              {/* Cabecera: nombre del docente protagonista y, debajo, las materias que imparte */}
              <div className="flex items-start gap-3">
                <ProfessorAvatar
                  name={prof.name}
                  icon={prof.icon}
                  color={prof.color}
                  size="contact"
                  shape="circle"
                  className="shrink-0 ring-1 ring-white/60 dark:ring-white/10 shadow-2xs"
                />

                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-extrabold text-[var(--color-md-on-surface)] leading-tight break-words group-hover:text-[var(--color-md-primary)] transition-colors duration-150">
                    {/* Toda la tarjeta abre la ficha de contacto */}
                    <button type="button" onClick={() => detail.open(prof.id)} className={STRETCHED_CARD_BUTTON_CLASS}>
                      {prof.name}
                      <span className="sr-only"> · ver ficha</span>
                    </button>
                  </h3>

                  {/* Materias como subtítulo limpio (hasta 2 líneas completas, sin cápsula que corte) */}
                  {assignedSubjects.length > 0 && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--color-md-on-surface-variant)]">
                      <span className="sr-only">Materias que imparte: </span>
                      {assignedSubjects.map((sub) => sub.name).join(' · ')}
                    </p>
                  )}
                </div>

                {/* Acciones secundarias y de gestión agrupadas en el menú ⋮ */}
                <M3KebabMenu
                  size="md"
                  className={ABOVE_STRETCHED_CLASS}
                  items={[
                    ...(hasPhone
                      ? [
                          {
                            id: 'contact',
                            label: 'Contacto (llamar, WhatsApp…)',
                            icon: <Phone className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                            onClick: () => setContactProf(prof),
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

              {/* Cuerpo: cubículo y asesorías en renglones legibles (sin truncar a la mitad) */}
              {(prof.office || prof.notes) && (
                <ul className="space-y-1.5 text-xs text-[var(--color-md-on-surface)]">
                  {prof.office && (
                    <li className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                      <span className="min-w-0 break-words">
                        <span className="sr-only">Cubículo: </span>
                        {prof.office}
                      </span>
                    </li>
                  )}
                  {prof.notes && (
                    <li className="flex items-start gap-2">
                      <CalendarCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                      <span className="min-w-0 break-words whitespace-pre-line line-clamp-3 text-[var(--color-md-on-surface-variant)]">
                        <span className="sr-only">Asesorías: </span>
                        {prof.notes}
                      </span>
                    </li>
                  )}
                </ul>
              )}

              {/* Pie anclado abajo: una única acción de contacto en la zona del pulgar */}
              {(hasEmail || hasPhone) && (
                <div className="mt-auto flex items-center justify-end gap-3 pt-2.5 border-t border-[var(--color-md-outline-variant)]">
                  {hasPhone && (
                    <button
                      type="button"
                      onClick={() => setContactProf(prof)}
                      className={`relative z-10 inline-flex items-center gap-1.5 h-10 px-4 shrink-0 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 ease-out active:scale-[0.98] ${
                        hasEmail
                          ? 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] hover:bg-[var(--color-md-surface-container-high)]'
                          : 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] hover:bg-[var(--color-md-primary-hover)] shadow-xs'
                      }`}
                      aria-label={`Contactar a ${prof.name}: llamar, WhatsApp, Telegram o guardar`}
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Contacto</span>
                    </button>
                  )}
                  {hasEmail && (
                    <a
                      href={`mailto:${prof.email?.trim()}`}
                      className="relative z-10 inline-flex items-center gap-1.5 h-10 px-4 shrink-0 rounded-full text-xs font-bold whitespace-nowrap bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] hover:bg-[var(--color-md-primary-hover)] shadow-xs transition-all duration-150 ease-out active:scale-[0.98]"
                      aria-label={`Enviar correo a ${prof.name}`}
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Correo</span>
                    </a>
                  )}
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}

      {contactSheet}

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
                      <div className="flex items-center gap-1 text-10px text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>Cubículo: {p.office}</span>
                      </div>
                    )}
                    {p.notes && (
                      <div className="flex items-center gap-1 text-10px text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
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

      {deleteModal}

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
          autoHideOnScroll
          onClick={handleOpenCreate}
          label="Registrar Catedrático"
          icon={<UserPlus className="w-6 h-6 stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
