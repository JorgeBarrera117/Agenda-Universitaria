import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Check, ArrowLeft, Undo2, Redo2, X, Loader2, AlertTriangle } from 'lucide-react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { RichTextEditor } from './RichTextEditor';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import type { Editor } from '@tiptap/react';
import type { Note, CreateNoteDTO } from '../types';

interface NoteEditorProps {
  initialData?: Note;
  onSubmit: (data: CreateNoteDTO) => Promise<void>;
  onCancel: () => void;
}

const headerIconButton =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface)] transition-all duration-150 ease-out hover:bg-[var(--color-md-surface-container-high)] active:scale-95 disabled:pointer-events-none disabled:opacity-35';

/** Normaliza una etiqueta escrita a mano: sin "#", sin espacios extremos y en minúsculas. */
function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').trim().toLowerCase();
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ initialData, onSubmit, onCancel }) => {
  const { subjects } = useSubjects();

  const [title, setTitle] = useState(initialData?.title || '');
  const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');
  const [prevInitialSubjectId, setPrevInitialSubjectId] = useState(initialData?.subjectId);
  if (initialData?.subjectId !== prevInitialSubjectId) {
    setPrevInitialSubjectId(initialData?.subjectId);
    setSubjectId(initialData?.subjectId || '');
  }

  const [content, setContent] = useState(initialData?.content || '');
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleEditorReady = useCallback((editor: Editor) => {
    setEditorInstance(editor);
  }, []);

  // Ajusta la altura del título a su contenido (también al montarse, vía callback ref)
  const autoSizeTitle = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

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

  // Conteo sobre el texto real del documento (sin etiquetas HTML ni entidades)
  const stats = useMemo(() => {
    const text = (editorInstance ? editorInstance.getText() : content.replace(/<[^>]*>/g, ' ')).trim();
    return {
      words: text ? text.split(/\s+/).filter(Boolean).length : 0,
      chars: text.replace(/\s+/g, ' ').length,
    };
  }, [content, editorInstance]);

  const isDirty =
    title !== (initialData?.title || '') ||
    subjectId !== (initialData?.subjectId || '') ||
    content !== (initialData?.content || '') ||
    tagDraft.trim() !== '' ||
    tags.join('|') !== (initialData?.tags ?? []).join('|');

  // Salir: si hay cambios sin guardar se pide confirmación (también con el botón físico Atrás)
  const handleBack = () => {
    if (showDiscardModal) {
      setShowDiscardModal(false);
    } else if (isDirty) {
      setShowDiscardModal(true);
    } else {
      onCancel();
    }
  };

  useBackButton(() => {
    handleBack();
    return true;
  }, BACK_PRIORITY.MODAL, true);

  const commitTags = (raw: string): string[] => {
    const incoming = raw.split(',').map(normalizeTag).filter(Boolean);
    if (incoming.length === 0) return tags;
    const merged = [...tags];
    for (const tag of incoming) if (!merged.includes(tag)) merged.push(tag);
    setTags(merged);
    setTagDraft('');
    return merged;
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTags(tagDraft);
    } else if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Escribe un título para tu apunte.');
      return;
    }
    if (!subjectId) {
      setError('Elige la materia de este apunte.');
      return;
    }

    const finalTags = commitTags(tagDraft);

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({ title: title.trim(), subjectId, content, tags: finalTags });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el apunte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [createdLabel] = useState(() =>
    (initialData ? new Date(initialData.createdAt) : new Date()).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })
  );

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-1 flex-col bg-[var(--color-md-surface)] text-[var(--color-md-on-surface)]">
      {/* Cabecera: volver · documento y estado · deshacer, rehacer y guardar */}
      <header
        style={{
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
        }}
        className="sticky top-0 z-40 flex w-full shrink-0 items-center gap-1 border-b border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface)]/95 py-2 backdrop-blur-xl sm:gap-2 sm:px-6"
      >
        <button type="button" onClick={handleBack} aria-label="Volver" className={headerIconButton}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm font-bold leading-tight">
            {title.trim() || (initialData ? 'Documento sin título' : 'Nuevo apunte')}
          </p>
          <p className="truncate text-[11px] font-medium text-[var(--color-md-on-surface-variant)]" aria-live="polite">
            {isSubmitting ? 'Guardando…' : isDirty ? 'Cambios sin guardar' : 'Sin cambios'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => editorInstance?.chain().focus().undo().run()}
          disabled={!editorInstance || !editorInstance.can().undo()}
          aria-label="Deshacer"
          title="Deshacer (Ctrl+Z)"
          className={headerIconButton}
        >
          <Undo2 className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => editorInstance?.chain().focus().redo().run()}
          disabled={!editorInstance || !editorInstance.can().redo()}
          aria-label="Rehacer"
          title="Rehacer (Ctrl+Y)"
          className={headerIconButton}
        >
          <Redo2 className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSubmitting || subjects.length === 0}
          className="ml-1 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-md-primary)] px-4 text-sm font-bold text-[var(--color-md-on-primary)] shadow-xs transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4 stroke-[2.8]" aria-hidden="true" />
          )}
          <span>Guardar</span>
        </button>
      </header>

      <ContextualToast message={error} variant="error" bottomOffset="nav" onClose={() => setError(null)} />

      {/* Lienzo: título y metadatos en línea, después el documento */}
      <div
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col pb-28 pt-4 sm:px-6"
      >
        <label htmlFor="note-title" className="sr-only">
          Título del apunte
        </label>
        {/* Textarea de una línea que crece: los títulos largos se ajustan en vez de cortarse */}
        <textarea
          id="note-title"
          ref={autoSizeTitle}
          rows={1}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value.replace(/\n/g, ' '));
            setError(null);
            autoSizeTitle(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              editorInstance?.chain().focus('start').run();
            }
          }}
          placeholder="Título del apunte"
          autoFocus={!initialData}
          enterKeyHint="next"
          className="mb-3 w-full shrink-0 resize-none overflow-hidden border-none bg-transparent p-0 text-2xl font-black leading-tight tracking-tight text-[var(--color-md-on-surface)] outline-none placeholder:text-[var(--color-md-on-surface-variant)] placeholder:opacity-50 focus:ring-0 sm:text-3xl"
        />

        <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
          {subjects.length === 0 ? (
            <span className="rounded-full bg-[var(--color-md-surface-container-high)] px-3 py-1.5 text-xs font-semibold text-[var(--color-md-on-surface)]">
              Crea una materia en la pestaña Materias para guardar apuntes
            </span>
          ) : (
            <M3Select
              variant="pill"
              value={subjectId}
              onChange={(val) => {
                setSubjectId(val);
                setError(null);
              }}
              options={subjectOptions}
              placeholder="Elegir materia *"
            />
          )}
          <span className="text-xs font-medium text-[var(--color-md-on-surface-variant)]">
            {initialData ? `Creado el ${createdLabel}` : `Hoy, ${createdLabel}`}
          </span>
        </div>

        {/* Etiquetas: píldoras editables; Enter o coma para añadir, Retroceso para quitar la última */}
        <div
          onClick={() => tagInputRef.current?.focus()}
          className="mb-3 flex shrink-0 cursor-text flex-wrap items-center gap-1.5 border-b border-[var(--color-md-outline-variant)] pb-3"
        >
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-md-secondary-container)] py-0.5 pl-2.5 pr-1 text-xs font-semibold text-[var(--color-md-on-secondary-container)]"
            >
              #{tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTags(tags.filter((t) => t !== tag));
                }}
                aria-label={`Quitar etiqueta ${tag}`}
                className="flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--color-md-card-bg)]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <label htmlFor="note-tag-input" className="sr-only">
            Añadir etiqueta
          </label>
          <input
            id="note-tag-input"
            ref={tagInputRef}
            type="text"
            value={tagDraft}
            onChange={(e) => {
              const value = e.target.value;
              if (value.includes(',')) commitTags(value);
              else setTagDraft(value);
            }}
            onKeyDown={handleTagKeyDown}
            onBlur={() => commitTags(tagDraft)}
            placeholder={tags.length === 0 ? '#Añadir etiqueta' : '#etiqueta'}
            enterKeyHint="done"
            className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-xs font-medium text-[var(--color-md-on-surface)] outline-none placeholder:text-[var(--color-md-on-surface-variant)] focus:ring-0"
          />
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col">
          <RichTextEditor
            content={content}
            onChange={setContent}
            onEditorReady={handleEditorReady}
            onImageError={setError}
            placeholder="Comienza a redactar tu apunte aquí…"
            statusSlot={
              <span aria-live="off">
                {stats.words} {stats.words === 1 ? 'palabra' : 'palabras'} · {stats.chars}{' '}
                {stats.chars === 1 ? 'carácter' : 'caracteres'}
              </span>
            }
          />
        </div>
      </div>

      <Modal isOpen={showDiscardModal} onClose={() => setShowDiscardModal(false)} title="¿Descartar cambios?" maxWidth="sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm text-[var(--color-md-on-surface-variant)]">
            Tienes cambios sin guardar en este apunte. Si sales ahora, se perderán.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowDiscardModal(false);
              onCancel();
            }}
          >
            Descartar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowDiscardModal(false)}>
            Seguir editando
          </Button>
        </div>
      </Modal>
    </div>
  );
};
