import React, { useState, useEffect } from 'react';
import { Hash, ArrowLeft, Save, ChevronDown } from 'lucide-react';
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
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 animate-in fade-in duration-200 pb-20">
      {/* 1. Barra Superior: Botón circular de Volver y Selector de Materia en píldora */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Volver a mis apuntes"
          title="Volver"
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs flex items-center justify-center text-cove-blue dark:text-cove-sky active:scale-95 transition-all cursor-pointer shrink-0 hover:bg-slate-50 dark:hover:bg-slate-750"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Selector de Materia estilo Píldora */}
        <div className="flex-1 max-w-sm flex items-center gap-2 bg-white dark:bg-slate-850 border border-slate-200/90 dark:border-slate-700 rounded-full px-3.5 py-2 shadow-2xs relative transition-colors">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
            style={{ backgroundColor: selectedSubject?.color || '#0284c7' }}
          />
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setError(null);
            }}
            className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer w-full pr-6 appearance-none truncate"
            required
          >
            <option value="" disabled className="dark:bg-slate-800 dark:text-white">
              -- Selecciona Materia --
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id} className="dark:bg-slate-800 dark:text-white">
                {s.name} {s.code ? `(${s.code})` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
        </div>
      </div>

      {/* 2. Barra de Etiquetas (#resumen, #examen) en píldora horizontal */}
      <div className="w-full flex items-center gap-2 bg-slate-50/90 dark:bg-slate-850/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl sm:rounded-full px-3.5 py-2 transition-colors">
        <Hash className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Etiquetas (#resumen, #examen)..."
          className="bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none w-full font-medium"
        />
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. Lienzo Continuo de Escritura con Esquinas Redondeadas Suaves */}
      <div className="bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-3xl p-5 sm:p-8 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-3 sm:space-y-4">
        {/* Título en tipografía grande sin bordes */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del apunte..."
            className="w-full text-2xl sm:text-3xl font-black text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 border-none focus:outline-none focus:ring-0 p-0 tracking-tight leading-tight bg-transparent"
            required
          />
        </div>

        {/* Editor de Texto con Barra de Herramientas Inferior de 2 Filas */}
        <div className="pt-1">
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Comienza a redactar tu apunte aquí. Puedes usar negrita, listas, citas o insertar fotos del pizarrón..."
            actionsSlot={
              <button
                type="submit"
                disabled={isSubmitting || subjects.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue active:scale-95 disabled:opacity-50 rounded-2xl shadow-md shadow-cove-blue/25 transition-all cursor-pointer shrink-0"
                title={initialData ? 'Actualizar apunte' : 'Guardar apunte'}
              >
                <Save className="w-4 h-4 text-white shrink-0" />
                <span>
                  {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar Apunte' : 'Guardar Apunte'}
                </span>
              </button>
            }
          />
        </div>
      </div>
    </form>
  );
};
