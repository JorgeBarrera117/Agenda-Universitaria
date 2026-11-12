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
  Import,
  Share2,
} from 'lucide-react';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { useSharedFilePicker } from '../../../shared/hooks/useSharedFilePicker';
import { subjectImportedMessage } from '../../schedule/utils/importMessages';
import {
  AGCLASS_EXTENSION,
  AGCLASS_MIME_TYPE,
  exportSubjectToAgclass,
  parseAgclassContent,
  type SubjectSharePackage,
} from '../services/subjectShareService';
import { ImportSubjectModal } from './ImportSubjectModal';
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
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { useScrollCollapse } from '../../../shared/hooks/useScrollCollapse';
import { Button, Card } from '../../../shared/components/atoms';
import type { Subject, CreateSubjectDTO } from '../types';
import { ABOVE_STRETCHED_CLASS, HEADER_SCRIM_CLASS, STRETCHED_CARD_BUTTON_CLASS } from '../../../shared/styles/surfaces';
import { useDetailSelection, type DetailRequest, type DetailReturn } from '../../../shared/navigation/detailNavigation';
import { SubjectDetailView } from './SubjectDetailView';

interface SubjectsViewProps {
  onNavigateToNotes?: (subjectId?: string) => void;
  onEditorActiveChange?: (isActive: boolean) => void;
  isActive?: boolean;
  /** Petición de App para abrir la ficha de una materia (desde el Horario o una ficha docente). */
  detailRequest?: DetailRequest | null;
  /** Abrir la ficha de un catedrático (pestaña Profesores) recordando cómo volver. */
  onOpenProfessorDetail?: (professorId: string, from?: DetailReturn) => void;
  /** Al cerrar una ficha a la que se llegó desde otra pestaña: volver ahí. */
  onReturnFromDetail?: (to: DetailReturn) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  onNavigateToNotes,
  onEditorActiveChange,
  isActive = true,
  detailRequest,
  onOpenProfessorDetail,
  onReturnFromDetail,
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

  // Ficha de detalle abierta (por id: así refleja al momento lo que se edite)
  const detail = useDetailSelection('subject', detailRequest, onReturnFromDetail);
  const selectedSubject = detail.selectedId ? subjects.find((s) => s.id === detail.selectedId) : undefined;
  const professorOf = (subject: Subject) =>
    professors.find((p) => p.id === subject.professorId || (p.subjectIds || []).includes(subject.id));

