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
  ExternalLink,
  Camera,
  Image as ImageIcon,
  Maximize2,
  X,
  Loader2,
} from 'lucide-react';
import { useNotes } from '../hooks/useNotes';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useNoteImages } from '../hooks/useNoteImages';
import { NoteEditor } from './NoteEditor';
import { Modal } from '../../../shared/components/Modal';
import { db } from '../../../shared/db/AppDatabase';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Note, CreateNoteDTO, NoteImage } from '../types';

interface NotesViewProps {
  initialSubjectFilterId?: string;
}

export const NotesView: React.FC<NotesViewProps> = ({ initialSubjectFilterId }) => {
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

  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | undefined>(undefined);
  const [readingNote, setReadingNote] = useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [zoomedImage, setZoomedImage] = useState<NoteImage | null>(null);

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

  const handleOpenCreate = () => {
    setEditingNote(undefined);
    setIsEditorModalOpen(true);
  };

  const handleOpenEdit = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingNote(note);
    setIsEditorModalOpen(true);
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
      }
    } else {
      await addNote(dto);
    }
    setIsEditorModalOpen(false);
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
      }
      setNoteToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado Estilo Cuaderno de Cátedra */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Cuaderno de Apuntes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Tus notas de clase, resúmenes y fotos de pizarrón clasificadas por materia.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs sm:text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
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
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-400 shadow-2xs"
        />
      </div>

      {/* Separadores de Carpeta Universitaria (Subject Folder Tabs) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedSubjectId('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            selectedSubjectId === 'all'
              ? 'bg-slate-900 text-white shadow-sm ring-2 ring-indigo-500/30'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
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
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
              }`}
              style={{
                backgroundColor: isSelected ? sub.color : undefined,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: isSelected ? '#ffffff' : sub.color }}
              />
              {sub.name}
            </button>
          );
        })}
      </div>

      {/* Lista / Grid de Apuntes */}
      {notes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            {searchQuery ? 'No se encontraron apuntes' : 'No hay notas en esta asignatura'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mb-4 max-w-sm mx-auto">
            {searchQuery
              ? 'Intenta con otro término de búsqueda o selecciona otra asignatura.'
              : 'Escribe tu primer apunte con formato enriquecido o toma fotos de las diapositivas.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
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
            });

            // Extraer texto limpio de HTML para la previsualización en la tarjeta
            const cleanSnippet =
              note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ||
              '(Contenido visual con fotos)';

            return (
              <div
                key={note.id}
                onClick={() => setReadingNote(note)}
                className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group hover:border-indigo-300 relative overflow-hidden"
              >
                {/* Franja superior de materia */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: subject?.color || '#4f46e5' }}
                />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black text-white shadow-2xs"
                      style={{ backgroundColor: subject?.color || '#4f46e5' }}
                    >
                      <BookOpen className="w-3 h-3" />
                      {subject?.name || 'Materia'}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleOpenEdit(note, e)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Editar apunte"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNoteToDelete(note);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                        title="Eliminar apunte"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {note.title}
                  </h3>

                  <p className="mt-2.5 text-xs text-slate-500 line-clamp-3 leading-relaxed font-normal">
                    {cleanSnippet}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    {note.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {note.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-md"
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            {tag}
                          </span>
                        ))}
                        {note.tags.length > 2 && (
                          <span className="text-[10px] text-slate-400 font-bold">
                            +{note.tags.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Indicador de fotos */}
                    {imageCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        <Camera className="w-3 h-3 text-indigo-500" />
                        {imageCount} {imageCount === 1 ? 'pizarra' : 'pizarras'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {dateFormatted}
                    </span>
                    <span className="text-indigo-600 font-bold group-hover:underline flex items-center gap-0.5">
                      Abrir <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Editor WYSIWYG */}
      <Modal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        title={editingNote ? 'Editar Apunte' : 'Nuevo Apunte de Cátedra'}
        maxWidth="2xl"
      >
        <NoteEditor
          initialData={editingNote}
          defaultSubjectId={selectedSubjectId !== 'all' ? selectedSubjectId : undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsEditorModalOpen(false)}
        />
      </Modal>

      {/* Modal Lector de Apunte Completo */}
      <Modal
        isOpen={readingNote !== null}
        onClose={() => setReadingNote(null)}
        title={readingNote?.title || 'Apunte'}
        maxWidth="2xl"
      >
        {readingNote && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
              <span
                className="px-3 py-1 rounded-xl text-xs font-black text-white shadow-2xs"
                style={{
                  backgroundColor: getSubjectById(readingNote.subjectId)?.color || '#4f46e5',
                }}
              >
                {getSubjectById(readingNote.subjectId)?.name || 'Materia'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleOpenEdit(readingNote);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar Apunte
                </button>
              </div>
            </div>

            {readingNote.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {readingNote.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg"
                  >
                    <Tag className="w-3 h-3 text-slate-400" />
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Contenido enriquecido del Apunte */}
            <div
              className="p-5 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm leading-relaxed prose prose-indigo max-w-none max-h-[460px] overflow-y-auto shadow-2xs"
              dangerouslySetInnerHTML={{
                __html:
                  readingNote.content.trim() ||
                  '<p class="text-slate-400 italic">Sin texto en este apunte.</p>',
              }}
            />

            {/* Galería de Fotos Adjuntas */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  Fotos del Pizarrón y Anexos ({readingNoteImages.length})
                </h4>

                <div className="flex items-center gap-1.5">
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
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-indigo-200/60"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Cámara
                  </button>

                  <button
                    type="button"
                    disabled={isUploadingInReader}
                    onClick={() => readerGalleryInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Galería
                  </button>

                  {isUploadingInReader && (
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  )}
                </div>
              </div>

              {readingNoteImages.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                  <Camera className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs text-slate-500 font-medium">
                    No hay fotos de pizarra anexadas a este apunte.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
        )}
      </Modal>

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

// Componente Lightbox para ver la imagen en alta resolución
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!objectUrl) return null;

  return (
    <div
      className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <button
          onClick={onClose}
          className="p-2.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          title="Cerrar visor"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div
        className="max-w-5xl max-h-[85vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={objectUrl}
          alt={image.name}
          className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
        />
      </div>

      <div className="mt-3 text-center text-xs font-mono text-slate-400">
        {image.name} • Toca fuera o presiona ESC para cerrar
      </div>
    </div>
  );
};
