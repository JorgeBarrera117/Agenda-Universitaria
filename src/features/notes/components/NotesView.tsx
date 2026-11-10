import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText,
  BookOpen,
  Camera,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  X,
  Copy,
  Info,
} from 'lucide-react';
import { useNotes } from '../hooks/useNotes';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import { useNoteImages } from '../hooks/useNoteImages';
import { NoteEditor } from './NoteEditor';
import { Modal } from '../../../shared/components/Modal';
import { M3Select } from '../../../shared/components/M3Select';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { ImageZoomModal } from '../../../shared/components/ImageZoomModal';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { db } from '../../../shared/db/AppDatabase';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card } from '../../../shared/components/atoms';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import { useExitTransition, MOTION_EXIT_MS } from '../../../shared/hooks/useExitTransition';
import { useScrollCollapse } from '../../../shared/hooks/useScrollCollapse';
import { sanitizeNoteHtml } from '../../../shared/utils/sanitizeHtml';
import type { Note, CreateNoteDTO, NoteImage } from '../types';
import { HEADER_SCRIM_CLASS } from '../../../shared/styles/surfaces';

interface NotesViewProps {
  initialSubjectFilterId?: string;
  onEditorActiveChange?: (isActive: boolean) => void;
  isActive?: boolean;
}

