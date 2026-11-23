import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { NotesIntent } from '../../notes/types/notesRequest';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  BookPlus,
  MapPin,
  Award,
  Clock,
  FolderOpen,
  Import,
  Share2,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { SegmentedControl } from '../../../shared/components/form';
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
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { useAutoHideFabs } from '../../../shared/hooks/useAutoHideFabs';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { Button, Card } from '../../../shared/components/atoms';
import type { Subject, CreateSubjectDTO } from '../types';
import { ABOVE_STRETCHED_CLASS, HEADER_SCRIM_CLASS, STRETCHED_CARD_BUTTON_CLASS } from '../../../shared/styles/surfaces';
import { useDetailSelection, type DetailRequest, type DetailReturn } from '../../../shared/navigation/detailNavigation';
import { SubjectDetailView } from './SubjectDetailView';
import { ScheduleSlotForm } from '../../schedule/components/ScheduleSlotForm';
import { DeleteSlotDialog } from '../../schedule/components/DeleteSlotDialog';
import type { ScheduleSlot } from '../../schedule/types';

type CatalogTab = 'active' | 'archived';

interface SubjectsViewProps {
  onNavigateToNotes?: (subjectId?: string, intent?: NotesIntent) => void;
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
  const { slots, addSlots, updateSlot, removeSlot } = useSchedule();
  const [slotToDelete, setSlotToDelete] = useState<ScheduleSlot | null>(null);
  // Formulario de clase abierto desde la ficha: editar una clase o agregar clases a la materia
  const [slotEditor, setSlotEditor] = useState<{ subject: Subject; slot?: ScheduleSlot } | null>(null);
  const { notes } = useNotes();
  const { settings } = useAppSettings();

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
  // Al bajar por la lista, el botón de agregar y el selector Materias | Profesores se apartan
  useAutoHideFabs(isActive && !isFullScreen && !slotEditor);
  useEffect(() => {
    onEditorActiveChange?.(isFullScreen);
    return () => {
      onEditorActiveChange?.(false);
    };
  }, [isFullScreen, onEditorActiveChange]);

  // Materias en curso y las de semestres anteriores (archivadas desde Ajustes → Finalizar semestre)
  const activeSubjects = useMemo(() => subjects.filter((s) => !s.isArchived), [subjects]);
  const archivedSubjects = useMemo(() => subjects.filter((s) => s.isArchived), [subjects]);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('active');
  const visibleSubjects = catalogTab === 'archived' ? archivedSubjects : activeSubjects;

