import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Check, Undo2, Redo2, X, Loader2, AlertTriangle, Share2 } from 'lucide-react';
import { PAGE_HEADER_ICON_BUTTON, PAGE_HEADER_PRIMARY_BUTTON, PageHeader } from '../../../shared/components/PageHeader';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { RichTextEditor } from './RichTextEditor';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import { useExitTransition, MOTION_EXIT_MS } from '../../../shared/hooks/useExitTransition';
import type { Editor } from '@tiptap/react';
import type { Note, CreateNoteDTO } from '../types';
import { exportNoteToAgnote } from '../services/noteShareService';

interface NoteEditorProps {
  initialData?: Note;
  /** Guarda y devuelve la nota guardada; el editor sigue abierto sobre ella. */
  onSubmit: (data: CreateNoteDTO) => Promise<Note | void>;
  onCancel: () => void;
}

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
  // Nota sobre la que se trabaja: tras el primer guardado de un apunte nuevo ya tiene id
  const [activeNote, setActiveNote] = useState<Note | undefined>(initialData);
  // Lo último guardado: "Cambios sin guardar" se mide contra esto, no contra cómo se abrió
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState({
    title: initialData?.title || '',
    subjectId: initialData?.subjectId || '',
    content: initialData?.content || '',
    tags: initialData?.tags ?? [],
  });
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

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
    title !== lastSavedSnapshot.title ||
    subjectId !== lastSavedSnapshot.subjectId ||
    content !== lastSavedSnapshot.content ||
    tagDraft.trim() !== '' ||
    tags.join('|') !== lastSavedSnapshot.tags.join('|');

  const { isClosing, runExit } = useExitTransition(MOTION_EXIT_MS.sheet);

  // Salir: si hay cambios sin guardar se pide confirmación (también con el botón físico Atrás)
  const handleBack = () => {
    if (showDiscardModal) {
      setShowDiscardModal(false);
    } else if (isDirty) {
      setShowDiscardModal(true);
    } else {
      runExit(onCancel);
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

  // Compartir lo que se ve en pantalla (aunque no esté guardado) como archivo .agnote
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const handleShare = async () => {
    if (!title.trim() && !content.trim()) {
      setError('Escribe algo en el apunte antes de compartirlo.');
      return;
    }
    setIsSharing(true);
    try {
      const now = new Date().toISOString();
      const draft: Note = {
        // Con el id real se incluyen también las fotos adjuntas del apunte guardado
        id: activeNote?.id ?? 'borrador',
        subjectId,
        title: title.trim() || 'Apunte',
        content,
        tags: commitTags(tagDraft),
        createdAt: activeNote?.createdAt ?? now,
        updatedAt: now,
      };
      const result = await exportNoteToAgnote(draft, subjects.find((s) => s.id === subjectId));
      if (result.method === 'download') setShareNotice(`Apunte descargado: ${result.fileName}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo compartir el apunte.');
    } finally {
      setIsSharing(false);
    }
  };

  /** Guarda sin salir del editor. Devuelve si se guardó (para "Guardar y salir"). */
  const handleSave = async (): Promise<boolean> => {
    if (!title.trim()) {
      setError('Escribe un título para tu apunte.');
      return false;
    }
    if (!subjectId) {
      setError('Elige la materia de este apunte.');
      return false;
    }

    const finalTags = commitTags(tagDraft);

    try {
      setIsSubmitting(true);
      setError(null);
      const saved = await onSubmit({ title: title.trim(), subjectId, content, tags: finalTags });
      if (saved) setActiveNote(saved);
      // Se compara con lo que hay en pantalla (el título sin recortar) para que quede "sin cambios"
      setLastSavedSnapshot({ title, subjectId, content, tags: finalTags });
      setLastSavedTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el apunte.');
      return false;
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
    <div
      className={`relative flex min-h-[100dvh] w-full flex-1 flex-col bg-[var(--color-md-surface)] text-[var(--color-md-on-surface)] ${
        isClosing ? 'm3-sheet-exit' : 'm3-sheet-enter'
      }`}
    >
      {/* Encabezado fijo con el estilo de Ajustes: volver · documento y estado · deshacer,
          rehacer, compartir y guardar. El editor ocupa todo el ancho (sin margen del <main>),
          así que la franja usa su propio relleno lateral respetando el área segura. */}
      <PageHeader
        title={title.trim() || (activeNote ? 'Documento sin título' : 'Nuevo apunte')}
        subtitle={
          <span aria-live="polite">
            {isSubmitting
              ? 'Guardando…'
              : isDirty
                ? 'Cambios sin guardar'
                : lastSavedTime
                  ? `Guardado a las ${lastSavedTime} ✓`
                  : 'Sin cambios'}
          </span>
        }
        onBack={handleBack}
        backLabel="Volver"
        className="w-full shrink-0 sm:px-6"
        style={{
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
        }}
        actions={
          <>
            <button
              type="button"
              onClick={() => editorInstance?.chain().focus().undo().run()}
              disabled={!editorInstance || !editorInstance.can().undo()}
              aria-label="Deshacer"
              title="Deshacer (Ctrl+Z)"
              className={PAGE_HEADER_ICON_BUTTON}
            >
              <Undo2 className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => editorInstance?.chain().focus().redo().run()}
              disabled={!editorInstance || !editorInstance.can().redo()}
              aria-label="Rehacer"
              title="Rehacer (Ctrl+Y)"
              className={PAGE_HEADER_ICON_BUTTON}
            >
              <Redo2 className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={isSharing}
              aria-label="Compartir apunte"
              title="Compartir apunte (.agnote)"
              className={PAGE_HEADER_ICON_BUTTON}
            >
              {isSharing ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
              ) : (
                <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSubmitting || subjects.length === 0}
              className={`ml-1 ${PAGE_HEADER_PRIMARY_BUTTON} max-[399px]:w-9 max-[399px]:justify-center max-[399px]:px-0`}
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5 stroke-[2.8]" aria-hidden="true" />
              )}
              {/* En teléfonos angostos (< 400px) queda solo el ✓ para dar espacio al título;
                  el texto sigue disponible para lectores de pantalla */}
              <span className="max-[399px]:sr-only">Guardar</span>
            </button>
          </>
        }
      />

      <ContextualToast message={error} variant="error" bottomOffset="nav" onClose={() => setError(null)} />
      <ContextualToast message={shareNotice} bottomOffset="nav" onClose={() => setShareNotice(null)} />

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
            toolbarMotionClass={isClosing ? 'm3-sheet-exit' : 'm3-sheet-enter'}
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
            Tienes cambios sin guardar en este apunte. Si sales sin guardar, se perderán.
          </p>
        </div>
        <ModalActions layout="stack">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowDiscardModal(false);
              runExit(onCancel);
            }}
          >
            Descartar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDiscardModal(false)}>
            Seguir editando
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            onClick={async () => {
              setShowDiscardModal(false);
              // Solo sale si de verdad se guardó (falta de título o materia: se queda y lo indica)
              if (await handleSave()) runExit(onCancel);
            }}
          >
            Guardar y salir
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
};