  // Formulario o ficha a pantalla completa: App oculta el Navbar y la barra inferior
  const isFullScreen = isModalOpen || selectedSubject !== undefined;
  useEffect(() => {
    onEditorActiveChange?.(isFullScreen);
    return () => {
      onEditorActiveChange?.(false);
    };
  }, [isFullScreen, onEditorActiveChange]);

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
      // Si se eliminó desde su ficha, la ficha ya no tiene qué mostrar: se vuelve al catálogo
      if (subjectToDelete.id === detail.selectedId) detail.dismiss();
      setSubjectToDelete(null);
    }
  };

  // Avisos breves (descarga del .agclass, errores, importación terminada)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const showToast = (text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text }));

  // Compartir la materia con sus clases y su docente como archivo .agclass
  const handleShareAgclass = async (subject: Subject) => {
    try {
      const result = await exportSubjectToAgclass(subject, slots, professors);
      if (result.method === 'download') showToast(`Se descargó «${result.fileName}».`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo compartir la materia.');
    }
  };

  // Importar un .agclass elegido desde el almacenamiento del dispositivo
  const [importPackage, setImportPackage] = useState<SubjectSharePackage | null>(null);
  const agclassPicker = useSharedFilePicker({
    extension: AGCLASS_EXTENSION,
    mimeType: AGCLASS_MIME_TYPE,
    onContent: (content) => setImportPackage(parseAgclassContent(content)),
    onError: showToast,
  });

  // Diálogos y avisos que se usan tanto en el catálogo como en la ficha
  const sharedOverlays = (
    <>
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

      <ContextualToast
        message={toast?.text ?? null}
        bottomOffset={selectedSubject ? 'compact' : 'nav'}
        onClose={() => setToast(null)}
      />
    </>
  );

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

  // Ficha técnica de la asignatura a pantalla completa
  if (selectedSubject) {
    const professor = professorOf(selectedSubject);
    return (
      <>
        <SubjectDetailView
          subject={selectedSubject}
          professor={professor}
          slots={slots.filter((s) => s.subjectId === selectedSubject.id)}
          noteCount={notes.filter((n) => n.subjectId === selectedSubject.id).length}
          docCount={getDocumentCountForSubject(selectedSubject.id)}
          onBack={detail.close}
          onEdit={() => handleOpenEdit(selectedSubject)}
          onDelete={() => setSubjectToDelete(selectedSubject)}
          onShareAgclass={() => void handleShareAgclass(selectedSubject)}
          onNavigateToNotes={(subjectId) => {
            // Se sale de la ficha: en Apuntes vuelve a verse el Navbar
            detail.dismiss();
            onNavigateToNotes?.(subjectId);
          }}
          onNavigateToDocs={(subject) => setSelectedSubjectForDocs(subject)}
          onSelectProfessor={
            onOpenProfessorDetail
              ? (prof) => {
                  const from = detail.returnPoint('subjects');
                  detail.dismiss();
                  onOpenProfessorDetail(prof.id, from);
                }
              : undefined
          }
        />
        {sharedOverlays}
      </>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {/* 1. ENCABEZADO DEL APARTADO (Compacto) */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${HEADER_SCRIM_CLASS}`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-2xl font-black text-[var(--color-md-on-surface)] tracking-tight">
              Plan de Asignaturas
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
              {subjects.length}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-[var(--color-md-on-surface-variant)] font-medium mt-0.5">
            Catálogo curricular que estructura tus horarios, apuntes y docentes.
          </p>
        </div>
        <div
          className={`flex shrink-0 flex-wrap items-center gap-2 origin-right transition-all duration-200 ${
            isScrolled ? 'sm:scale-75 sm:opacity-0 sm:pointer-events-none' : 'scale-100 opacity-100'
          }`}
        >
          <input {...agclassPicker.inputProps} />
          <Button
            variant="secondary"
            size="sm"
            icon={<Import className="w-4 h-4 stroke-[2.3]" />}
            onClick={agclassPicker.open}
            className="active:scale-95 whitespace-nowrap"
          >
            Importar (.agclass)
          </Button>
          {/* En móvil se inscribe con el botón flotante */}
          <div className="hidden sm:block">
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
        <Card padding="relaxed" className="text-center py-12 border-dashed">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] flex items-center justify-center mx-auto mb-2.5">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-md-on-surface)] mb-1">
            No tienes asignaturas registradas
          </h3>
          <p className="text-xs text-[var(--color-md-on-surface-variant)] mb-3 max-w-sm mx-auto">
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
                className="flex flex-col gap-2.5 group"
              >
                {/* Nivel 1 · Identidad: ícono, nombre (protagonista) y código como dato secundario */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-2xs shrink-0 ring-1 ring-white/20"
                    style={{ backgroundColor: subject.color }}
                    aria-hidden="true"
                  >
                    <SubjectIcon icon={subject.icon} className="w-5 h-5 text-white" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-extrabold text-[var(--color-md-on-surface)] group-hover:text-[var(--color-md-primary)] transition-colors duration-150 leading-snug line-clamp-2">
                      {/* Toda la tarjeta abre la ficha técnica */}
                      <button type="button" onClick={() => detail.open(subject.id)} className={STRETCHED_CARD_BUTTON_CLASS}>
                        {subject.name}
                        <span className="sr-only"> · ver ficha</span>
                      </button>
                    </h3>
                    {subject.code && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)] mt-0.5">
                        <span className="sr-only">Código: </span>
                        {subject.code}
                      </span>
                    )}
                  </div>

                  {/* Acciones de gestión agrupadas en el menú ⋮ para dejar una sola acción visible */}
                  <M3KebabMenu
                    className={ABOVE_STRETCHED_CLASS}
                    items={[
                      {
                        id: 'docs',
                        label: `Archivos vinculados (${docCount})`,
                        icon: <FolderOpen className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                        onClick: () => setSelectedSubjectForDocs(subject),
                      },
                      ...(onNavigateToNotes
                        ? [
                            {
                              id: 'notes',
                              label: `Ver apuntes (${noteCount})`,
                              icon: <BookOpen className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                              onClick: () => onNavigateToNotes(subject.id),
                            },
                          ]
                        : []),
                      {
                        id: 'share-agclass',
                        label: 'Compartir (.agclass)',
                        icon: <Share2 className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                        onClick: () => void handleShareAgclass(subject),
                      },
                      {
                        id: 'edit',
                        label: 'Editar asignatura',
                        icon: <Edit2 className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                        onClick: () => handleOpenEdit(subject),
                      },
                      {
                        id: 'delete',
                        label: 'Eliminar asignatura',
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        variant: 'destructive',
                        onClick: () => setSubjectToDelete(subject),
                      },
                    ]}
                  />
                </div>

                {/* Nivel 2 · Docente titular: entidad clara, sin caja que la encierre */}
                {prof && (
                  <div className="flex items-center gap-2 py-0.5 text-xs text-[var(--color-md-on-surface)]">
                    <ProfessorAvatar
                      name={prof.name}
                      icon={prof.icon}
                      color={prof.color}
                      size="select"
                      className="shrink-0"
                    />
                    <span className="font-semibold truncate">
                      <span className="sr-only">Docente: </span>
                      {prof.name}
                    </span>
                  </div>
                )}

                {/* Nivel 3 · Coordenadas académicas: aula y créditos en chips tonales */}
                {(subject.classroomDefault || (subject.credits !== undefined && subject.credits > 0)) && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    {subject.classroomDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-md-surface-container)] text-[var(--color-md-on-surface-variant)] font-medium min-w-0 max-w-full">
                        <MapPin className="w-3.5 h-3.5 text-[var(--color-md-primary)] shrink-0" aria-hidden="true" />
                        <span className="sr-only">Aula: </span>
                        <span className="truncate">{subject.classroomDefault}</span>
                      </span>
                    )}
                    {subject.credits !== undefined && subject.credits > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] font-semibold">
                        <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{subject.credits} cr.</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Nivel 4 · Pie anclado abajo: métricas de solo lectura + acción en la zona del pulgar */}
                <div className="mt-auto pt-2 border-t border-[var(--color-md-outline-variant)] flex items-center justify-between gap-1.5 text-xs">
                  <dl className="flex items-center gap-2.5 text-[10.5px] font-semibold text-[var(--color-md-on-surface-variant)]">
                    <div className="flex items-center gap-0.5" title={`${classCount} clases semanales`}>
                      <dt className="sr-only">Clases semanales</dt>
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      <dd>{classCount}</dd>
                    </div>
                    <div className="flex items-center gap-0.5" title={`${docCount} archivos vinculados`}>
                      <dt className="sr-only">Archivos vinculados</dt>
                      <FolderOpen className="w-3 h-3" aria-hidden="true" />
                      <dd>{docCount}</dd>
                    </div>
                    <div className="flex items-center gap-0.5" title={`${noteCount} apuntes`}>
                      <dt className="sr-only">Apuntes</dt>
                      <FileText className="w-3 h-3" aria-hidden="true" />
                      <dd>{noteCount}</dd>
                    </div>
                  </dl>

                  {onNavigateToNotes ? (
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={() => onNavigateToNotes(subject.id)}
                      aria-label={`Tomar apunte de ${subject.name}`}
                      icon={<BookPlus className="w-3 h-3 stroke-[2.2]" />}
                      className={`${ABOVE_STRETCHED_CLASS} shrink-0 ml-auto text-[11px] py-1 px-3 h-7 whitespace-nowrap`}
                    >
                      Tomar apunte
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => setSelectedSubjectForDocs(subject)}
                      icon={<FolderOpen className="w-3 h-3 stroke-[2.2]" />}
                      className={`${ABOVE_STRETCHED_CLASS} shrink-0 ml-auto text-[11px] py-1 px-3 h-7 whitespace-nowrap`}
                    >
                      Archivos
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {sharedOverlays}

      {/* Vista previa de un .agclass importado a mano */}
      {importPackage && (
        <ImportSubjectModal
          key={`${importPackage.exportedAt}-${importPackage.subject.name}`}
          sharePackage={importPackage}
          onClose={() => setImportPackage(null)}
          onImported={({ subjectName, summary }) => {
            setImportPackage(null);
            showToast(subjectImportedMessage(subjectName, summary));
          }}
        />
      )}

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
