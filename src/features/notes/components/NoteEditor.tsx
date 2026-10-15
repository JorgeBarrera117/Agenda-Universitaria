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
    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-200">
      {/* 1. BARRA SUPERIOR DE NAVEGACIÓN Y ACCIÓN UNIFICADA (Jerarquía, Proximidad y Consistencia) */}
      <header className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-slate-100/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between gap-3">
        {/* Botón de retorno táctil accesible (mínimo 44x44px según WCAG) */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Volver al cuaderno"
          title="Volver"
          className="w-10 h-10 flex items-center justify-center text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl shadow-2xs transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 text-indigo-600" />
        </button>

        {/* Indicador de contexto sutil */}
        <div className="hidden sm:block text-xs font-bold text-slate-500 uppercase tracking-wider">
          {initialData ? 'Modo Edición' : 'Nuevo Documento'}
        </div>

        {/* Acciones principales unificadas (Sin duplicados al pie) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Descartar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || subjects.length === 0}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 rounded-xl shadow-sm shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Guardando...' : initialData ? 'Actualizar' : 'Guardar Apunte'}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="p-3.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. LIENZO CONTINUO DE ESCRITURA (Alineación y Eliminación de marcos anidados innecesarios) */}
      <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200/80 space-y-4">
        {/* Metadatos compactos: Materia y Etiquetas (Divulgación progresiva) */}
        <div className="flex flex-wrap items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl px-3 py-1.5 transition-colors">
            <span
              className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: selectedSubject?.color || '#94a3b8' }}
            />
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setError(null);
              }}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
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

          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5">
            <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Etiquetas (#resumen, #examen)..."
              className="bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none w-full font-medium"
            />
          </div>
        </div>

        {/* Título en tipografía grande (Jerarquía: contenido principal primero) */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del apunte..."
            className="w-full text-2xl sm:text-3xl font-black text-slate-900 placeholder:text-slate-300 border-none focus:outline-none focus:ring-0 p-0 tracking-tight leading-tight"
            required
          />
        </div>

        {/* Editor WYSIWYG integrado sin dobles marcos */}
        <div className="pt-1">
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Comienza a redactar tu apunte aquí. Puedes usar negrita, listas, citas o insertar fotos del pizarrón..."
          />
        </div>
      </div>
    </form>
  );
};
