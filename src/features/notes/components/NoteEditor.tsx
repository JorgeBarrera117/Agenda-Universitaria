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
      {/* 1. Botón Flotante para Regresar (Reemplaza la barra superior completa para dar máximo espacio vertical) */}
      <button
        type="button"
        onClick={onCancel}
        aria-label="Volver a mis apuntes"
        title="Volver"
        className="fixed top-3 left-3 sm:top-5 sm:left-6 z-40 w-11 h-11 flex items-center justify-center text-slate-700 hover:text-slate-900 bg-white/95 hover:bg-white border border-slate-200/90 rounded-2xl shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer ring-1 ring-slate-900/5 hover:shadow-lg"
      >
        <ArrowLeft className="w-5 h-5 text-cove-blue" />
      </button>

      {error && (
        <div className="p-3.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 pl-14 sm:pl-4">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Lienzo Continuo de Escritura a Pantalla Completa */}
      <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-200/80 space-y-4">
        {/* Metadatos: Materia y Etiquetas (con margen izquierdo en móvil para no colisionar con el botón flotante) */}
        <div className="flex flex-wrap items-center gap-2.5 pb-2 border-b border-slate-100 pl-12 sm:pl-0">
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 focus-within:ring-2 focus-within:ring-cove-sky rounded-xl px-3 py-1.5 transition-colors">
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

          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 border border-slate-200/80 focus-within:ring-2 focus-within:ring-cove-sky rounded-xl px-3 py-1.5">
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

        {/* Título en tipografía grande sin bordes */}
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

        {/* Editor de Texto con el Menú de Herramientas y Botón Guardar en la Barra Inferior Fija */}
        <div className="pt-1">
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Comienza a redactar tu apunte aquí. Puedes usar negrita, listas, citas o insertar fotos del pizarrón..."
            actionsSlot={
              <button
                type="submit"
                disabled={isSubmitting || subjects.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-black text-white bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue active:scale-95 disabled:opacity-50 rounded-xl shadow-md shadow-cove-blue/25 transition-all cursor-pointer shrink-0"
                title={initialData ? 'Actualizar apunte' : 'Guardar apunte'}
              >
                <Save className="w-4 h-4 text-white shrink-0" />
                <span className="font-bold">
                  {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar' : 'Guardar Apunte'}
                </span>
              </button>
            }
          />
        </div>
      </div>
    </form>
  );
};
