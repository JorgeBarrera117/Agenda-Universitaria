import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  ArrowLeft,
  Undo2,
  Redo2,
  Plus,
  MoreVertical,
  Camera,
  Image as ImageIcon,
  Minus,
  Quote,
  Hash,
  ChevronDown,
} from 'lucide-react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { RichTextEditor } from './RichTextEditor';
import { Modal } from '../../../shared/components/Modal';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
import type { Editor } from '@tiptap/react';
import type { Note, CreateNoteDTO } from '../types';

interface NoteEditorProps {
  initialData?: Note;
  onSubmit: (data: CreateNoteDTO) => Promise<void>;
  onCancel: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const { subjects } = useSubjects();

  const [title, setTitle] = useState(initialData?.title || '');
  const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [tagInput, setTagInput] = useState(initialData?.tags.join(', ') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Instancia de TipTap capturada para los botones del encabezado
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  // Menús desplegables estilo Google Docs
  const [isInsertMenuOpen, setIsInsertMenuOpen] = useState(false);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);

  // Disparadores de cámara y galería
  const [triggerCamera, setTriggerCamera] = useState<(() => void) | null>(null);
  const [triggerGallery, setTriggerGallery] = useState<(() => void) | null>(null);

  // Sincronizar materia si se edita nota existente
  useEffect(() => {
    if (initialData?.subjectId) {
      setSubjectId(initialData.subjectId);
    }
  }, [initialData]);

  const selectedSubject = subjects.find((s) => s.id === subjectId);

  // Opciones de Asignaturas formateadas para M3Select
  const subjectOptions: M3SelectOption[] = useMemo(
    () =>
      subjects.map((s) => ({
        value: s.id,
        label: s.name,
        sublabel: s.code,
        color: s.color,
        icon: <SubjectBadge icon={s.icon} color={s.color} size="select" />,
      })),
    [subjects]
  );

  // Estadísticas del documento para el menú de opciones (Word Count & Char Count)
  const stats = useMemo(() => {
    const rawText = content.replace(/<[^>]*>/g, ' ').trim();
    const words = rawText ? rawText.split(/\s+/).filter(Boolean).length : 0;
    const chars = content.replace(/<[^>]*>/g, '').length;
    return { words, chars };
  }, [content]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) {
      setError('Escribe un título para tu apunte.');
      return;
    }
    if (!subjectId) {
      setError('Debes elegir una asignatura para clasificar este apunte.');
      setIsOptionsModalOpen(true);
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
    <div className="relative w-full min-h-[100dvh] flex-1 bg-[var(--color-md-card-bg)] text-[var(--color-md-on-surface)] flex flex-col">
      {/* 1. Barra Superior Estilo Google Docs / Material Design 3 (100% ancho borde a borde) */}
      <header
        style={{
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        }}
        className="sticky top-0 shrink-0 w-full z-40 bg-[var(--color-md-surface-container)] border-b border-[var(--color-md-outline-variant)] sm:px-6 py-2.5 flex items-center justify-between shadow-2xs"
      >
        {/* Lado Izquierdo: Botón Checkmark azul circular y Volver */}
        <div className="flex items-center gap-2">
          {/* Botón Guardar / Finalizar Edición (Checkmark ✓ M3 Primary Container) */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || subjects.length === 0}
            aria-label="Guardar apunte y finalizar"
            title="Guardar apunte (✓)"
            className="w-10 h-10 rounded-full bg-[#D0E4FF] text-[#001D32] dark:bg-[#004B76] dark:text-[#D0E4FF] hover:bg-[#b9d7ff] dark:hover:bg-[#005d92] active:scale-90 flex items-center justify-center transition-all cursor-pointer ring-1 ring-[#00639B]/30 shadow-xs disabled:opacity-40 shrink-0"
          >
            <Check className="w-5 h-5 stroke-[2.8]" />
          </button>

          {/* Botón Volver / Descartar */}
          <button
            type="button"
            onClick={onCancel}
            aria-label="Volver sin guardar"
            title="Volver"
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Centro: Indicador discreto del documento */}
        <div className="text-center min-w-0 px-2 flex-1">
          <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 truncate block">
            {isSubmitting
              ? 'Guardando...'
              : title || 'Documento sin título'}
          </span>
        </div>

