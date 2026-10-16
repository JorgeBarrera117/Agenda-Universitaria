import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText,
  FilePlus2,
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
import { Button, Card, Badge } from '../../../shared/components/atoms';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import DOMPurify from 'dompurify';
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
  const [imageToDelete, setImageToDelete] = useState<NoteImage | null>(null);

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

  // Interceptar botón "Atrás" de Android cuando estamos dentro de un apunte (editor o lector)
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
  }, BACK_PRIORITY.SUBVIEW, viewMode !== 'list');

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
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-center text-cove-blue dark:text-cove-sky active:scale-95 transition-all cursor-pointer shrink-0 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <Button
              variant="action-blue"
              size="icon-md"
              onClick={() => handleOpenEdit(readingNote)}
              title="Editar apunte"
              aria-label="Editar apunte"
              icon={<Edit2 className="w-5 h-5 text-white" />}
            />
            <Button
              variant="action-rose"
              size="icon-md"
              onClick={() => setNoteToDelete(readingNote)}
              title="Eliminar apunte"
              aria-label="Eliminar apunte"
              icon={<Trash2 className="w-5 h-5 text-white" />}
            />
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

              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                {dateFormatted}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {readingNote.title}
            </h1>

            {readingNote.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {readingNote.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-700/60"
                  >
                    <Tag className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-800" />

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
            className="text-slate-800 dark:text-slate-200 text-base sm:text-lg leading-relaxed prose prose-slate dark:prose-invert max-w-none [&_img]:cursor-zoom-in [&_img]:rounded-2xl [&_img]:shadow-md [&_img:hover]:ring-2 [&_img:hover]:ring-cove-sky/50 [&_img]:transition-all"
            dangerouslySetInnerHTML={{
              __html:
                DOMPurify.sanitize(readingNote.content.trim()) ||
                '<p class="text-slate-400 italic">Este apunte no contiene texto redactado.</p>',
            }}
          />

          {/* Galería de Fotos del Pizarrón y Anexos */}
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4 text-cove-blue dark:text-cove-sky" />
                  Fotos del Pizarrón y Anexos ({readingNoteImages.length})
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cove-blue/10 dark:bg-cove-blue/20 hover:bg-cove-blue/20 dark:hover:bg-cove-blue/30 text-cove-blue dark:text-cove-sky text-xs font-bold rounded-xl transition-colors cursor-pointer border border-cove-sky/30 dark:border-cove-sky/40"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Tomar Foto
                </button>

                <button
                  type="button"
                  disabled={isUploadingInReader}
                  onClick={() => readerGalleryInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-700/80"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Galería
                </button>

                {isUploadingInReader && (
                  <Loader2 className="w-4 h-4 text-cove-blue dark:text-cove-sky animate-spin" />
                )}
              </div>
            </div>

            {readingNoteImages.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <Camera className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  No hay fotos anexadas a este apunte.
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
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
                    onDelete={() => setImageToDelete(img)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Confirmar Eliminación de Apunte */}
        <Modal
          isOpen={noteToDelete !== null}
          onClose={() => setNoteToDelete(null)}
          title="¿Eliminar Apunte?"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Deseas eliminar <strong>{noteToDelete?.title}</strong>? Esta acción borrará también todas las fotos adjuntas permanentemente.
            </p>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Eliminar Apunte
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
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Estás seguro de que deseas eliminar esta fotografía del pizarrón? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setImageToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
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
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Eliminar Foto
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
    <div className="space-y-5">
      {/* Encabezado Estilo Cuaderno de Cátedra */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Cuaderno de Apuntes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Tus notas de clase, resúmenes y fotos de pizarrón clasificadas por materia.
          </p>
        </div>
        <div className="hidden sm:block">
          <Button
            variant="action-indigo"
            size="md"
            icon={<FilePlus2 className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            Nuevo Apunte
          </Button>
        </div>
      </div>

      {/* Buscador de Apuntes Universitario */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar fórmulas, conceptos, pizarras o #etiquetas..."
          className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-2xs"
        />
      </div>

      {/* Separadores de Carpeta Universitaria (Subject Folder Tabs) */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedSubjectId('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
              style={{
                backgroundColor: isSelected ? sub.color : undefined,
              }}
            >
              <span
                className="w-4 h-4 rounded-md flex items-center justify-center shrink-0 shadow-2xs"
                style={{
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : `${sub.color}25`,
                  color: isSelected ? '#ffffff' : sub.color,
                }}
              >
                <SubjectIcon icon={sub.icon} className="w-3 h-3" />
              </span>
              {sub.name}
            </button>
          );
        })}
      </div>

      {/* Lista / Grid de Apuntes */}
      {notes.length === 0 ? (
        <Card padding="relaxed" className="text-center py-14 border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-cove-blue/10 dark:bg-cove-blue/20 text-cove-blue dark:text-cove-sky flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
            {searchQuery ? 'No se encontraron apuntes' : 'No hay notas en esta asignatura'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
            {searchQuery
              ? 'Intenta con otro término de búsqueda o selecciona otra asignatura.'
              : 'Escribe tu primer apunte con formato enriquecido o toma fotos de las diapositivas.'}
          </p>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenCreate}
          >
            Crear apunte de cátedra
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
              <Card
                key={note.id}
                padding="normal"
                accentColor={subject?.color}
                interactive
                onClick={() => handleOpenRead(note)}
                className="flex flex-row items-stretch justify-between gap-3 group"
              >
                {/* Contenido Principal (Izquierda) */}
                <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
                  <div className="space-y-1.5">
                    {/* Encabezado: Materia y Fecha */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-black text-white shadow-2xs truncate max-w-[170px]"
                        style={{ backgroundColor: subject?.color || '#006BBB' }}
                      >
                        <SubjectIcon icon={subject?.icon} className="w-3 h-3 shrink-0" />
                        <span className="truncate">{subject?.name || 'Materia'}</span>
                      </span>

                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        {dateFormatted}
                      </span>
                    </div>

                    {/* Título de la Ficha */}
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-cove-blue dark:group-hover:text-cove-sky transition-colors line-clamp-1 leading-snug tracking-tight">
                      {note.title}
                    </h3>
                  </div>

                  {/* Extracto de Cuaderno Sanitizeado */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-100 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-sans">
                    {cleanSnippet}
                  </div>

                  {/* Pie de la Ficha: Etiquetas y Pizarras */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    {note.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {note.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="neutral" size="xs" icon={<Tag className="w-2.5 h-2.5" />}>
                            {tag}
                          </Badge>
                        ))}
                        {note.tags.length > 2 && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold px-1">
                            +{note.tags.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Insignia de Fotos de Pizarrón */}
                    {imageCount > 0 && (
                      <Badge variant="secondary" size="xs" icon={<Camera className="w-3 h-3 text-amber-700 dark:text-amber-400" />}>
                        {imageCount} {imageCount === 1 ? 'pizarra' : 'pizarras'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Columna Vertical de Acciones (Derecha) */}
                <div className="flex flex-col justify-center items-center shrink-0 pl-1.5 sm:pl-2 py-0.5 gap-2 sm:gap-2.5">
                  {/* Botón 1: Leer / Abrir apunte */}
                  <Button
                    variant="action-emerald"
                    size="icon-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRead(note);
                    }}
                    title="Leer apunte a pantalla completa"
                    aria-label="Leer apunte"
                    icon={<BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                  />

                  {/* Botón 2: Editar apunte */}
                  <Button
                    variant="action-blue"
                    size="icon-md"
                    onClick={(e) => handleOpenEdit(note, e)}
                    title="Editar apunte"
                    aria-label="Editar apunte"
                    icon={<Edit2 className="w-4 h-4 text-white" />}
                  />

                  {/* Botón 3: Eliminar apunte */}
                  <Button
                    variant="action-rose"
                    size="icon-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNoteToDelete(note);
                    }}
                    title="Eliminar apunte"
                    aria-label="Eliminar apunte"
                    icon={<Trash2 className="w-4 h-4 text-white" />}
                  />
                </div>
              </Card>
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
        icon={<FilePlus2 className="w-7 h-7 text-white stroke-[2.2]" />}
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
    <div
      onClick={onZoom}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onZoom();
        }
      }}
      className="relative group rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 aspect-square shadow-2xs hover:shadow-md transition-all cursor-zoom-in active:scale-95 select-none"
      title="Tocar para ver en pantalla completa con zoom"
    >
      <img
        src={objectUrl}
        alt={image.name || 'Foto del pizarrón'}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
      />

      {/* Botón para Eliminar foto (Aislado en la esquina superior derecha con stopPropagation) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/75 hover:bg-red-600 text-white flex items-center justify-center shadow-md active:scale-90 transition-all z-10 cursor-pointer"
        title="Eliminar fotografía"
        aria-label="Eliminar fotografía"
      >
        <Trash2 className="w-4 h-4 text-white" />
      </button>

      {/* Indicador visual de zoom al pie de la foto */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-slate-950/65 backdrop-blur-xs rounded-lg flex items-center gap-1.5 text-[10px] text-white font-bold pointer-events-none shadow-xs">
        <Maximize2 className="w-3 h-3 text-cove-sky" />
        <span>Ver Foto</span>
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