/** Fecha legible: "Hoy, 10:42", "Ayer, 18:05", "lun 3 nov, 09:15" o "3 nov 2025". */
function formatNoteDate(iso: string, today: Date): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000);
  if (daysAgo === 0) return `Hoy, ${time}`;
  if (daysAgo === 1) return `Ayer, ${time}`;
  if (date.getFullYear() === today.getFullYear()) {
    return `${date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
  }
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const NotesView: React.FC<NotesViewProps> = ({
  initialSubjectFilterId,
  onEditorActiveChange,
  isActive = true,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectFilterId || 'all'
  );
  const [prevInitialFilterId, setPrevInitialFilterId] = useState(initialSubjectFilterId);

  // Sincronizar filtro si cambia la materia entrante sin disparar useEffect cascada
  if (initialSubjectFilterId !== prevInitialFilterId) {
    setPrevInitialFilterId(initialSubjectFilterId);
    setSelectedSubjectId(initialSubjectFilterId || 'all');
  }

  const [searchQuery, setSearchQuery] = useState('');

  // Modo de visualización de galería: cuadrícula 2 columnas o lista
  const [galleryLayout, setGalleryLayout] = useState<'grid' | 'list'>('grid');

  // Ordenamiento de documentos
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'title'>('updatedAt');

  const { notes, addNote, updateNote, removeNote } = useNotes(
    selectedSubjectId,
    searchQuery
  );
  const { subjects, getSubjectById } = useSubjects();
  const isScrolled = useScrollCollapse(48);

  // Mapa de materias memoizado para búsqueda O(1) de asignaturas
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  // Optimización de Memoria: Conteo de fotos por apunte mediante claves de índice Dexie
  const imageCounts = useLiveQuery(async () => {
    try {
      const noteIds = (await db.noteImages.orderBy('noteId').keys()) as string[];
      const counts: Record<string, number> = {};
      for (const id of noteIds) {
        counts[id] = (counts[id] || 0) + 1;
      }
      return counts;
    } catch (err) {
      console.warn('Error al consultar conteo de imágenes:', err);
      return {};
    }
  }, []);

  // Vistas a pantalla completa: 'list' (galería), 'editor' (crear/editar), 'reader' (lectura)
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'reader'>('list');
  const [editingNote, setEditingNote] = useState<Note | undefined>(undefined);
  const [readingNote, setReadingNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [zoomedImage, setZoomedImage] = useState<NoteImage | null>(null);
  const [zoomedInlineImage, setZoomedInlineImage] = useState<{ src: string; alt?: string } | null>(null);
  const [imageToDelete, setImageToDelete] = useState<NoteImage | null>(null);

  // Hook para las imágenes de la nota que se está leyendo
  const {
    images: readingNoteImages,
    addImage: addImageToReadingNote,
    removeImage: removeImageFromReadingNote,
  } = useNoteImages(readingNote?.id);

  const readingNoteHtml = useMemo(
    () => (readingNote ? sanitizeNoteHtml(readingNote.content) : ''),
    [readingNote]
  );

  const [isUploadingInReader, setIsUploadingInReader] = useState(false);
  // Referencia fija del "hoy" para fechas relativas del lector ("Hoy", "Ayer")
  const [today] = useState(() => new Date());
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [readerToast, setReaderToast] = useState<string | null>(null);

  const readerCameraInputRef = useRef<HTMLInputElement>(null);
  const readerGalleryInputRef = useRef<HTMLInputElement>(null);

  const showReaderToast = (msg: string) => {
    setReaderToast(msg);
    setTimeout(() => setReaderToast(null), 3000);
  };

  // Notificar al layout principal si estamos en modo editor o lector para maximizar pantalla
  useEffect(() => {
    onEditorActiveChange?.(viewMode === 'editor' || viewMode === 'reader');
    return () => {
      onEditorActiveChange?.(false);
    };
  }, [viewMode, onEditorActiveChange]);

  // Salida animada del lector al volver al catálogo
  const readerExit = useExitTransition(MOTION_EXIT_MS.sheet);
  const closeReader = () =>
    readerExit.runExit(() => {
      setViewMode('list');
      setReadingNote(null);
      setEditingNote(undefined);
    });

  // Interceptar botón "Atrás" de Android
  useBackButton(() => {
    if (viewMode === 'editor') {
      if (readingNote) {
        setViewMode('reader');
        setEditingNote(undefined);
      } else {
        setViewMode('list');
        setEditingNote(undefined);
      }
      return true;
    }
    if (viewMode === 'reader') {
      closeReader();
      return true;
    }
    return false;
  }, BACK_PRIORITY.SUBVIEW, isActive && viewMode !== 'list');

  const handleOpenCreate = () => {
    setEditingNote(undefined);
    setViewMode('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEdit = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingNote(note);
    setViewMode('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenRead = (note: Note) => {
    setReadingNote(note);
    setViewMode('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    if (viewMode === 'editor' && readingNote) {
      setViewMode('reader');
      setEditingNote(undefined);
    } else {
      setViewMode('list');
      setEditingNote(undefined);
      setReadingNote(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (dto: CreateNoteDTO) => {
    if (editingNote) {
      await updateNote(editingNote.id, dto);
      if (readingNote?.id === editingNote.id) {
        setReadingNote({
          ...editingNote,
          ...dto,
          updatedAt: new Date().toISOString(),
        });
        setViewMode('reader');
        setEditingNote(undefined);
        return;
      }
    } else {
      await addNote(dto);
    }

    setViewMode('list');
    setEditingNote(undefined);
  };

  const handleReaderFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !readingNote) return;

    try {
      setIsUploadingInReader(true);
      for (let i = 0; i < files.length; i++) {
        await addImageToReadingNote(files[i]);
      }
    } catch (err: unknown) {
      showReaderToast(err instanceof Error ? err.message : 'Error al adjuntar imagen.');
    } finally {
      setIsUploadingInReader(false);
      if (e.target) e.target.value = '';
    }
  };

  const confirmDelete = async () => {
    if (noteToDelete) {
      await removeNote(noteToDelete.id);
      if (readingNote?.id === noteToDelete.id) {
        setReadingNote(null);
        setViewMode('list');
      }
      setNoteToDelete(null);
    }
  };

  // Helper para purgar markdown, KaTeX y HTML de los fragmentos de vista previa
  const cleanSnippetPreview = (rawContent: string): string => {
    if (!rawContent) return '';
    const truncated = rawContent.length > 1000 ? rawContent.slice(0, 1000) : rawContent;
    const cleaned = truncated
      .replace(/<img[^>]*>/gi, ' [Imagen] ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' [Fórmula] ')
      .replace(/\$([^$]+)\$/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/^>\s+/gm, '')
      .replace(/^[*+-]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/```[\s\S]*?```/g, ' [Código] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || 'Documento sin contenido escrito aún.';
  };

  // Pre-calcular y memoizar los extractos limpios de cada nota
  const snippetsById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const note of notes) {
      map[note.id] = cleanSnippetPreview(note.content);
    }
    return map;
  }, [notes]);

  // Ordenar notas según criterio
  const sortedNotes = useMemo(() => {
    const list = [...notes];
    if (sortBy === 'title') {
      return list.sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
    }
    if (sortBy === 'createdAt') {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [notes, sortBy]);

  // Copiar contenido del apunte al portapapeles
  const handleCopyText = async () => {
    if (!readingNote) return;
    try {
      const clean = cleanSnippetPreview(readingNote.content);
      const textToCopy = `${readingNote.title}\n\n${clean}`;
      await navigator.clipboard.writeText(textToCopy);
      showReaderToast('Contenido copiado al portapapeles');
    } catch (e) {
      console.warn('Error al copiar al portapapeles:', e);
    }
  };

  // Estadísticas del documento
  const getNoteStats = (note: Note) => {
    const text = cleanSnippetPreview(note.content);
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    return { words, chars };
  };

  // 1. Vista de Edición a Pantalla Completa
  if (viewMode === 'editor') {
    return (
      <NoteEditor
        initialData={editingNote}
        onSubmit={handleSubmit}
        onCancel={handleBackToList}
      />
    );
  }

  // 2. Vista de lectura a pantalla completa: folio editorial continuo
  if (viewMode === 'reader' && readingNote) {
    const readingSubject = subjectMap.get(readingNote.subjectId) || getSubjectById(readingNote.subjectId);
    const stats = getNoteStats(readingNote);
    const wasEdited = readingNote.updatedAt !== readingNote.createdAt;

    return (
      <div className={`relative flex min-h-[100dvh] w-full flex-col pb-16 ${readerExit.isClosing ? 'm3-sheet-exit' : 'm3-sheet-enter'}`}>
        {/* Barra superior: volver · título y materia · menú de acciones */}
        <header className="sticky top-0 z-40 flex items-center gap-2.5 border-b border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface)]/95 px-3 py-2 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={closeReader}
            aria-label="Volver a los apuntes"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold leading-tight text-[var(--color-md-on-surface)]">
              {readingNote.title || 'Documento sin título'}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-medium text-[var(--color-md-on-surface-variant)]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: readingSubject?.color }}
                aria-hidden="true"
              />
              <span className="truncate">{readingSubject?.name || 'Sin materia'}</span>
            </p>
          </div>

          <M3KebabMenu
            size="md"
            ariaLabel="Opciones del apunte"
            items={[
              {
                id: 'edit',
                label: 'Editar apunte',
                icon: <Edit2 className="h-4 w-4 text-[var(--color-md-primary)]" />,
                onClick: () => handleOpenEdit(readingNote),
              },
              {
                id: 'camera',
                label: 'Foto de cátedra',
                icon: <Camera className="h-4 w-4 text-[var(--color-md-primary)]" />,
                onClick: () => readerCameraInputRef.current?.click(),
                disabled: isUploadingInReader,
              },
              {
                id: 'gallery',
                label: 'Subir de galería',
                icon: <ImageIcon className="h-4 w-4 text-[var(--color-md-primary)]" />,
                onClick: () => readerGalleryInputRef.current?.click(),
                disabled: isUploadingInReader,
              },
              {
                id: 'copy',
                label: 'Copiar texto',
                icon: <Copy className="h-4 w-4 text-[var(--color-md-primary)]" />,
                onClick: () => void handleCopyText(),
              },
              {
                id: 'details',
                label: 'Detalles',
                icon: <Info className="h-4 w-4 text-[var(--color-md-primary)]" />,
                onClick: () => setIsDetailsModalOpen(true),
              },
              {
                id: 'delete',
                label: 'Eliminar apunte',
                icon: <Trash2 className="h-4 w-4" />,
                variant: 'destructive',
                onClick: () => setNoteToDelete(readingNote),
              },
            ]}
          />
        </header>

        <input
          ref={readerCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleReaderFiles}
          className="hidden"
        />
        <input
          ref={readerGalleryInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleReaderFiles}
          className="hidden"
        />

        <div className="w-full px-3 py-3 sm:px-6 sm:py-6">
          <article className="md-card mx-auto w-full max-w-3xl space-y-5 rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-5 text-[var(--color-md-on-surface)] shadow-xs sm:p-8">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-md-surface-container)] py-0.5 pl-0.5 pr-2.5 font-semibold text-[var(--color-md-on-surface)]">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: readingSubject?.color }}
                  >
                    <SubjectIcon icon={readingSubject?.icon} className="h-3 w-3 text-white" />
                  </span>
                  <span className="truncate">{readingSubject?.name || 'Sin materia'}</span>
                  {readingSubject?.code && (
                    <span className="font-mono text-[10px] text-[var(--color-md-on-surface-variant)]">
                      {readingSubject.code}
                    </span>
                  )}
                </span>
                <time dateTime={readingNote.createdAt} className="font-medium text-[var(--color-md-on-surface-variant)]">
                  {formatNoteDate(readingNote.createdAt, today)}
                  {wasEdited ? ` · editado ${formatNoteDate(readingNote.updatedAt, today).toLowerCase()}` : ''}
                </time>
              </div>

              <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                {readingNote.title || 'Documento sin título'}
              </h1>

              {readingNote.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
                  {readingNote.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-full bg-[var(--color-md-secondary-container)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-md-on-secondary-container)]"
                    >
                      #{t}
                    </li>
                  ))}
                </ul>
              )}
            </header>

            <div className="h-px bg-[var(--color-md-outline-variant)]" />

            <div
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target && target.tagName === 'IMG') {
                  const img = target as HTMLImageElement;
                  setZoomedInlineImage({ src: img.src, alt: img.alt || 'Foto del apunte' });
                }
              }}
              className="note-content select-text text-[15px] leading-relaxed sm:text-base [&_img]:cursor-zoom-in"
              dangerouslySetInnerHTML={{ __html: readingNoteHtml }}
            />

            {isUploadingInReader && (
              <p role="status" className="flex items-center gap-2 text-xs font-semibold text-[var(--color-md-on-surface-variant)]">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--color-md-primary)]" aria-hidden="true" />
                Adjuntando fotografías…
              </p>
            )}

            {/* Fotos del pizarrón: solo aparecen si existen; para añadir la primera, menú ⋮ */}
            {readingNoteImages.length > 0 && (
              <section className="space-y-3 border-t border-[var(--color-md-outline-variant)] pt-5" aria-label="Fotos del pizarrón">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">
                    Fotos del pizarrón
                    <span className="ml-1.5 font-medium text-[var(--color-md-on-surface-variant)]">
                      {readingNoteImages.length}
                    </span>
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isUploadingInReader}
                      onClick={() => readerCameraInputRef.current?.click()}
                      aria-label="Tomar otra foto"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-md-primary)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-95 disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={isUploadingInReader}
                      onClick={() => readerGalleryInputRef.current?.click()}
                      aria-label="Añadir desde la galería"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-md-primary)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-95 disabled:opacity-50"
                    >
                      <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {readingNoteImages.map((img) => (
                    <ThumbnailCard
                      key={img.id}
                      image={img}
                      onZoom={() => setZoomedImage(img)}
                      onDelete={() => setImageToDelete(img)}
                    />
                  ))}
                </div>
              </section>
            )}
          </article>
        </div>

        <ContextualToast message={readerToast} bottomOffset="compact" onClose={() => setReaderToast(null)} />

        <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Detalles del apunte" maxWidth="sm">
          <dl className="divide-y divide-[var(--color-md-outline-variant)] text-sm">
            {[
              ['Palabras', String(stats.words)],
              ['Caracteres', String(stats.chars)],
              ['Fotos del pizarrón', String(readingNoteImages.length)],
              ['Creado', new Date(readingNote.createdAt).toLocaleString('es-ES')],
              ['Última edición', new Date(readingNote.updatedAt).toLocaleString('es-ES')],
            ].map(([term, value]) => (
              <div key={term} className="flex justify-between gap-4 py-2">
                <dt className="text-[var(--color-md-on-surface-variant)]">{term}</dt>
                <dd className="text-right font-semibold text-[var(--color-md-on-surface)]">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-end pt-3">
            <Button variant="secondary" size="sm" onClick={() => setIsDetailsModalOpen(false)}>
              Cerrar
            </Button>
          </div>
        </Modal>

        <Modal isOpen={noteToDelete !== null} onClose={() => setNoteToDelete(null)} title="¿Eliminar apunte?" maxWidth="sm">
          <p className="text-sm text-[var(--color-md-on-surface-variant)]">
            Se eliminará <strong className="text-[var(--color-md-on-surface)]">{noteToDelete?.title}</strong> junto con sus fotos.
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setNoteToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              Eliminar
            </Button>
          </div>
        </Modal>

        <Modal isOpen={imageToDelete !== null} onClose={() => setImageToDelete(null)} title="¿Eliminar fotografía?" maxWidth="sm">
          <p className="text-sm text-[var(--color-md-on-surface-variant)]">
            Se quitará esta foto del pizarrón del apunte. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setImageToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (imageToDelete) {
                  await removeImageFromReadingNote(imageToDelete.id);
                  setImageToDelete(null);
                }
              }}
            >
              Eliminar
            </Button>
          </div>
        </Modal>

        {zoomedImage && <LightboxModal image={zoomedImage} onClose={() => setZoomedImage(null)} />}

        {zoomedInlineImage && (
          <ImageZoomModal src={zoomedInlineImage.src} alt={zoomedInlineImage.alt} onClose={() => setZoomedInlineImage(null)} />
        )}
      </div>
    );
  }

  // 3. Vista de Galería de Documentos (M3 High Density)
  return (
    <div className="space-y-3.5 w-full m3-view-enter">
      {/* 1. Encabezado del Apartado (Jerarquía Nivel 1 Compacta) */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${HEADER_SCRIM_CLASS}`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-black text-[var(--color-md-on-surface)] tracking-tight">
              Cuaderno de Apuntes
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
              {notes.length}
            </span>
          </div>
          <p className="text-xs text-[var(--color-md-on-surface-variant)] font-medium mt-0.5">
            Notas de cátedra, fotos de pizarrón y fórmulas por asignatura.
          </p>
        </div>
        <div
          className={`hidden sm:block shrink-0 transition-all duration-300 ease-out origin-right ${
            isScrolled ? 'scale-75 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
          }`}
        >
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4 stroke-[2.3]" />}
            onClick={handleOpenCreate}
            className="shadow-sm hover:shadow ring-1 ring-[#00639B]/25 dark:ring-[#96CCFF]/35 active:scale-95 whitespace-nowrap"
          >
            Nuevo Apunte
          </Button>
        </div>
      </div>

      {/* 2. Barra de Búsqueda Compacta (M3 Search Bar) */}
      <div className="relative">
        <div className="flex items-center bg-[#E2E7EF] dark:bg-[#272A2F] border border-transparent focus-within:border-[#00639B] dark:focus-within:border-[#92CCFF] focus-within:ring-2 focus-within:ring-[#00639B]/20 rounded-full h-10 sm:h-11 px-3.5 sm:px-4 shadow-2xs transition-all">
          <Search className="w-4 h-4 text-[#43474E] dark:text-[#C3C7D0] mr-2.5 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar documentos, fórmulas, pizarras o #etiquetas..."
            className="w-full bg-transparent text-xs sm:text-sm text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#43474E] dark:placeholder:text-[#8C9199] outline-none font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-full text-[#43474E] hover:text-[#191C20] dark:text-[#C3C7D0] dark:hover:text-[#E2E2E6] hover:bg-[#1D2024]/10 dark:hover:bg-[#E2E2E6]/10 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Píldoras de Materias Compactas */}
      <div className="flex items-center sm:flex-wrap gap-1.5 overflow-x-auto sm:overflow-visible py-0.5 px-0.5 scrollbar-none select-none">
        <button
          type="button"
          onClick={() => setSelectedSubjectId('all')}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 ${
            selectedSubjectId === 'all'
              ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] shadow-2xs border border-[#004B76]/30 dark:border-[#D0E4FF]/30'
              : 'bg-[#F1F4FA] dark:bg-[#1D2024] text-[#43474E] dark:text-[#C3C7D0] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F]'
          }`}
        >
          <BookOpen className="w-3 h-3 shrink-0" />
          <span>Todos ({notes.length})</span>
        </button>

        {subjects.map((sub) => {
          const isSelected = selectedSubjectId === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSelectedSubjectId(sub.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 ${
                isSelected
                  ? 'text-white shadow-2xs ring-1 ring-white/30'
                  : 'bg-[#F1F4FA] dark:bg-[#1D2024] text-[#191C20] dark:text-[#E2E2E6] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F]'
              }`}
              style={{
                backgroundColor: isSelected ? sub.color : undefined,
              }}
            >
              <div
                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'bg-white/25 text-white' : 'text-white shadow-2xs'
                }`}
                style={{
                  backgroundColor: isSelected ? undefined : sub.color,
                }}
              >
                <SubjectIcon icon={sub.icon} className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="truncate max-w-[160px] sm:max-w-none">{sub.name}</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Ordenamiento y Alternador de Vista (Cuadrícula / Lista) */}
      <div className="flex items-center justify-between px-0.5 text-xs text-slate-500 dark:text-slate-400">
        <M3Select<'updatedAt' | 'createdAt' | 'title'>
          variant="pill"
          menuAlign="left"
          value={sortBy}
          onChange={setSortBy}
          leadingIcon={<ArrowUpDown className="w-3.5 h-3.5" />}
          options={[
            { value: 'updatedAt', label: 'Modificación' },
            { value: 'createdAt', label: 'Fecha' },
            { value: 'title', label: 'Alfabético (A-Z)' },
          ]}
        />

        {/* Alternador Cuadrícula / Lista */}
        <div className="flex items-center bg-slate-100 dark:bg-[#272A2F] p-0.5 rounded-xl border border-slate-200/80 dark:border-white/10">
          <button
            type="button"
            onClick={() => setGalleryLayout('list')}
            title="Vista de lista"
            className={`p-1 rounded-lg transition-all cursor-pointer ${
              galleryLayout === 'list'
                ? 'bg-white dark:bg-white/15 text-[#00639B] dark:text-[#92CCFF] shadow-2xs'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setGalleryLayout('grid')}
            title="Vista de cuadrícula"
            className={`p-1 rounded-lg transition-all cursor-pointer ${
              galleryLayout === 'grid'
                ? 'bg-white dark:bg-white/15 text-[#00639B] dark:text-[#92CCFF] shadow-2xs'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cuadrícula o Lista de Apuntes */}
      {sortedNotes.length === 0 ? (
        <Card padding="relaxed" className="text-center py-10 border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-[#00639B]/15 text-[#00639B] dark:text-[#92CCFF] flex items-center justify-center mx-auto mb-2.5">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            {searchQuery ? 'No se encontraron documentos' : 'No hay apuntes registrados'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-sm mx-auto">
            {searchQuery
              ? 'Intenta con otro término de búsqueda o selecciona otra materia.'
              : 'Redacta tu primer documento con formato enriquecido o adjunta fotos del pizarrón.'}
          </p>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={handleOpenCreate}
            className="shadow-sm"
          >
            Crear primer documento
          </Button>
        </Card>
      ) : galleryLayout === 'grid' ? (
        /* Cuadrícula Compacta Responsiva */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-3">
          {sortedNotes.map((note) => {
            const subject = subjectMap.get(note.subjectId) || getSubjectById(note.subjectId);
            const imageCount = imageCounts?.[note.id] || 0;
            const snippet = snippetsById[note.id] ?? '';
            const dateFormatted = new Date(note.updatedAt).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
            });

            return (
              <div
                key={note.id}
                onClick={() => handleOpenRead(note)}
                className="bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/40 dark:border-[#43474E]/40 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 flex flex-col justify-between shadow-2xs hover:shadow-sm hover:border-[#00639B]/40 transition-all cursor-pointer group relative"
              >
                {/* Cabecera de la Tarjeta */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 shadow-2xs text-white"
                      style={{
                        backgroundColor: subject?.color || '#00639B',
                      }}
                    >
                      <SubjectIcon icon={subject?.icon} className="w-3 h-3 text-white" />
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 leading-snug group-hover:text-[#00639B] dark:group-hover:text-[#92CCFF] transition-colors">
                      {note.title || 'Documento'}
                    </h3>
                  </div>

                  {/* Menú Contextual M3 (Kebab ⋮) */}
                  <M3KebabMenu
                    items={[
                      {
                        id: 'read',
                        label: 'Leer apunte',
                        icon: <BookOpen className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />,
                        variant: 'primary',
                        onClick: () => handleOpenRead(note),
                      },
                      {
                        id: 'edit',
                        label: 'Editar apunte',
                        icon: <Edit2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
                        onClick: () => handleOpenEdit(note),
                      },
                      {
                        id: 'delete',
                        label: 'Eliminar apunte',
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        variant: 'destructive',
                        onClick: () => setNoteToDelete(note),
                      },
                    ]}
                  />
                </div>

                {/* Hoja de Papel en Miniatura Descongestionada */}
                <div className="aspect-[4/3] rounded-xl bg-white dark:bg-slate-100 border border-slate-200/80 p-2 overflow-hidden text-slate-800 shadow-2xs my-2 flex flex-col justify-between select-none relative group-hover:border-[#00639B]/40 transition-colors">
                  <div className="space-y-1">
                    <div className="w-1/2 h-1 rounded-full bg-slate-300 dark:bg-slate-400 mb-1" />
                    <p className="text-[9px] text-slate-600 leading-tight line-clamp-3 font-sans">
                      {snippet}
                    </p>
                  </div>

                  {/* Pie de la Hoja de Papel */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    {imageCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded">
                        <Camera className="w-2.5 h-2.5" />
                        <span>{imageCount}</span>
                      </span>
                    ) : (
                      <div />
                    )}

                    <div
                      className="w-4 h-4 rounded flex items-center justify-center text-white shadow-2xs shrink-0"
                      style={{ backgroundColor: subject?.color || '#00639B' }}
                      title={subject?.name || 'Materia'}
                    >
                      <SubjectIcon icon={subject?.icon} className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Pie de la Tarjeta */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="truncate max-w-[80px] font-medium">
                    {subject?.name || 'General'}
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                    {dateFormatted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista de Lista Agrupada */
        <div className="bg-white dark:bg-[#1D2024] border border-[#C3C7D0]/40 dark:border-[#43474E]/40 rounded-2xl divide-y divide-slate-100 dark:divide-white/5 overflow-hidden shadow-2xs">
          {sortedNotes.map((note) => {
            const subject = subjectMap.get(note.subjectId) || getSubjectById(note.subjectId);
            const imageCount = imageCounts?.[note.id] || 0;
            const dateFormatted = new Date(note.updatedAt).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={note.id}
                onClick={() => handleOpenRead(note)}
                className="flex items-center justify-between p-2.5 sm:p-3 hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group relative"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs text-white"
                    style={{
                      backgroundColor: subject?.color || '#00639B',
                    }}
                  >
                    <SubjectIcon icon={subject?.icon} className="w-4 h-4 text-white" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-[#00639B] dark:group-hover:text-[#92CCFF] transition-colors leading-tight">
                      {note.title || 'Documento sin título'}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="truncate max-w-[120px] font-semibold text-slate-600 dark:text-slate-300">
                        {subject?.name || 'General'}
                      </span>
                      <span>•</span>
                      <span>{dateFormatted}</span>
                      {imageCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                            <Camera className="w-2.5 h-2.5" />
                            {imageCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menú Contextual M3 (Kebab ⋮) */}
                <div className="shrink-0 ml-2">
                  <M3KebabMenu
                    items={[
                      {
                        id: 'read',
                        label: 'Leer apunte',
                        icon: <BookOpen className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />,
                        variant: 'primary',
                        onClick: () => handleOpenRead(note),
                      },
                      {
                        id: 'edit',
                        label: 'Editar apunte',
                        icon: <Edit2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
                        onClick: () => handleOpenEdit(note),
                      },
                      {
                        id: 'delete',
                        label: 'Eliminar apunte',
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        variant: 'destructive',
                        onClick: () => setNoteToDelete(note),
                      },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={noteToDelete !== null}
        onClose={() => setNoteToDelete(null)}
        title="¿Eliminar Documento?"
        maxWidth="sm"
      >
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            ¿Deseas eliminar el documento <strong className="text-slate-900 dark:text-white">{noteToDelete?.title}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={() => setNoteToDelete(null)}
              className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        </div>
      </Modal>

      {/* Botón Flotante Compacto */}
      {isActive && (
        <DraggableFAB
          colorScheme="notes"
          onClick={handleOpenCreate}
          label="Nuevo Apunte"
          icon={<Plus className="w-6 h-6 stroke-[2.2]" />}
        />
      )}
    </div>
  );
};

// Componente Lightbox para ver la imagen en alta resolución con zoom interactivo
interface LightboxModalProps {
  image: NoteImage;
  onClose: () => void;
}

const LightboxModal: React.FC<LightboxModalProps> = ({ image, onClose }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(image.blob);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [image.blob]);

  if (!objectUrl) return null;

  return (
    <ImageZoomModal
      src={objectUrl}
      alt={image.name}
      onClose={onClose}
    />
  );
};

// Componente para Miniatura de Imagen con URL en memoria
interface ThumbnailCardProps {
  image: NoteImage;
  onZoom: () => void;
  onDelete: () => void;
}

const ThumbnailCard: React.FC<ThumbnailCardProps> = ({ image, onZoom, onDelete }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(image.blob);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [image.blob]);

  if (!objectUrl) return null;

  return (
    <div
      onClick={onZoom}
      className="relative group rounded-xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 aspect-square shadow-2xs hover:shadow-sm transition-all cursor-zoom-in active:scale-95 select-none"
      title="Tocar para ampliar"
    >
      <img
        src={objectUrl}
        alt={image.name || 'Foto del pizarrón'}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/75 hover:bg-red-600 text-white flex items-center justify-center shadow-md active:scale-90 transition-all z-10 cursor-pointer"
        title="Eliminar foto"
        aria-label="Eliminar fotografía"
      >
        <Trash2 className="w-3 h-3 text-white" />
      </button>
    </div>
  );
};
