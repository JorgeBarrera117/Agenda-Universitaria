import React, { useState, useEffect } from 'react';
import { Hash } from 'lucide-react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { RichTextEditor } from './RichTextEditor';
import type { Note, CreateNoteDTO } from '../types';

interface NoteEditorProps {
  initialData?: Note;
  defaultSubjectId?: string;
  onSubmit: (data: CreateNoteDTO) => Promise<void>;
  onCancel: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  initialData,
  defaultSubjectId,
  onSubmit,
  onCancel,
}) => {
  const { subjects } = useSubjects();

  const [title, setTitle] = useState(initialData?.title || '');
  const [subjectId, setSubjectId] = useState(
    initialData?.subjectId || defaultSubjectId || subjects[0]?.id || ''
  );
  const [content, setContent] = useState(initialData?.content || '');
  const [tagInput, setTagInput] = useState(initialData?.tags.join(', ') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar subjectId cuando las materias cargan desde IndexedDB
  useEffect(() => {
    if (!subjectId && subjects.length > 0) {
      setSubjectId(initialData?.subjectId || defaultSubjectId || subjects[0].id);
    }
  }, [subjects, subjectId, initialData, defaultSubjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('El título del apunte es obligatorio.');
      return;
    }
    if (!subjectId) {
      setError('Debes clasificar este apunte en una materia.');
      return;
    }

    const cleanTags = tagInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        title: title.trim(),
        subjectId,
        content,
        tags: cleanTags,
      });
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Error al guardar el apunte');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Título y Materia */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Título del Apunte *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Teorema de Nyquist, Repaso Examen Parcial"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-semibold"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Materia *
          </label>
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setError(null);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
            required
          >
            <option value="" disabled>-- Selecciona una materia --</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Etiquetas */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Etiquetas (separadas por comas)
        </label>
        <div className="relative">
          <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="formulas, examen, resumen, tarea"
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm"
          />
        </div>
      </div>

      {/* Editor Enriquecido WYSIWYG Estilo Word Móvil */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Contenido del Apunte
        </label>
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="Escribe tu apunte con formato o inserta fotos de la pizarra..."
        />
      </div>

      {/* Botones de acción */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || subjects.length === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm cursor-pointer"
        >
          {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar Apunte' : 'Guardar Apunte'}
        </button>
      </div>
    </form>
  );
};
