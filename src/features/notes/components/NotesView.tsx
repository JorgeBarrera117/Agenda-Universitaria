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
  MoreVertical,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  X,
  Tag,
  Copy,
  Clock,
  Info,
} from 'lucide-react';
import { useNotes } from '../hooks/useNotes';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import { useNoteImages } from '../hooks/useNoteImages';
import { NoteEditor } from './NoteEditor';
import { Modal } from '../../../shared/components/Modal';
import { M3Select } from '../../../shared/components/M3Select';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { ImageZoomModal } from '../../../shared/components/ImageZoomModal';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { db } from '../../../shared/db/AppDatabase';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Card } from '../../../shared/components/atoms';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import { useScrollCollapse } from '../../../shared/hooks/useScrollCollapse';
import type { Note, CreateNoteDTO, NoteImage } from '../types';

interface NotesViewProps {
  initialSubjectFilterId?: string;
  onEditorActiveChange?: (isActive: boolean) => void;
  isActive?: boolean;
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

  // Menú de tres puntos activo por apunte
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);

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

  const [isUploadingInReader, setIsUploadingInReader] = useState(false);
  const [isReaderMenuOpen, setIsReaderMenuOpen] = useState(false);
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
      setViewMode('list');
      setReadingNote(null);
      setEditingNote(undefined);
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
    setActiveMenuNoteId(null);
    setEditingNote(note);
    setViewMode('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenRead = (note: Note) => {
    setActiveMenuNoteId(null);
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

  // 2. Vista de Lectura a Pantalla Completa
  if (viewMode === 'reader' && readingNote) {
    const readingSubject = subjectMap.get(readingNote.subjectId) || getSubjectById(readingNote.subjectId);
    const dateFormatted = new Date(readingNote.createdAt).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const stats = getNoteStats(readingNote);

    return (
      <div className="relative min-h-[100dvh] w-full flex flex-col pb-16">
        {/* Barra Superior Fija Compacta */}
        <header className="sticky top-0 z-40 bg-[var(--color-md-surface-container)] border-b border-[var(--color-md-outline-variant)] px-3 sm:px-6 py-2 flex items-center justify-between gap-2.5 shadow-xs">
          {/* Izquierda: Botón Volver y Contexto de la Nota */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleBackToList}
              aria-label="Volver a la galería"
              title="Volver"
              className="w-9 h-9 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] text-[#191C20] dark:text-[#E2E2E6] flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>

            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] truncate leading-tight">
                {readingNote.title || 'Documento sin título'}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#72777F] dark:text-[#8C9199] truncate mt-0.5">
                <div
                  className="w-3.5 h-3.5 rounded-md flex items-center justify-center shrink-0 text-white shadow-2xs"
                  style={{ backgroundColor: readingSubject?.color || '#00639B' }}
                >
                  <SubjectIcon icon={readingSubject?.icon} className="w-2 h-2 text-white" />
                </div>
                <span className="truncate max-w-[120px] sm:max-w-xs font-semibold text-[#191C20] dark:text-[#E2E2E6]">
                  {readingSubject?.name || 'Materia'}
                </span>
                <span>•</span>
                <span>Lectura</span>
              </div>
            </div>
          </div>

          {/* Derecha: Menú de Opciones (⋮) */}
          <div className="flex items-center gap-1 shrink-0 relative">
            <button
              type="button"
              onClick={() => setIsReaderMenuOpen(!isReaderMenuOpen)}
              title="Más opciones"
              aria-label="Más opciones"
              className="w-9 h-9 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] hover:bg-[#D0E4FF] text-[#191C20] dark:text-[#E2E2E6] flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <MoreVertical className="w-4.5 h-4.5" />
            </button>

            {/* Menú Desplegable Flotante */}
            {isReaderMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsReaderMenuOpen(false)}
                />
                <div className="absolute right-0 top-11 z-50 w-52 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-2xl shadow-lg p-1.5 space-y-0.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReaderMenuOpen(false);
                      handleOpenEdit(readingNote);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-left font-medium"
                  >
                    <Edit2 className="w-4 h-4 text-[#00639B] dark:text-[#92CCFF]" />
                    <span>Editar apunte</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsReaderMenuOpen(false);
                      readerCameraInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-left font-medium"
                  >
                    <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Foto del pizarrón</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsReaderMenuOpen(false);
                      readerGalleryInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-left font-medium"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Subir de galería</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsReaderMenuOpen(false);
                      handleCopyText();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-left font-medium"
                  >
                    <Copy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Copiar texto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsReaderMenuOpen(false);
                      setIsDetailsModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer text-left font-medium"
                  >
                    <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Detalles</span>
                  </button>

                  <div className="h-px bg-slate-100 dark:bg-white/10 my-0.5" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsReaderMenuOpen(false);
                      setNoteToDelete(readingNote);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer text-left font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar apunte</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Inputs ocultos de archivo */}
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

        {/* Folio de Lectura Descongestionado */}
        <div className="w-full px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-5 space-y-4">
          <div className="bg-[#FDFBFF] dark:bg-[#1D2024] rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 lg:p-7 shadow-xs border border-[#C3C7D0]/40 dark:border-[#43474E]/40 space-y-4 text-[#191C20] dark:text-[#E2E2E6] transition-colors">
            {/* Metadatos y Badges */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-2xs"
                  style={{ backgroundColor: readingSubject?.color || '#00639B' }}
                >
                  <SubjectIcon icon={readingSubject?.icon} className="w-3 h-3 text-white" />
                  {readingSubject?.name || 'Materia'} {readingSubject?.code ? `• ${readingSubject.code}` : ''}
                </span>

                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#43474E] dark:text-[#C3C7D0] bg-[#F1F4FA] dark:bg-[#272A2F] px-2.5 py-0.5 rounded-full border border-[#C3C7D0]/30 dark:border-[#43474E]/30">
                  <Clock className="w-3 h-3 text-[#72777F]" />
                  {dateFormatted}
                </span>
              </div>

              {/* Título Principal Compacto */}
              <h1 className="text-xl sm:text-2xl font-black text-[#191C20] dark:text-[#E2E2E6] tracking-tight leading-snug">
                {readingNote.title || 'Documento sin título'}
              </h1>

              {/* Etiquetas (#Tags) */}
              {readingNote.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {readingNote.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] rounded-full border border-[#00639B]/20"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-[#C3C7D0]/30 dark:bg-[#43474E]/30" />

            {/* Cuerpo del Apunte Enriquecido */}
            <div
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target && target.tagName === 'IMG') {
                  const img = target as HTMLImageElement;
                  setZoomedInlineImage({
                    src: img.src,
                    alt: img.alt || 'Foto del apunte',
                  });
                }
              }}
              className="prose dark:prose-invert max-w-none text-[#191C20] dark:text-[#E2E2E6] leading-relaxed text-sm sm:text-base select-text"
              dangerouslySetInnerHTML={{ __html: readingNote.content }}
            />

            {/* Fotografías del Pizarrón y Diapositivas */}
            <div className="pt-4 border-t border-[#C3C7D0]/30 dark:border-[#43474E]/30 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#00639B]/15 text-[#00639B] dark:text-[#92CCFF] flex items-center justify-center">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      Fotos del Pizarrón
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {readingNoteImages.length}{' '}
                      {readingNoteImages.length === 1 ? 'foto adjunta' : 'fotos adjuntas'}
                    </p>
                  </div>
                </div>

                {/* Acciones Rápidas de Cámara y Galería */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isUploadingInReader}
                    onClick={() => readerCameraInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#00639B]/15 hover:bg-[#00639B]/25 text-[#00639B] dark:text-[#92CCFF] text-[11px] font-bold rounded-xl transition-all cursor-pointer border border-[#00639B]/30 active:scale-95"
                    title="Tomar foto con la cámara"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Cámara</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUploadingInReader}
                    onClick={() => readerGalleryInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-xl transition-all cursor-pointer border border-slate-200/80 dark:border-white/10 active:scale-95"
                    title="Subir de la galería"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Galería</span>
                  </button>

                  {isUploadingInReader && (
                    <Loader2 className="w-3.5 h-3.5 text-[#00639B] animate-spin ml-1" />
                  )}
                </div>
              </div>

              {/* Miniaturas de Fotos */}
              {readingNoteImages.length === 0 ? (
                <div
                  onClick={() => readerCameraInputRef.current?.click()}
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-[#1D2024] border border-dashed border-slate-200/90 dark:border-white/10 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#00639B] transition-colors" />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Sin fotografías anexadas a este apunte
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-[#00639B] dark:text-[#92CCFF] group-hover:underline">
                    + Foto
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {readingNoteImages.map((img) => (
                    <ThumbnailCard
                      key={img.id}
                      image={img}
                      onZoom={() => setZoomedImage(img)}
                      onDelete={() => setImageToDelete(img)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toast Notificación Contextual */}
        <ContextualToast
          message={readerToast}
          bottomOffset="compact"
          onClose={() => setReaderToast(null)}
        />

        {/* Modal Detalles del Documento */}
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title="Detalles del Documento"
          maxWidth="sm"
        >
          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-2.5 bg-slate-50 dark:bg-[#1D2024] rounded-xl border border-slate-200/70 dark:border-white/10 space-y-1.5">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500 dark:text-slate-400">Palabras:</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats.words}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500 dark:text-slate-400">Caracteres:</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats.chars}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500 dark:text-slate-400">Fotos de pizarra:</span>
                <span className="font-bold text-slate-900 dark:text-white">{readingNoteImages.length}</span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-[#1D2024] rounded-xl border border-slate-200/70 dark:border-white/10 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Creado:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {new Date(readingNote.createdAt).toLocaleString('es-ES')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Última edición:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {new Date(readingNote.updatedAt).toLocaleString('es-ES')}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>

        {/* Modal Confirmar Eliminación de Apunte */}
        <Modal
          isOpen={noteToDelete !== null}
          onClose={() => setNoteToDelete(null)}
          title="¿Eliminar Apunte?"
          maxWidth="sm"
        >
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas eliminar <strong>{noteToDelete?.title}</strong>? Esta acción borrará permanentemente sus fotos anexadas.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </Modal>

        {/* Modal Confirmar Eliminación de Fotografía */}
        <Modal
          isOpen={imageToDelete !== null}
          onClose={() => setImageToDelete(null)}
          title="¿Eliminar Fotografía?"
          maxWidth="sm"
        >
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas eliminar esta fotografía del pizarrón? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setImageToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (imageToDelete) {
                    await removeImageFromReadingNote(imageToDelete.id);
                    setImageToDelete(null);
                  }
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </Modal>

        {/* Visor Lightbox */}
        {zoomedImage && (
          <LightboxModal image={zoomedImage} onClose={() => setZoomedImage(null)} />
        )}

        {/* Visor de Zoom para fotos insertadas en el texto */}
        {zoomedInlineImage && (
          <ImageZoomModal
            src={zoomedInlineImage.src}
            alt={zoomedInlineImage.alt}
            onClose={() => setZoomedInlineImage(null)}
          />
        )}
      </div>
    );
  }

  // 3. Vista de Galería de Documentos (M3 High Density)
  return (
    <div className="space-y-3.5 w-full">
      {/* Overlay transparente para cerrar menú contextual */}
      {activeMenuNoteId && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setActiveMenuNoteId(null)}
        />
      )}

      {/* 1. Encabezado del Apartado (Jerarquía Nivel 1 Compacta) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Cuaderno de Apuntes
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF]">
              {notes.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
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

            const isMenuOpen = activeMenuNoteId === note.id;

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

                  {/* Botón Tres Puntos (⋮) */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuNoteId(isMenuOpen ? null : note.id);
                      }}
                      className="w-6 h-6 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      title="Más opciones"
                      aria-label="Más opciones"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Menú Contextual Flotante */}
                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-7 w-44 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-xl shadow-lg p-1 z-30 animate-in fade-in zoom-in-95 duration-150 space-y-0.5"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenRead(note)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
                          <span>Leer apunte</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(note, e)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuNoteId(null);
                            setNoteToDelete(note);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/25 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    )}
                  </div>
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

            const isMenuOpen = activeMenuNoteId === note.id;

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

                {/* Botón Tres Puntos (⋮) */}
                <div className="relative shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuNoteId(isMenuOpen ? null : note.id);
                    }}
                    className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {isMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-7 w-44 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-xl shadow-lg p-1 z-30 animate-in fade-in zoom-in-95 duration-150 space-y-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenRead(note)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
                        <span>Leer apunte</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(note, e)}
                        className="w-full px-2.5 py-1.5 text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuNoteId(null);
                          setNoteToDelete(note);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/25 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  )}
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
