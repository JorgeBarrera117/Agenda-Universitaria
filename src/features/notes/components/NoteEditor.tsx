import React, { useState, useEffect } from 'react';
import { Hash, ArrowLeft, Save } from 'lucide-react';
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

  const selectedSubject = subjects.find((s) => s.id === subjectId);

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
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-200">
      {/* Barra Superior de Navegación del Editor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-2xl shadow-2xs transition-all cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-600" />
          <span>Volver al Cuaderno</span>
        </button>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Descartar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || subjects.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 rounded-2xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Guardando...' : initialData ? 'Actualizar Apunte' : 'Guardar Apunte'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl">
          {error}
        </div>
      )}

      {/* Lienzo del Documento Universitario */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/90 space-y-6">
        {/* Metadatos: Materia y Etiquetas */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: selectedSubject?.color || '#94a3b8' }}
            />
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setError(null);
              }}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none cursor-pointer"
              required
            >
              <option value="" disabled>-- Selecciona Materia --</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2">
            <Hash className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Etiquetas: fórmulas, repaso, parcial, unidad 1..."
              className="bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none w-full font-medium"
            />
          </div>
        </div>

        {/* Título en tipografía grande */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del Apunte (ej: Teorema de Nyquist)..."
            className="w-full text-2xl sm:text-4xl font-black text-slate-900 placeholder:text-slate-300 border-none focus:outline-none focus:ring-0 p-0 tracking-tight"
            required
          />
        </div>

        <div className="h-px bg-slate-100" />

        {/* Editor WYSIWYG de Cátedra a página completa */}
        <div>
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Comienza a redactar tu apunte aquí. Puedes usar negrita, listas, citas o insertar fotos de la pizarra..."
          />
        </div>
      </div>

      {/* Botones inferiores de respaldo */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || subjects.length === 0}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? 'Guardando...' : initialData ? 'Actualizar Apunte' : 'Guardar Apunte'}</span>
        </button>
      </div>
    </form>
  );
};
