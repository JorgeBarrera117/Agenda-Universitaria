import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Undo2, Redo2, X, Loader2, AlertTriangle, Share2, FileText, FileDown, FileCode2, Printer, Maximize2, Minimize2, AlignLeft } from 'lucide-react';
import { PAGE_HEADER_ICON_BUTTON, PageHeader } from '../../../shared/components/PageHeader';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { RichTextEditor, type EditorCommand } from './RichTextEditor';
import { SHEET_PAGE } from '../extensions/Pagination';
import { VoiceNotesSection, VoiceRecorderModal } from './VoiceNotes';
import { useNoteAudios } from '../hooks/useNoteAudios';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import { useExitTransition, MOTION_EXIT_MS } from '../../../shared/hooks/useExitTransition';
import type { Editor } from '@tiptap/react';
import type { Note, CreateNoteDTO, NoteAudio } from '../types';
import { insertBlockNodeInView } from '../utils/editorInsert';
import { getEmbeddedAudioIds } from '../utils/voiceNoteEmbeds';
import { exportNoteToAgnote } from '../services/noteShareService';
import { forgetOpenNote, rememberOpenNote } from '../utils/openNoteMemory';
import {
  PERSONAL_CHOICE,
  PERSONAL_COLOR,
  PERSONAL_ICON,
  PERSONAL_LABEL,
  choiceToSubjectId,
  subjectIdToChoice,
} from '../utils/personalNotes';

interface NoteEditorProps {
  initialData?: Note;
  /**
   * Guarda y devuelve la nota guardada; el editor sigue abierto sobre ella. Sin `noteId` crea el
   * apunte; con él lo actualiza (el editor lleva el id, así dos guardados seguidos no duplican).
   */
  onSubmit: (data: CreateNoteDTO, noteId?: string) => Promise<Note>;
  /** Borra un apunte que el autoguardado creó en esta edición y que quedó vacío al salir. */
  onDiscardEmpty?: (noteId: string) => Promise<void>;
  onCancel: () => void;
  /** Clasificación preelegida de un apunte nuevo (la del filtro abierto): id de materia o «personal». */
  defaultSubjectChoice?: string;
}

/** Tableta y PC: el mismo corte que usa el Horario (Semana en PC, Día en el teléfono). */
const WIDE_QUERY = '(min-width: 768px)';

const isWideScreen = (): boolean => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches;

/** La vista elegida se recuerda por separado en el teléfono y en la PC. */
const sheetViewKey = (): string => `agenda_note_view_${isWideScreen() ? 'wide' : 'phone'}`;

/**
 * Vista con la que se abre un apunte: la última elegida en este tipo de pantalla o, si nunca se
 * eligió, la predeterminada: Normal en el teléfono (se escribe cómodo) y Hoja en la PC (como Word).
 */
function readSheetViewPreference(): boolean {
  try {
    const saved = localStorage.getItem(sheetViewKey());
    if (saved === 'sheet') return true;
    if (saved === 'normal') return false;
  } catch {
    // Sin almacenamiento: se usa la predeterminada
  }
  return isWideScreen();
}

/** Espera tras la última tecla antes de autoguardar: sin escrituras por cada letra. */
const AUTOSAVE_DELAY_MS = 1200;

interface NoteSnapshot {
  title: string;
  subjectChoice: string;
  content: string;
  tags: string[];
}

/** Normaliza una etiqueta escrita a mano: sin "#", sin espacios extremos y en minúsculas. */
function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').trim().toLowerCase();
}