  // Estadísticas del semestre en curso memoizadas para rendimiento
  const totalCredits = useMemo(
    () => activeSubjects.reduce((sum, s) => sum + (s.credits || 0), 0),
    [activeSubjects]
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

  // Deshacer un archivado: la materia vuelve a "en curso" (conserva el semestre en que se cursó)
  const handleUnarchive = async (subject: Subject) => {
    await updateSubject(subject.id, { isArchived: false });
    showToast(`«${subject.name}» volvió a tus materias en curso.`);
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

  // Compartir el plan completo (materias, clases y docentes) como .agschedule, igual que el Horario
  const handleSharePlan = async () => {
    if (subjects.length === 0) {
      showToast('Aún no tienes materias para compartir.');
      return;
    }
    try {
      const { exportScheduleToAgschedule } = await import('../../schedule/services/scheduleShareService');
      const result = await exportScheduleToAgschedule(settings.semesterName, subjects, slots, professors);
      if (result.method === 'download') showToast(`Se descargó «${result.fileName}».`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo compartir el plan.');
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

  // Quitar una clase del horario desde la ficha (menú ⋮ de la clase o «Editar clase»)
  const deleteSlotDialog = (
    <DeleteSlotDialog
      slot={slotToDelete}
      subjectName={slotToDelete ? subjects.find((s) => s.id === slotToDelete.subjectId)?.name : undefined}
      onCancel={() => setSlotToDelete(null)}
      onConfirm={async (slot) => {
        await removeSlot(slot.id);
        setSlotToDelete(null);
        if (slotEditor?.slot?.id === slot.id) setSlotEditor(null);
        showToast('Clase eliminada del horario.');
      }}
    />
  );

  // Diálogos y avisos que se usan tanto en el catálogo como en la ficha
  const sharedOverlays = (
    <>
      {deleteSlotDialog}
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
          <ModalActions>
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
          </ModalActions>
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

  // Clase de la materia (desde la ficha): al guardar o volver, se regresa a la ficha
  if (slotEditor) {
    const { subject, slot } = slotEditor;
    return (
      <div className="w-full pb-8">
        <ErrorBoundary fallbackTitle="Error al abrir el formulario de cátedra" onReset={() => setSlotEditor(null)}>
          <ScheduleSlotForm
            key={slot?.id || `new-slot-${subject.id}`}
            initialData={slot}
            preset={{
              subjectId: subject.id,
              professorId: professorOf(subject)?.id,
              classroomDefault: subject.classroomDefault,
            }}
            onSubmit={async (dtos) => {
              if (slot) {
                await updateSlot(slot.id, dtos[0]);
                showToast('Clase actualizada.');
              } else {
                await addSlots(dtos);
                showToast(dtos.length === 1 ? 'Clase agregada al horario.' : `Se agregaron ${dtos.length} clases al horario.`);
              }
              setSlotEditor(null);
            }}
            onCancel={() => setSlotEditor(null)}
            backLabel="Volver a la ficha de la materia"
            onDelete={slot ? () => setSlotToDelete(slot) : undefined}
          />
        </ErrorBoundary>
        {deleteSlotDialog}
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
            onNavigateToNotes?.(subjectId, 'browse');
          }}
          onNavigateToDocs={(subject) => setSelectedSubjectForDocs(subject)}
          onEditSlot={(slot) => setSlotEditor({ subject: selectedSubject, slot })}
          onAddSlot={() => setSlotEditor({ subject: selectedSubject })}
          onDeleteSlot={(slot) => setSlotToDelete(slot)}
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
    <div className="glass-legible space-y-3 sm:space-y-3.5">
      {/* 1. ENCABEZADO DEL APARTADO (Compacto) */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${HEADER_SCRIM_CLASS}`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-2xl font-black text-[var(--color-md-on-surface)] tracking-tight">
              Plan de Asignaturas
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
              {activeSubjects.length}
            </span>
          </div>
          <p className="text-11px sm:text-xs text-[var(--color-md-on-surface-variant)] font-medium mt-0.5">
            Catálogo curricular que estructura tus horarios, apuntes y docentes.
          </p>
        </div>
        <div
          className={`flex shrink-0 flex-wrap items-center gap-2 origin-right transition-all duration-200 scale-100 opacity-100 scrolled:sm:scale-75 scrolled:sm:opacity-0 scrolled:sm:pointer-events-none`}
        >
          <input {...agclassPicker.inputProps} />
          {/* Intercambio: importar una materia y compartir el plan completo, ambos tonales */}
          <Button
            variant="secondary"
            size="sm"
            icon={<Import className="w-4 h-4 stroke-[2.3]" />}
            onClick={agclassPicker.open}
            className="active:scale-95 whitespace-nowrap"
          >
            Importar (.agclass)
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Share2 className="w-4 h-4 stroke-[2.3]" />}
            onClick={() => void handleSharePlan()}
            aria-label="Compartir el plan de asignaturas (.agschedule)"
            className="!border !border-[var(--color-md-outline)] active:scale-95 whitespace-nowrap"
          >
            Compartir plan
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

      {/* 2. RESUMEN MÉTRICO COMPACTO (Jerarquía Nivel 2). En PC no se estira: tres fichas de 240 px */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5 lg:max-w-3xl">
        {/* Métricas: en el teléfono, ícono arriba y número con su etiqueta completa debajo */}
        <div className="md-card p-2 sm:p-2.5 rounded-2xl bg-[var(--md-card-surface)] border border-[var(--color-md-outline-variant)] shadow-2xs flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 text-large:flex-col text-large:items-start">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-black text-[var(--color-md-on-surface)] leading-tight">
              {activeSubjects.length}
            </div>
            <div className="text-10px sm:text-11px font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
              Materias
            </div>
          </div>
        </div>
        <div className="md-card p-2 sm:p-2.5 rounded-2xl bg-[var(--md-card-surface)] border border-[var(--color-md-outline-variant)] shadow-2xs flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 text-large:flex-col text-large:items-start">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-black text-[var(--color-md-on-surface)] leading-tight">
              {totalCredits}
            </div>
            <div className="text-10px sm:text-11px font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
              Créditos
            </div>
          </div>
        </div>
        <div className="md-card p-2 sm:p-2.5 rounded-2xl bg-[var(--md-card-surface)] border border-[var(--color-md-outline-variant)] shadow-2xs flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 text-large:flex-col text-large:items-start">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-black text-[var(--color-md-on-surface)] leading-tight">
              {totalSlotsCount}
            </div>
            <div className="text-10px sm:text-11px font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
              Bloques
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas: materias en curso / historial de semestres anteriores */}
      {subjects.length > 0 && (
        <SegmentedControl
          value={catalogTab}
          onChange={setCatalogTab}
          ariaLabel="Mostrar materias"
          className="md:max-w-lg"
          options={[
            {
              value: 'active',
              label: `Materias en curso (${activeSubjects.length})`,
              shortLabel: `En curso (${activeSubjects.length})`,
              icon: <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />,
            },
            {
              value: 'archived',
              label: `Historial archivado (${archivedSubjects.length})`,
              shortLabel: `Historial (${archivedSubjects.length})`,
              icon: <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />,
            },
          ]}
        />
      )}

      {/* 3. CATÁLOGO DE ASIGNATURAS */}
      {subjects.length > 0 && visibleSubjects.length === 0 ? (
        <Card padding="relaxed" className="text-center py-10 border-dashed">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] flex items-center justify-center mx-auto mb-2.5">
            {catalogTab === 'archived' ? <Archive className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
          </div>
          <h3 className="text-sm font-bold text-[var(--color-md-on-surface)] mb-1">
            {catalogTab === 'archived' ? 'Aún no hay materias archivadas' : 'No tienes materias en curso'}
          </h3>
          <p className="text-xs text-[var(--color-md-on-surface-variant)] max-w-sm mx-auto">
            {catalogTab === 'archived'
              ? 'Cuando finalices un semestre desde Ajustes, sus materias aparecerán aquí con todos sus apuntes y archivos.'
              : 'Inscribe las materias de este semestre. Las anteriores siguen en el historial con sus apuntes.'}
          </p>
          {catalogTab === 'active' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={handleOpenCreate}
              className="shadow-xs mt-3"
            >
              Inscribir asignatura
            </Button>
          )}
        </Card>
      ) : subjects.length === 0 ? (
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
        // pb-28 en el teléfono: el último «Tomar apunte» queda libre de los botones flotantes
        <div className="grid grid-cols-1 gap-2.5 pb-28 sm:grid-cols-2 sm:gap-3 md:pb-0 lg:grid-cols-3 xl:grid-cols-4">
          {visibleSubjects.map((subject) => {
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
                tint={subject.color}
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
                    {(subject.code || subject.isArchived) && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {/* Código como texto (no parece botón) */}
                        {subject.code && (
                          <span className="font-mono text-11px font-medium text-[var(--color-md-on-surface-variant)]">
                            <span className="sr-only">Código: </span>
                            {subject.code}
                          </span>
                        )}
                        {subject.isArchived && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-10px font-semibold bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]">
                            <Archive className="h-3 w-3 shrink-0" aria-hidden="true" />
                            Archivada{subject.semester ? ` · ${subject.semester}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Acciones de gestión agrupadas en el menú ⋮ para dejar una sola acción visible */}
                  <M3KebabMenu
                    size="md"
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
                              onClick: () => onNavigateToNotes(subject.id, 'browse'),
                            },
                          ]
                        : []),
                      ...(subject.isArchived
                        ? [
                            {
                              id: 'unarchive',
                              label: 'Mover a en curso',
                              icon: <ArchiveRestore className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />,
                              onClick: () => void handleUnarchive(subject),
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

                {/* Nivel 3 · Aula y créditos: texto secundario con íconos sutiles (son datos, no botones) */}
                {(subject.classroomDefault || (subject.credits !== undefined && subject.credits > 0)) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-md-on-surface-variant)]">
                    {subject.classroomDefault && (
                      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                        <span className="sr-only">Aula: </span>
                        <span className="truncate">{subject.classroomDefault}</span>
                      </span>
                    )}
                    {subject.credits !== undefined && subject.credits > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                        {subject.credits} {subject.credits === 1 ? 'crédito' : 'créditos'}
                      </span>
                    )}
                  </div>
                )}

                {/* Nivel 4 · Pie anclado abajo: métricas de solo lectura + acción en la zona del pulgar */}
                <div className="mt-auto pt-2 border-t border-[var(--color-md-outline-variant)] flex items-center justify-between gap-1.5 text-xs">
                  {/* Contadores con su nombre: «2 bloques · 0 archivos · 1 apunte» */}
                  <p className="min-w-0 text-11px font-medium leading-snug text-[var(--color-md-on-surface-variant)]">
                    {classCount} {classCount === 1 ? 'bloque' : 'bloques'} · {docCount} {docCount === 1 ? 'archivo' : 'archivos'} ·{' '}
                    {noteCount} {noteCount === 1 ? 'apunte' : 'apuntes'}
                  </p>

                  {onNavigateToNotes ? (
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={() => onNavigateToNotes(subject.id, 'compose')}
                      aria-label={`Tomar apunte de ${subject.name}`}
                      icon={<BookPlus className="h-4 w-4 stroke-[2.2]" />}
                      className={`${ABOVE_STRETCHED_CLASS} ml-auto min-h-10 shrink-0 whitespace-nowrap`}
                    >
                      Tomar apunte
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => setSelectedSubjectForDocs(subject)}
                      icon={<FolderOpen className="h-4 w-4 stroke-[2.2]" />}
                      className={`${ABOVE_STRETCHED_CLASS} ml-auto min-h-10 shrink-0 whitespace-nowrap`}
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
          autoHideOnScroll
          onClick={handleOpenCreate}
          label="Inscribir Asignatura"
          icon={<BookPlus className="w-6 h-6 stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