        {/* Lado Derecho: Deshacer, Rehacer, Insertar (+), y Menú Tres Puntos (⋮) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Deshacer */}
          <button
            type="button"
            onClick={() => editorInstance?.chain().focus().undo().run()}
            disabled={!editorInstance || !editorInstance.can().undo()}
            title="Deshacer (Ctrl+Z)"
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white disabled:opacity-30 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {/* Rehacer */}
          <button
            type="button"
            onClick={() => editorInstance?.chain().focus().redo().run()}
            disabled={!editorInstance || !editorInstance.can().redo()}
            title="Rehacer (Ctrl+Y)"
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white disabled:opacity-30 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Insertar (+) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsInsertMenuOpen(!isInsertMenuOpen)}
              title="Insertar elemento"
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.2]" />
            </button>

            {/* Menú flotante de inserción */}
            {isInsertMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsInsertMenuOpen(false)}
                />
                <div className="absolute right-0 top-10 w-56 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInsertMenuOpen(false);
                      triggerCamera?.();
                    }}
                    className="w-full px-3.5 py-2.5 text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#00639B] dark:text-[#92CCFF]" />
                    <span>Tomar foto de cátedra</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInsertMenuOpen(false);
                      triggerGallery?.();
                    }}
                    className="w-full px-3.5 py-2.5 text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Imagen de galería</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInsertMenuOpen(false);
                      editorInstance?.chain().focus().setHorizontalRule().run();
                    }}
                    className="w-full px-3.5 py-2.5 text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Minus className="w-4 h-4 text-[#72777F] dark:text-[#8C9199]" />
                    <span>Línea divisoria</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInsertMenuOpen(false);
                      editorInstance?.chain().focus().toggleBlockquote().run();
                    }}
                    className="w-full px-3.5 py-2.5 text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Quote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Cita destacada</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Menú de Opciones (Los tres puntos ⋮ estilo Google Docs) */}
          <button
            type="button"
            onClick={() => setIsOptionsModalOpen(true)}
            title="Opciones del apunte"
            aria-label="Más opciones"
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Banner de error discreto si existe */}
      {error && (
        <div className="w-full px-4 pt-3">
          <div className="p-3 text-xs sm:text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* 2. Lienzo de Edición Abierto (100% del ancho y alto disponibles estilo Google Docs) */}
      <div
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
        className="flex-1 w-full sm:px-8 lg:px-12 pt-4 pb-20 flex flex-col"
      >
        {/* Título integrado directamente en el folio de redacción */}
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder="Documento sin título..."
          className="w-full text-2xl sm:text-4xl font-black text-[var(--color-md-on-surface)] placeholder:text-[var(--color-md-on-surface-variant)] placeholder:opacity-55 border-none outline-none focus:ring-0 p-0 tracking-tight leading-tight bg-transparent mb-2.5 shrink-0"
          required
        />

        {/* Píldora interactiva de asignatura y metadatos */}
        <div className="flex items-center flex-wrap gap-2 mb-3 select-none shrink-0">
          <button
            type="button"
            onClick={() => setIsOptionsModalOpen(true)}
            className={
              selectedSubject
                ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-2xs hover:opacity-90 active:scale-95 transition-all cursor-pointer'
                : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 active:scale-95 transition-all cursor-pointer shadow-2xs'
            }
            style={{ backgroundColor: selectedSubject ? selectedSubject.color : undefined }}
            title="Tocar para asignar o cambiar asignatura"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                selectedSubject ? 'bg-white animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{selectedSubject?.name || 'Seleccionar materia *'}</span>
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>

          <span className="text-[11px] font-medium text-[var(--color-md-on-surface-variant)]">
            {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </span>

          {tagInput && (
            <span className="text-[11px] font-medium text-[var(--color-md-on-surface-variant)] truncate max-w-[240px]">
              • #{tagInput.split(',').map((t) => t.trim()).filter(Boolean).join(' #')}
            </span>
          )}
        </div>

        {/* Editor enriquecido TipTap ocupando el 100% del ancho y alto restante */}
        <div className="flex-1 w-full flex flex-col min-h-0">
          <RichTextEditor
            content={content}
            onChange={setContent}
            onEditorReady={setEditorInstance}
            onTriggerCameraReady={(fn) => setTriggerCamera(() => fn)}
            onTriggerGalleryReady={(fn) => setTriggerGallery(() => fn)}
            placeholder="Comienza a redactar tu apunte aquí..."
          />
        </div>
      </div>

      {/* 3. Modal de Opciones del Documento ("Los puntitos para más opciones") */}
      <Modal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        title="Opciones del Apunte"
        maxWidth="sm"
      >
        <div className="space-y-4">
          {/* Asignatura con selector canónico Material Design 3 */}
          <div>
            <M3Select
              label="Materia Asignada"
              value={subjectId}
              onChange={(newVal) => {
                setSubjectId(newVal);
                setError(null);
              }}
              options={subjectOptions}
              placeholder="-- Selecciona una materia --"
              required
            />
          </div>

          {/* Etiquetas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Etiquetas (#Tags)
            </label>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0e1621] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5">
              <Hash className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="resumen, parcial, formulas..."
                className="bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-full font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Separa las palabras clave con comas para encontrarlas al instante.
            </p>
          </div>

          {/* Estadísticas del Documento */}
          <div className="p-3 bg-slate-50 dark:bg-[#0e1621] border border-slate-200/80 dark:border-white/5 rounded-xl space-y-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Detalles del Documento
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Palabras:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{stats.words}</strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Caracteres:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{stats.chars}</strong>
              </div>
            </div>
          </div>

          {/* Botones de acción del modal */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setIsOptionsModalOpen(false);
                onCancel();
              }}
              className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
            >
              Descartar cambios
            </button>

            <button
              type="button"
              onClick={() => setIsOptionsModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-white bg-[#2481cc] hover:bg-[#2AABEE] rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Aceptar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