/** Título de respaldo de un apunte sin título: su primera línea de texto (o uno genérico). */
function fallbackTitle(plainText: string): string {
  const firstLine = plainText.split('\n').find((line) => line.trim())?.trim() ?? '';
  if (!firstLine) return 'Apunte sin título';
  return firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}…` : firstLine;
}

/** ¿No hay nada escrito? (sin título, sin texto ni fotos y sin etiquetas) */
function isDocumentEmpty(snapshot: NoteSnapshot, editor: Editor | null): boolean {
  const bodyEmpty = editor ? editor.isEmpty : !snapshot.content.replace(/<[^>]*>/g, '').trim();
  return !snapshot.title.trim() && bodyEmpty && snapshot.tags.length === 0;
}

function sameSnapshot(a: NoteSnapshot, b: NoteSnapshot): boolean {
  return a.title === b.title && a.subjectChoice === b.subjectChoice && a.content === b.content && a.tags.join('|') === b.tags.join('|');
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ initialData, onSubmit, onDiscardEmpty, onCancel, defaultSubjectChoice }) => {
  const { subjects } = useSubjects();
  // Valor del selector: id de la materia, «personal» o '' (aún sin elegir)
  const [initialChoice] = useState(() => (initialData ? subjectIdToChoice(initialData.subjectId) : (defaultSubjectChoice ?? '')));

  const [title, setTitle] = useState(initialData?.title || '');
  const [subjectChoice, setSubjectChoice] = useState(initialChoice);
  const [content, setContent] = useState(initialData?.content || '');
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  // Guardados en curso (el autoguardado puede encadenar varios)
  const [pendingSaves, setPendingSaves] = useState(0);
  const isSubmitting = pendingSaves > 0;
  const [saveFailed, setSaveFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Solo si el guardado falla al salir: ¿salir igual o seguir intentando?
  const [showSaveFailedModal, setShowSaveFailedModal] = useState(false);
  // Nota sobre la que se trabaja: tras el primer guardado de un apunte nuevo ya tiene id
  const [activeNote, setActiveNote] = useState<Note | undefined>(initialData);
  // Lo último guardado: "Guardando…" se mide contra esto, no contra cómo se abrió
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<NoteSnapshot>(() => ({
    title: initialData?.title || '',
    // Un apunte nuevo con la clasificación preelegida no cuenta como cambio
    subjectChoice: initialChoice,
    content: initialData?.content || '',
    tags: initialData?.tags ?? [],
  }));
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  // Modo enfoque: solo el texto (sin materia, etiquetas ni notas de voz sueltas)
  const [isFocusMode, setIsFocusMode] = useState(false);
  // Vista de hoja (diseño de impresión): se recuerda entre apuntes
  const [isSheetView, setIsSheetView] = useState(readSheetViewPreference);
  const [isExporting, setIsExporting] = useState(false);
  // Escala de la hoja A4: 1 si cabe en pantalla; menos en el teléfono (se ve entera, como en Word)
  const sheetWrapperRef = useRef<HTMLDivElement>(null);
  const [sheetZoom, setSheetZoom] = useState(1);
  useEffect(() => {
    const wrapper = sheetWrapperRef.current;
    if (!isSheetView || !wrapper) return;
    const observer = new ResizeObserver(([entry]) => {
      const zoom = Math.min(1, Math.max(0.3, entry.contentRect.width / SHEET_PAGE.widthPx));
      setSheetZoom(Math.round(zoom * 1000) / 1000);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [isSheetView]);
  // Notas de voz del apunte (necesitan que el apunte exista: uno nuevo se guarda antes de grabar)
  const { audios, addAudio, renameAudio, removeAudio } = useNoteAudios(activeNote?.id);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

  // Las grabaciones que ya están dentro del texto no se repiten en la sección de arriba
  const looseAudios = useMemo(() => {
    const embedded = getEmbeddedAudioIds(content);
    return audios.filter((audio) => !embedded.has(audio.id));
  }, [audios, content]);

  /** Pone el reproductor de una nota de voz en el cursor del texto. */
  const insertVoiceNote = useCallback(
    (audio: Pick<NoteAudio, 'id' | 'name'>) => {
      const type = editorInstance?.schema.nodes.voiceNote;
      if (!editorInstance || !type) return;
      insertBlockNodeInView(editorInstance.view, type.create({ audioId: audio.id, name: audio.name }));
    },
    [editorInstance]
  );
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

  // «Personal» primero: está siempre, aunque el estudiante aún no tenga materias
  const subjectOptions: M3SelectOption[] = useMemo(
    () => [
      {
        value: PERSONAL_CHOICE,
        label: PERSONAL_LABEL,
        color: PERSONAL_COLOR,
        icon: <SubjectBadge icon={PERSONAL_ICON} color={PERSONAL_COLOR} size="select" />,
      },
      ...subjects.map((s) => ({
        value: s.id,
        label: s.name,
        sublabel: s.code,
        color: s.color,
        icon: <SubjectBadge icon={s.icon} color={s.color} size="select" />,
      })),
    ],
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

  // La etiqueta a medio escribir no cuenta: se guarda al confirmarla (Enter, coma o al salir del campo)
  const isDirty = !sameSnapshot({ title, subjectChoice, content, tags }, lastSavedSnapshot);

  const { isClosing, runExit } = useExitTransition(MOTION_EXIT_MS.sheet);

  // ── Autoguardado ────────────────────────────────────────────────────────────────────────────
  // Todo lo que se escribe se guarda solo en IndexedDB: 1,2 s después de la última tecla, al
  // pasar la app a segundo plano y al salir. Así, si Android cierra la app mientras está en
  // segundo plano, no se pierde nada. Los guardados van en cadena (uno tras otro) y el editor
  // lleva el id de la nota, de modo que un apunte nuevo se crea una sola vez.
  const latestRef = useRef<NoteSnapshot>({ title, subjectChoice, content, tags });
  const savedRef = useRef<NoteSnapshot>(lastSavedSnapshot);
  const noteIdRef = useRef<string | undefined>(initialData?.id);
  // ¿El autoguardado creó el apunte en esta edición? (si al salir quedó vacío, se borra)
  const createdHereRef = useRef(false);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const onSubmitRef = useRef(onSubmit);
  const editorRef = useRef<Editor | null>(null);
  const exitingRef = useRef(false);
  useEffect(() => {
    latestRef.current = { title, subjectChoice, content, tags };
    onSubmitRef.current = onSubmit;
    editorRef.current = editorInstance;
  });

  /**
   * Guarda lo que hay en pantalla si cambió. `override` permite incluir algo que aún no llegó al
   * estado (la etiqueta recién confirmada); `force` crea el apunte aunque esté vacío (para grabar
   * una nota de voz hace falta que exista). Devuelve si quedó todo guardado.
   */
  const persist = useCallback((options: { override?: Partial<NoteSnapshot>; force?: boolean } = {}): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const snapshot: NoteSnapshot = { ...latestRef.current, ...options.override };
      const hasId = Boolean(noteIdRef.current);
      if (hasId && sameSnapshot(snapshot, savedRef.current)) return true;
      // Un apunte nuevo sin nada escrito no se crea (salvo que haga falta para la nota de voz)
      if (!hasId && !options.force && isDocumentEmpty(snapshot, editorRef.current)) return true;
      if (!hasId && !options.force && sameSnapshot(snapshot, savedRef.current)) return true;

      // Sin materia elegida va a «Personal», y queda así a la vista para que se pueda cambiar
      const choice = snapshot.subjectChoice || PERSONAL_CHOICE;
      const saved = { ...snapshot, subjectChoice: choice };
      setPendingSaves((n) => n + 1);
      try {
        const note = await onSubmitRef.current(
          {
            title: snapshot.title.trim() || fallbackTitle(editorRef.current?.getText() ?? snapshot.content.replace(/<[^>]*>/g, ' ')),
            subjectId: choiceToSubjectId(choice),
            content: snapshot.content,
            tags: snapshot.tags,
          },
          noteIdRef.current
        );
        if (!noteIdRef.current) createdHereRef.current = true;
        noteIdRef.current = note.id;
        rememberOpenNote(note.id);
        setActiveNote(note);
        if (!snapshot.subjectChoice) setSubjectChoice(choice);
        savedRef.current = saved;
        setLastSavedSnapshot(saved);
        setLastSavedTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
        setSaveFailed(false);
        return true;
      } catch (err: unknown) {
        setSaveFailed(true);
        setError(err instanceof Error ? err.message : 'No se pudo guardar el apunte.');
        return false;
      } finally {
        setPendingSaves((n) => n - 1);
      }
    };
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next;
    return next;
  }, []);

  // 1,2 s después del último cambio
  useEffect(() => {
    if (!isDirty) return;
    const timer = window.setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isDirty, title, subjectChoice, content, tags, persist]);

  // Al pasar a segundo plano (cambiar de app, apagar la pantalla) o cerrar la ventana: ya mismo
  useEffect(() => {
    const flush = () => void persist();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      // Si el editor se desmonta por otra vía, lo pendiente también se guarda
      flush();
    };
  }, [persist]);

  const leaveEditor = () => {
    forgetOpenNote();
    if (isFocusMode) exitDesktopFullscreen();
    runExit(onCancel);
  };

  // Salir: guarda lo pendiente y vuelve (ya no hay «¿Descartar cambios?»: todo se guarda solo)
  const handleBack = () => {
    if (showSaveFailedModal) setShowSaveFailedModal(false);
    else void saveAndLeave();
  };

  const saveAndLeave = async () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    const finalTags = commitTags(tagDraft);
    const ok = await persist({ override: { tags: finalTags } });
    if (!ok) {
      exitingRef.current = false;
      setShowSaveFailedModal(true);
      return;
    }
    // Un apunte que se creó solo y al final quedó vacío no se deja en la lista
    const noteId = noteIdRef.current;
    if (noteId && createdHereRef.current && isDocumentEmpty({ ...latestRef.current, tags: finalTags }, editorRef.current) && onDiscardEmpty) {
      try {
        await onDiscardEmpty(noteId);
      } catch (err) {
        console.warn('No se pudo borrar el apunte vacío:', err);
      }
    }
    leaveEditor();
  };

  useBackButton(() => {
    handleBack();
    return true;
  }, BACK_PRIORITY.MODAL, true);

  // Modo enfoque: oculta materia, etiquetas y notas de voz sueltas; en PC además pantalla completa
  const canUseDesktopFullscreen = !Capacitor.isNativePlatform() && typeof document !== 'undefined' && document.fullscreenEnabled;
  function exitDesktopFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }
  const toggleFocusMode = () => {
    const next = !isFocusMode;
    setIsFocusMode(next);
    if (!canUseDesktopFullscreen) return;
    if (next) void document.documentElement.requestFullscreen().catch(() => undefined);
    else exitDesktopFullscreen();
  };
  // Salir de la pantalla completa con Esc también termina el modo enfoque
  useEffect(() => {
    if (!isFocusMode || !canUseDesktopFullscreen) return;
    const onChange = () => {
      if (!document.fullscreenElement) setIsFocusMode(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [isFocusMode, canUseDesktopFullscreen]);

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
        subjectId: choiceToSubjectId(subjectChoice),
        title: title.trim() || 'Apunte',
        content,
        tags: commitTags(tagDraft),
        createdAt: activeNote?.createdAt ?? now,
        updatedAt: now,
      };
      const result = await exportNoteToAgnote(draft, subjects.find((s) => s.id === subjectChoice));
      if (result.method === 'download') setShareNotice(`Apunte descargado: ${result.fileName}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo compartir el apunte.');
    } finally {
      setIsSharing(false);
    }
  };

  const noteTitleForFiles = () => title.trim() || fallbackTitle(editorInstance?.getText() ?? '');

  const toggleSheetView = () => {
    const next = !isSheetView;
    setIsSheetView(next);
    try {
      localStorage.setItem(sheetViewKey(), next ? 'sheet' : 'normal');
    } catch {
      // Sin almacenamiento: solo no se recuerda para el próximo apunte
    }
  };

  /** Exporta lo que se ve en pantalla (aunque falte el último autoguardado). */
  const handleExport = async (kind: 'docx' | 'md') => {
    if (!editorInstance) return;
    setIsExporting(true);
    try {
      const { exportNoteDocx, exportNoteMarkdown } = await import('../services/noteExportService');
      const name = noteTitleForFiles();
      const result = kind === 'docx' ? await exportNoteDocx(name, editorInstance.getJSON()) : await exportNoteMarkdown(name, content);
      if (result.method === 'download') setShareNotice(`Descargado: ${result.fileName}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el apunte.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    setIsExporting(true);
    try {
      const { printNote } = await import('../services/notePrintService');
      const subjectLabel = subjectOptions.find((option) => option.value === subjectChoice)?.label ?? PERSONAL_LABEL;
      const created = activeNote ? new Date(activeNote.createdAt) : new Date();
      const dateLabel = created.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const meta = [subjectLabel, dateLabel, ...(tags.length > 0 ? [tags.map((tag) => `#${tag}`).join(' ')] : [])].join(' · ');
      await printNote(noteTitleForFiles(), content, meta);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo imprimir el apunte.');
    } finally {
      setIsExporting(false);
    }
  };

  // Apartados «Vista» y «Archivo» de la barra del editor (los mismos comandos que el menú ⋮)
  const viewCommands: EditorCommand[] = [
    { id: 'sheet', label: 'Vista de hoja', icon: FileText, run: toggleSheetView, isActive: isSheetView },
    { id: 'focus', label: 'Modo enfoque', icon: isFocusMode ? Minimize2 : Maximize2, run: toggleFocusMode, isActive: isFocusMode },
  ];
  const fileCommands: EditorCommand[] = [
    { id: 'share', label: 'Compartir', icon: Share2, run: () => void handleShare(), disabled: isSharing },
    { id: 'docx', label: 'Word', icon: FileDown, run: () => void handleExport('docx'), disabled: isExporting },
    { id: 'md', label: 'Markdown', icon: FileCode2, run: () => void handleExport('md'), disabled: isExporting },
    { id: 'print', label: 'Imprimir o PDF', icon: Printer, run: () => void handlePrint(), disabled: isExporting },
  ];

  const handleRecordVoice = async () => {
    // La grabación se adjunta a un apunte que exista: uno nuevo se crea primero (aunque esté vacío)
    if (noteIdRef.current || (await persist({ force: true }))) setIsRecorderOpen(true);
  };

  const [createdLabel] = useState(() =>
    (initialData ? new Date(initialData.createdAt) : new Date()).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })
  );

  return (
    <div
      className={`relative flex min-h-[100dvh] w-full flex-1 flex-col text-[var(--color-md-on-surface)] ${isSheetView ? 'bg-transparent' : 'bg-[var(--color-md-surface)]'} ${
        isClosing ? 'm3-sheet-exit' : 'm3-sheet-enter'
      }`}
    >
      {/* Encabezado fijo con el estilo de Ajustes: volver · documento y estado del autoguardado ·
          deshacer, rehacer y el cambio de vista (normal u hoja). Compartir, exportar e imprimir
          están en el apartado «Archivo» de la barra; no hay botón Guardar porque todo se guarda solo. El editor ocupa todo el ancho (sin margen del <main>),
          así que la franja usa su propio relleno lateral respetando el área segura. */}
      <PageHeader
        title={title.trim() || (activeNote ? 'Documento sin título' : 'Nuevo apunte')}
        subtitle={
          <span aria-live="polite">
            {saveFailed && !isSubmitting
              ? 'No se pudo guardar'
              : isSubmitting || isDirty
                ? 'Guardando…'
                : lastSavedTime
                  ? `Guardado automáticamente · ${lastSavedTime}`
                  : 'Autoguardado activo'}
          </span>
        }
        onBack={handleBack}
        backLabel="Volver"
        className="mx-auto w-full max-w-3xl shrink-0 sm:px-6"
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
            {(isSharing || isExporting) && (
              <span className={PAGE_HEADER_ICON_BUTTON} role="status" aria-label="Preparando el archivo…">
                <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
              </span>
            )}
            {/* Cambio de vista: Normal (texto a todo el ancho) u Hoja (páginas A4, como Word).
                En teléfonos angostos (< 400px) quedan solo los íconos */}
            <div role="radiogroup" aria-label="Vista del apunte" className="ml-1 flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--color-md-surface-container-high)] p-0.5">
              {(
                [
                  { sheet: false, label: 'Normal', title: 'Vista normal', icon: AlignLeft },
                  { sheet: true, label: 'Hoja', title: 'Vista de hoja (A4)', icon: FileText },
                ] as const
              ).map((option) => {
                const selected = isSheetView === option.sheet;
                const OptionIcon = option.icon;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.title}
                    title={option.title}
                    onClick={() => {
                      if (!selected) toggleSheetView();
                    }}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors duration-150 active:scale-95 max-[399px]:px-2.5 ${
                      selected
                        ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-xs'
                        : 'text-[var(--color-md-on-surface-variant)] hover:text-[var(--color-md-on-surface)]'
                    }`}
                  >
                    <OptionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="max-[399px]:sr-only">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        }
      />

      <ContextualToast message={error} variant="error" bottomOffset="nav" onClose={() => setError(null)} />
      <ContextualToast message={shareNotice} bottomOffset="nav" onClose={() => setShareNotice(null)} />

      {/* Lienzo: título y metadatos en línea, después el documento. En vista de hoja, todo va en
          hojas A4 reales (21 × 29,7 cm, márgenes de 2 cm) que pagina extensions/Pagination.ts; en
          pantallas angostas la hoja se ve a escala, como el diseño de impresión de Word móvil */}
      <div ref={sheetWrapperRef} className={isSheetView ? 'flex flex-1 flex-col px-2 pb-28 pt-4 sm:px-6 sm:pt-6' : 'flex flex-1 flex-col'}>
      <div
        style={
          isSheetView
            ? { zoom: sheetZoom }
            : {
                paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
              }
        }
        className={
          isSheetView
            ? 'note-sheet mx-auto flex w-[21cm] shrink-0 flex-col p-[2cm]'
            : 'mx-auto flex w-full max-w-3xl flex-1 flex-col pb-28 pt-4 sm:px-6'
        }
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

        {/* En modo enfoque solo queda el título y el texto */}
        {!isFocusMode && (
        <>
        <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
          <M3Select
            variant="pill"
            value={subjectChoice}
            onChange={(val) => {
              setSubjectChoice(val);
              setError(null);
            }}
            options={subjectOptions}
            placeholder="Materia o personal *"
          />
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

        {/* Notas de voz del apunte (solo aparecen cuando hay alguna) */}
        <VoiceNotesSection
          audios={looseAudios}
          title="Notas de voz fuera del texto"
          onRecord={() => void handleRecordVoice()}
          onRename={renameAudio}
          onDelete={removeAudio}
          onInsert={insertVoiceNote}
          className="mb-4 shrink-0"
        />
        </>
        )}

        <div className="flex min-h-0 w-full flex-1 flex-col">
          <RichTextEditor
            content={content}
            onChange={setContent}
            onEditorReady={handleEditorReady}
            onImageError={setError}
            toolbarMotionClass={isClosing ? 'm3-sheet-exit' : 'm3-sheet-enter'}
            onRecordVoice={() => void handleRecordVoice()}
            viewCommands={viewCommands}
            fileCommands={fileCommands}
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
      </div>

      <VoiceRecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        saveLabel="Poner en el apunte"
        onSave={async ({ blob, mimeType, durationMs, name }) => {
          const audio = await addAudio(blob, mimeType, durationMs, name);
          // Va al texto, donde estaba el cursor; después se puede mover como una foto
          insertVoiceNote(audio);
          setShareNotice('Nota de voz añadida al texto. Tócala para moverla.');
        }}
      />

      {/* Solo si falla el guardado al salir (p. ej. el apunte se eliminó desde otro lado) */}
      <Modal isOpen={showSaveFailedModal} onClose={() => setShowSaveFailedModal(false)} title="No se pudo guardar" maxWidth="sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm text-[var(--color-md-on-surface-variant)]">
            Los últimos cambios de este apunte no se pudieron guardar. Si sales ahora, se perderán.
          </p>
        </div>
        <ModalActions layout="stack">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowSaveFailedModal(false);
              leaveEditor();
            }}
          >
            Salir sin guardar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSaveFailedModal(false)}>
            Seguir editando
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            onClick={() => {
              setShowSaveFailedModal(false);
              void saveAndLeave();
            }}
          >
            Reintentar
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
};
