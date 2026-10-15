import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText,
  Tag,
  Calendar,
  BookOpen,
  Camera,
  Image as ImageIcon,
  Maximize2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { useNotes } from '../hooks/useNotes';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectIcon } from '../../subjects/components/SubjectIcon';
import { useNoteImages } from '../hooks/useNoteImages';
import { NoteEditor } from './NoteEditor';
import { Modal } from '../../../shared/components/Modal';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { ImageZoomModal } from '../../../shared/components/ImageZoomModal';
import { db } from '../../../shared/db/AppDatabase';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Note, CreateNoteDTO, NoteImage } from '../types';

interface NotesViewProps {
  initialSubjectFilterId?: string;
  onEditorActiveChange?: (isActive: boolean) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  initialSubjectFilterId,
  onEditorActiveChange,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectFilterId || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const { notes, isLoading, addNote, updateNote, removeNote } = useNotes(
    selectedSubjectId,
    searchQuery
  );
  const { subjects, getSubjectById } = useSubjects();

  // Conteo de fotos por nota para mostrar en las tarjetas
  const allImages = useLiveQuery(() => db.noteImages.toArray(), []);

  // Vistas a pantalla completa: 'list' (general), 'editor' (crear/editar), 'reader' (lectura generosa)
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'reader'>('list');
  const [editingNote, setEditingNote] = useState<Note | undefined>(undefined);
  const [readingNote, setReadingNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [zoomedImage, setZoomedImage] = useState<NoteImage | null>(null);
  const [zoomedInlineImage, setZoomedInlineImage] = useState<{ src: string; alt?: string } | null>(null);

  // Hook para las imágenes de la nota que se está leyendo
  const {
    images: readingNoteImages,
    addImage: addImageToReadingNote,
    removeImage: removeImageFromReadingNote,
  } = useNoteImages(readingNote?.id);

  const [isUploadingInReader, setIsUploadingInReader] = useState(false);
  const readerCameraInputRef = useRef<HTMLInputElement>(null);
  const readerGalleryInputRef = useRef<HTMLInputElement>(null);

  // Si cambia la materia inicial desde otra pantalla
  useEffect(() => {
    if (initialSubjectFilterId) {
      setSelectedSubjectId(initialSubjectFilterId);
    }
  }, [initialSubjectFilterId]);

  // Notificar al layout principal si estamos en modo editor/creador para ocultar cabecera y barra inferior
  useEffect(() => {
    onEditorActiveChange?.(viewMode === 'editor');
    return () => {
      onEditorActiveChange?.(false);
    };
  }, [viewMode, onEditorActiveChange]);

  // Soporte para botón "Atrás" de Android / Navegador
  useEffect(() => {
    const handlePopState = () => {
      if (viewMode !== 'list') {
        setViewMode('list');
        setEditingNote(undefined);
        setReadingNote(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewMode]);

  const handleOpenCreate = () => {
    setEditingNote(undefined);
    setViewMode('editor');
    window.history.pushState({ noteMode: 'editor' }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEdit = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingNote(note);
    setViewMode('editor');
    window.history.pushState({ noteMode: 'editor' }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenRead = (note: Note) => {
    setReadingNote(note);
    setViewMode('reader');
    window.history.pushState({ noteMode: 'reader' }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    setViewMode('list');
    setEditingNote(undefined);
    setReadingNote(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        return;
      }
    } else {
      await addNote(dto);
    }
    setViewMode('list');
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
      alert(err instanceof Error ? err.message : 'Error al adjuntar imagen.');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-cove-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Vista de Edición a Pantalla Completa (Sin modales reducidos)
  if (viewMode === 'editor') {
    return (
      <div className="max-w-4xl mx-auto pb-10">
        <NoteEditor
          initialData={editingNote}
          defaultSubjectId={selectedSubjectId !== 'all' ? selectedSubjectId : undefined}
          onSubmit={handleSubmit}
          onCancel={handleBackToList}
        />
      </div>
    );
  }

  // Vista de Lectura a Pantalla Completa (Lectura inmersiva universitaria)
  if (viewMode === 'reader' && readingNote) {
    const readingSubject = getSubjectById(readingNote.subjectId);
    const dateFormatted = new Date(readingNote.createdAt).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
        {/* Barra superior de navegación del lector */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={handleBackToList}
            aria-label="Volver a mis apuntes"
            title="Volver"
            className="p-2.5 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-cove-blue dark:text-cove-sky" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenEdit(readingNote)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-cove-blue dark:text-cove-sky bg-cove-blue/10 dark:bg-cove-blue/20 hover:bg-cove-blue/20 dark:hover:bg-cove-blue/30 rounded-xl sm:rounded-2xl transition-colors cursor-pointer border border-cove-sky/30 dark:border-cove-sky/40"
            >
              <Edit2 className="w-4 h-4" />
              <span>Editar Apunte</span>
            </button>
            <button
              onClick={() => setNoteToDelete(readingNote)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 rounded-xl sm:rounded-2xl transition-colors cursor-pointer border border-red-200/60 dark:border-red-800/60"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        {/* Hoja de Apunte Universitario a Pantalla Completa */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-12 shadow-sm border border-slate-200/90 dark:border-slate-800 space-y-6 text-slate-900 dark:text-slate-100">
          {/* Encabezado Académico */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="px-3.5 py-1.5 rounded-xl text-xs font-black text-white shadow-2xs"

                style={{ backgroundColor: readingSubject?.color || '#006BBB' }}
              >
                {readingSubject?.name || 'Materia'} {readingSubject?.code ? `(${readingSubject.code})` : ''}
              </span>

              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {dateFormatted}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              {readingNote.title}
            </h1>

            {readingNote.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {readingNote.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg"
                  >
                    <Tag className="w-3 h-3 text-slate-400" />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          {/* Cuerpo Enriquecido del Apunte con zoom interactivo al tocar imágenes */}
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
            className="text-slate-800 text-base sm:text-lg leading-relaxed prose prose-slate max-w-none [&_img]:cursor-zoom-in [&_img]:rounded-2xl [&_img]:shadow-md [&_img:hover]:ring-2 [&_img:hover]:ring-cove-sky/50 [&_img]:transition-all"
            dangerouslySetInnerHTML={{
              __html:
                readingNote.content.trim() ||
                '<p class="text-slate-400 italic">Este apunte no contiene texto redactado.</p>',
            }}
          />

          {/* Galería de Fotos del Pizarrón y Anexos */}
          <div className="pt-8 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4 text-cove-blue" />
                  Fotos del Pizarrón y Anexos ({readingNoteImages.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Capturas tomadas durante la cátedra guardadas en calidad comprimida.
                </p>
              </div>

              <div className="flex items-center gap-2">
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

                <button
                  type="button"
                  disabled={isUploadingInReader}
                  onClick={() => readerCameraInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cove-blue/10 hover:bg-cove-blue/20 text-cove-blue text-xs font-bold rounded-xl transition-colors cursor-pointer border border-cove-sky/30"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Tomar Foto
                </button>

                <button
                  type="button"
                  disabled={isUploadingInReader}
                  onClick={() => readerGalleryInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Galería
                </button>

                {isUploadingInReader && (
                  <Loader2 className="w-4 h-4 text-cove-blue animate-spin" />
                )}
              </div>
            </div>

            {readingNoteImages.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  No hay fotos anexadas a este apunte.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Usa los botones superiores para tomar una foto con la cámara o subir desde la galería.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {readingNoteImages.map((img) => (
                  <ThumbnailCard
                    key={img.id}
                    image={img}
                    onZoom={() => setZoomedImage(img)}
                    onDelete={() => removeImageFromReadingNote(img.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Confirmar Eliminación */}
        <Modal
          isOpen={noteToDelete !== null}
          onClose={() => setNoteToDelete(null)}
          title="¿Eliminar Apunte?"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              ¿Deseas eliminar <strong>{noteToDelete?.title}</strong>? Esta acción borrará también todas las fotos adjuntas permanentemente.
            </p>
            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setNoteToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer"
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

  // Helper para purgar markdown, KaTeX y HTML de los fragmentos de vista previa
  const cleanSnippetPreview = (rawContent: string): string => {
    if (!rawContent) return '';
    const cleaned = rawContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' [Fórmula] ')
      .replace(/\$([^$]+)\$/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/^>\s+/gm, '')
      .replace(/^[\*\-\+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/```[\s\S]*?```/g, ' [Código] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || 'Apunte visual con fotografías de cátedra.';
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Estilo Cuaderno de Cátedra */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Cuaderno de Apuntes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Tus notas de clase, resúmenes y fotos de pizarrón clasificadas por materia.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-500/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Apunte
        </button>
      </div>

      {/* Buscador de Apuntes Universitario */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar fórmulas, conceptos, pizarras o #etiquetas..."
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-2xs"
        />
      </div>

      {/* Separadores de Carpeta Universitaria (Subject Folder Tabs) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedSubjectId('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            selectedSubjectId === 'all'
              ? 'bg-cove-navy text-white shadow-sm ring-2 ring-cove-sky/40'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          Todas las materias ({notes.length})
        </button>
        {subjects.map((sub) => {
          const isSelected = selectedSubjectId === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => setSelectedSubjectId(sub.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
              style={{
                backgroundColor: isSelected ? sub.color : undefined,
              }}
            >
              <span
                className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                style={{
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : `${sub.color}25`,
                  color: isSelected ? '#ffffff' : sub.color,
                }}
              >
                <SubjectIcon icon={sub.icon} className="w-3.5 h-3.5" />
              </span>
              {sub.name}
            </button>
          );
        })}
      </div>

      {/* Lista / Grid de Apuntes */}
      {notes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-8 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-cove-blue/10 dark:bg-cove-blue/20 text-cove-blue dark:text-cove-sky flex items-center justify-center mx-auto mb-3">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            {searchQuery ? 'No se encontraron apuntes' : 'No hay notas en esta asignatura'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
            {searchQuery
              ? 'Intenta con otro término de búsqueda o selecciona otra asignatura.'
              : 'Escribe tu primer apunte con formato enriquecido o toma fotos de las diapositivas.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-cove-blue/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Crear apunte de cátedra
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {notes.map((note) => {
            const subject = getSubjectById(note.subjectId);
            const imageCount = allImages?.filter((img) => img.noteId === note.id).length || 0;
            const dateFormatted = new Date(note.updatedAt).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            // Extraer texto limpio de Markdown, fórmulas KaTeX y etiquetas HTML
            const cleanSnippet = cleanSnippetPreview(note.content);

            return (
              <div
                key={note.id}
                onClick={() => handleOpenRead(note)}
                style={{
                  background: `linear-gradient(145deg, ${subject?.color || '#006BBB'}1f 0%, ${subject?.color || '#006BBB'}0c 100%), var(--card-bg, #ffffff)`,
                  borderColor: `${subject?.color || '#006BBB'}45`,
                }}
                className="group relative rounded-3xl p-5 sm:p-6 border shadow-2xs hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-row items-stretch justify-between gap-3 sm:gap-4 hover:-translate-y-0.5 overflow-hidden"
              >
                {/* Contenido Principal (Izquierda) */}
                <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    {/* Encabezado: Materia y Fecha */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black text-white shadow-2xs truncate max-w-[180px]"
                        style={{ backgroundColor: subject?.color || '#006BBB' }}
                      >
                        <SubjectIcon icon={subject?.icon} className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{subject?.name || 'Materia'}</span>
                      </span>

                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        {dateFormatted}
                      </span>
                    </div>

                    {/* Título de la Ficha */}
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-cove-blue dark:group-hover:text-cove-sky transition-colors line-clamp-2 leading-snug tracking-tight">
                      {note.title}
                    </h3>
                  </div>

                  {/* Extracto de Cuaderno Sanitizeado */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed font-sans">
                    {cleanSnippet}
                  </div>

                  {/* Pie de la Ficha: Etiquetas y Pizarras */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    {note.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {note.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60"
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                            {tag}
                          </span>
                        ))}
                        {note.tags.length > 2 && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                            +{note.tags.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Insignia de Fotos de Pizarrón */}
                    {imageCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-900 dark:text-amber-100 bg-cove-sand/50 dark:bg-amber-950/40 border border-cove-gold/60 dark:border-amber-800/60 px-2 py-0.5 rounded-xl shadow-2xs">
                        <Camera className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                        <span>{imageCount} {imageCount === 1 ? 'pizarra' : 'pizarras'}</span>
                      </span>
                    )}
                  </div>
                </div>


                {/* Columna Vertical de Acciones (Derecha) - Separados por 15px */}
                <div className="flex flex-col justify-center items-center shrink-0 pl-2 sm:pl-3 py-0.5 gap-[15px]">
                  {/* Botón 1: Leer / Abrir apunte (Superior - Esmeralda para modo lectura) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRead(note);
                    }}
                    className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 hover:from-emerald-500 hover:via-teal-600 hover:to-slate-900 ring-1 ring-teal-300/40 text-white flex items-center justify-center transition-all active:scale-95 shadow-md shadow-emerald-950/30 cursor-pointer"
                    title="Leer apunte a pantalla completa"
                    aria-label="Leer apunte"
                  >
                    <BookOpen className="w-5 h-5 text-white" />
                  </button>

                  {/* Botón 2: Editar apunte (Centro - Azul para editar) */}
                  <button
                    onClick={(e) => handleOpenEdit(note, e)}
                    className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-cove-navy hover:from-blue-500 hover:via-blue-600 hover:to-cove-navy ring-1 ring-sky-300/40 text-white flex items-center justify-center transition-all active:scale-95 shadow-md shadow-blue-950/30 cursor-pointer"
                    title="Editar apunte"
                    aria-label="Editar apunte"
                  >
                    <Edit2 className="w-4 h-4 text-white" />
                  </button>

                  {/* Botón 3: Eliminar apunte (Inferior - Rojo para eliminar) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNoteToDelete(note);
                    }}
                    className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 via-rose-600 to-slate-900 hover:from-red-400 hover:via-rose-500 hover:to-slate-900 ring-1 ring-rose-300/40 text-white flex items-center justify-center transition-all active:scale-95 shadow-md shadow-red-950/30 cursor-pointer"
                    title="Eliminar apunte"
                    aria-label="Eliminar apunte"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Visor de Pantalla Completa (Lightbox) */}
      {zoomedImage && (
        <LightboxModal image={zoomedImage} onClose={() => setZoomedImage(null)} />
      )}

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={noteToDelete !== null}
        onClose={() => setNoteToDelete(null)}
        title="¿Eliminar Apunte?"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            ¿Deseas eliminar <strong>{noteToDelete?.title}</strong>? Esta acción borrará también todas las fotos adjuntas permanentemente.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setNoteToDelete(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        </div>
      </Modal>

      {/* Botón Flotante Móvil Reubicable (FAB con Snap a Bordes) */}
      <DraggableFAB
        colorScheme="notes"
        onClick={handleOpenCreate}
        label="Nuevo Apunte de Cátedra"
      />
    </div>
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
    <div className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square shadow-2xs hover:shadow-md transition-all">
      <img src={objectUrl} alt={image.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={onZoom}
          className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-xl backdrop-blur-xs cursor-pointer transition-colors"
          title="Ver en pantalla completa con zoom"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-xl backdrop-blur-xs cursor-pointer transition-colors"
          title="Eliminar foto"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
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
