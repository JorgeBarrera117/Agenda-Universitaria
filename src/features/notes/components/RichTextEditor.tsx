import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import {
  DEFAULT_HIGHLIGHT,
  HIGHLIGHT_COLORS,
  NoteHighlight,
  isHighlightColor,
  type HighlightColor,
} from '../extensions/NoteHighlight';
import { NodeSelection, Selection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import {
  MAX_IMAGE_WIDTH,
  MIN_IMAGE_WIDTH,
  NoteImage,
  SIDE_IMAGE_DEFAULT_WIDTH,
  clampImageWidth,
  type ImageAlign,
  type NoteImageAttrs,
} from '../extensions/NoteImage';
import { VoiceNoteNode } from '../extensions/VoiceNoteNode';
import { findNodePos, insertBlockNodeInView, moveBlockNodeInView } from '../utils/editorInsert';
import { ImageEditModal } from './ImageEditModal';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eraser,
  Highlighter,
  ClipboardPaste,
  Copy,
  Scissors,
  Trash2,
  X,
  ZoomIn,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  Camera,
  Image as ImageIcon,
  Mic,
  Loader2,
  Heading1,
  Heading2,
  Move,
  Scaling,
  PenLine,
  ArrowDownToLine,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
} from 'lucide-react';
import { compressImage } from '../utils/imageCompression';
import { IMAGE_ACCEPT, isImageFile } from '../../../shared/utils/imageFormats';
import { ImageZoomModal } from '../../../shared/components/ImageZoomModal';
import { Capacitor } from '@capacitor/core';
import {
  blobToDataUrl,
  copyImageToSystemClipboard,
  readImageFromSystemClipboard,
  type ImageCopyResult,
} from '../../../shared/utils/imageClipboard';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Texto discreto en el pie de la barra (p. ej. contador de palabras). */
  statusSlot?: React.ReactNode;
  onEditorReady?: (editor: Editor) => void;
  onImageError?: (message: string) => void;
  /** Clase de animación de la barra (va en un portal y no hereda la animación del editor). */
  toolbarMotionClass?: string;
  /** Si existe, la barra muestra el micrófono para grabar una nota de voz. */
  onRecordVoice?: () => void;
}

interface ToolbarAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  isActive?: boolean;
  disabled?: boolean;
  /** Franja de color bajo el ícono (el resaltador muestra el color que aplicará). */
  indicatorColor?: HighlightColor;
}

interface ImageClip {
  src: string;
  alt?: string;
}

/** Archivos de imagen de un pegado o arrastre (algunos WebView solo los exponen en items). */
function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  // Los archivos vacíos (0 bytes) se descartan: no hay imagen que insertar
  const files = Array.from(data.files).filter((file) => isImageFile(file) && file.size > 0);
  if (files.length > 0) return files;
  return Array.from(data.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null && file.size > 0);
}

/**
 * ¿El pegado trae una imagen del portapapeles de Android? Puede llegar como archivo, como lista
 * de URI o como el texto "content://…" del FileProvider, según la versión del WebView.
 */
function pasteLooksLikeImage(data: DataTransfer | null): boolean {
  if (!data) return false;
  if (Array.from(data.items).some((item) => item.type.startsWith('image/'))) return true;
  if (data.types.includes('text/uri-list')) return true;
  return /^content:\/\/\S+$/i.test(data.getData('text/plain').trim());
}

/** Inserta una foto en la selección (o en `pos`, al soltar un arrastre) con el cursor debajo. */
function insertImageInView(view: EditorView, src: string, alt: string, pos?: number): void {
  const imageType = view.state.schema.nodes.image;
  if (imageType) insertBlockNodeInView(view, imageType.create({ src, alt }), pos);
}

/** Bloques que se seleccionan enteros y tienen su propia barra de acciones. */
type MediaKind = 'image' | 'voiceNote';

function mediaKindOf(node: PMNode): MediaKind | null {
  return node.type.name === 'image' || node.type.name === 'voiceNote' ? node.type.name : null;
}

const MEDIA_LABEL: Record<MediaKind, string> = { image: 'Imagen', voiceNote: 'Nota de voz' };

/** Tamaños rápidos del menú de tamaño (en % del ancho del apunte). */
const IMAGE_SIZE_PRESETS = [
  { label: 'S', width: 33, name: 'Pequeña' },
  { label: 'M', width: 50, name: 'Mediana' },
  { label: 'L', width: 75, name: 'Grande' },
  { label: 'XL', width: 100, name: 'Ancho completo' },
] as const;

/** Aviso tras copiar/cortar: dice dónde quedó la foto y, si falló, por qué. */
function copyNoticeText(verb: string, result: ImageCopyResult): string {
  return result.ok
    ? `Imagen ${verb}. Ya puedes pegarla en WhatsApp u otra app.`
    : `Imagen ${verb} solo en el apunte (${result.error ?? "error desconocido"}). Usa «Pegar imagen».`;
}

type ToolbarButtonProps = Omit<ToolbarAction, 'id' | 'run'> & {
  onClick: () => void;
  /** Botones del grupo fijo (cámara, galería, micrófono): color del contenedor tonal. */
  tonal?: boolean;
};

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ label, icon: Icon, onClick, isActive, disabled, tonal = false, indicatorColor }) => {
  const isToggle = isActive !== undefined;
  return (
    <button
      type="button"
      // Evita que el botón robe el foco: la selección y el teclado del móvil se mantienen
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isToggle ? isActive : undefined}
      title={label}
      className={`relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl transition-all duration-150 ease-out active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
        isActive
          ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
          : tonal
            ? 'text-[var(--color-md-on-secondary-container)] hover:bg-black/5 dark:hover:bg-white/10'
            : 'text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)] hover:text-[var(--color-md-on-surface)]'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      {indicatorColor && (
        <span
          data-color={indicatorColor}
          className="note-hl-swatch absolute bottom-1 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full ring-1 ring-black/10 dark:ring-white/15"
          aria-hidden="true"
        />
      )}
    </button>
  );
};

/**
 * Márgenes que el cursor debe guardar al desplazarse: arriba la cabecera fija del editor (~80 px)
 * y abajo la barra de formato con su pie (~100 px) más un respiro para leer lo que se escribe.
 */
const CARET_SCROLL_MARGIN = { top: 96, bottom: 150, left: 0, right: 0 };

const LAST_HIGHLIGHT_KEY = 'agenda_last_highlight';
/** Etiqueta del botón del resaltador (también sirve para reconocerlo al cerrar la paleta). */
const HIGHLIGHT_BUTTON_LABEL = 'Resaltar (elige el color)';

function readLastHighlight(): HighlightColor {
  try {
    const saved = localStorage.getItem(LAST_HIGHLIGHT_KEY);
    return isHighlightColor(saved) ? saved : DEFAULT_HIGHLIGHT;
  } catch {
    return DEFAULT_HIGHLIGHT;
  }
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = 'Comienza a redactar tu apunte aquí…',
  statusSlot,
  onRecordVoice,
  onEditorReady,
  onImageError,
  toolbarMotionClass = '',
}) => {
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt?: string } | null>(null);
  const [imageClip, setImageClip] = useState<ImageClip | null>(null);
  // Modo «Mover»: el bloque elegido espera a que se toque su sitio nuevo en el texto
  const [moving, setMoving] = useState<{ node: PMNode; kind: MediaKind } | null>(null);
  // Copia para handleClick de ProseMirror, que se configura una sola vez al crear el editor
  const movingRef = useRef<{ node: PMNode; kind: MediaKind } | null>(null);
  useEffect(() => {
    movingRef.current = moving;
  }, [moving]);
  // Foto abierta en el editor de fotos (la instancia del nodo permite encontrarla al guardar)
  const [editingImage, setEditingImage] = useState<PMNode | null>(null);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  // Aviso breve en el pie de la barra; id distinto en cada aviso para reiniciar el temporizador
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  /**
   * Comprime e inserta fotos que llegan como archivo (pegar, arrastrar o el botón "Pegar imagen").
   * TipTap solo sabe pegar imágenes que vienen como HTML; las del portapapeles de Android llegan
   * como archivo y antes se ignoraban.
   */
  const insertImageFiles = async (view: EditorView, files: File[], pos?: number) => {
    setIsProcessingImage(true);
    try {
      for (const [index, file] of files.entries()) {
        try {
          const { blob } = await compressImage(file);
          insertImageInView(view, await blobToDataUrl(blob), file.name || 'Imagen pegada', index === 0 ? pos : undefined);
        } catch (err: unknown) {
          // El tipo y el tamaño de lo recibido permiten diagnosticar el fallo desde una captura
          const reason = err instanceof Error ? err.message : String(err);
          const kb = Math.max(1, Math.round(file.size / 1024));
          onImageError?.(`No se pudo insertar la imagen: ${reason} (${file.type || 'sin tipo'}, ${kb} KB).`);
        }
      }
    } finally {
      setIsProcessingImage(false);
    }
  };

  const editor = useEditor({
    // Re-render en cada transacción para que los estados activos de la barra sigan al cursor
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      NoteImage.configure({
        inline: false,
        allowBase64: true,
        // TipTap 3 ya declara la imagen como arrastrable (draggable: true en el nodo)
        HTMLAttributes: {
          class: 'rounded-2xl max-w-full my-3 block mx-auto cursor-pointer select-none transition-shadow duration-150',
        },
      }),
      VoiceNoteNode,
      Placeholder.configure({ placeholder }),
      NoteHighlight,
      // Lista de tareas: cada casilla es un elemento; nested permite subtareas y varias líneas por tarea
      TaskList,
      TaskItem.configure({
        nested: true,
        a11y: {
          checkboxLabel: (node, checked) => `${checked ? 'Hecha' : 'Pendiente'}: ${node.textContent.trim() || 'tarea sin texto'}`,
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // pb-44: espacio al final para que la última línea pueda subir por encima de la barra fija
        class:
          'min-h-full flex-1 w-full py-2 px-0.5 sm:px-1 focus:outline-none text-[var(--color-md-on-surface)] text-15px sm:text-base leading-relaxed max-w-none pb-44',
        'aria-label': 'Contenido del apunte',
      },
      // El cursor se considera "a la vista" solo si no queda bajo la cabecera fija (arriba) ni
      // bajo la barra de formato (abajo); al escribir, el editor desplaza para respetarlo
      scrollThreshold: CARET_SCROLL_MARGIN,
      scrollMargin: CARET_SCROLL_MARGIN,
      // Sin handleDOMEvents.click: tocar una foto la selecciona para editarla; el zoom es un botón.
      // En modo «Mover», el toque elige el sitio nuevo de la foto o la nota de voz.
      handleClick: (view, pos) => {
        const moving = movingRef.current;
        if (!moving) return false;
        const result = moveBlockNodeInView(view, moving.node, pos);
        // Tocar el propio elemento no lo mueve: se sigue esperando el sitio nuevo
        if (result === 'inside') return true;
        setMoving(null);
        if (result === 'missing') setNotice((prev) => ({ id: (prev?.id ?? 0) + 1, text: 'No se encontró el elemento a mover.' }));
        return true;
      },
      handlePaste: (view, event) => {
        const files = imageFilesFrom(event.clipboardData);
        // En Android el archivo que arma el WebView puede llegar vacío o dañado: se lee la imagen
        // real del portapapeles con el puente nativo y el del evento queda como respaldo
        if (Capacitor.isNativePlatform() && pasteLooksLikeImage(event.clipboardData)) {
          event.preventDefault();
          void (async () => {
            let native: File | null = null;
            try {
              native = await readImageFromSystemClipboard();
            } catch (err) {
              console.warn('Lectura nativa del portapapeles:', err);
            }
            if (native) await insertImageFiles(view, [native]);
            else if (files.length > 0) await insertImageFiles(view, files);
            else onImageError?.('No hay ninguna imagen en el portapapeles.');
          })();
          return true;
        }
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImageFiles(view, files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        // Mover una foto dentro del apunte lo resuelve ProseMirror; aquí solo archivos externos
        if (moved) return false;
        const files = imageFilesFrom(event.dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImageFiles(view, files, pos);
        return true;
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /**
   * Pulsación prolongada (420 ms) sobre una foto: la selecciona y la copia al portapapeles del
   * sistema. Va antes del "return null" porque los hooks deben llamarse siempre en el mismo orden.
   */
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const LONG_PRESS_MS = 420;
    const MOVE_TOLERANCE_PX = 10;

    let longPressTimer: number | undefined;
    let startCoords: { x: number; y: number } | null = null;
    // Momento del último toque sobre una foto: solo se bloquea el menú contextual que provoca un
    // dedo; el clic derecho del ratón en PC conserva su menú habitual
    let lastImageTouchAt = 0;

    const cancelTimer = () => {
      window.clearTimeout(longPressTimer);
      longPressTimer = undefined;
    };

    const copyPressedImage = async (img: HTMLImageElement) => {
      // En Android la vibración la hace el puente nativo; en la web, la Vibration API
      if (!Capacitor.isNativePlatform()) navigator.vibrate?.(50);

      // Selecciona exactamente la foto pulsada (aunque haya copias iguales en el apunte)
      const { state, view } = editor;
      // La foto vive dentro de su vista (div.note-image): la posición es la de ese contenedor
      const pos = view.posAtDOM(img.closest('.note-image') ?? img, 0);
      const imagePos = [pos, pos - 1].find((p) => p >= 0 && state.doc.nodeAt(p)?.type.name === 'image');
      if (imagePos !== undefined) {
        view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, imagePos)));
        view.focus();
      }

      setImageClip({ src: img.src, alt: img.alt || undefined });
      setNotice({ id: Date.now(), text: 'Copiando imagen…' });
      const result = await copyImageToSystemClipboard(img.src);
      setNotice({ id: Date.now(), text: copyNoticeText('copiada', result) });
    };

    const onTouchStart = (e: TouchEvent) => {
      const img = (e.target as HTMLElement | null)?.closest('img');
      if (!img || e.touches.length !== 1) return;
      lastImageTouchAt = Date.now();
      startCoords = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      cancelTimer();
      longPressTimer = window.setTimeout(() => {
        longPressTimer = undefined;
        void copyPressedImage(img);
      }, LONG_PRESS_MS);
    };

    // Si el dedo se desplaza es un scroll, no una pulsación prolongada
    const onTouchMove = (e: TouchEvent) => {
      if (longPressTimer === undefined || !startCoords) return;
      const dx = e.touches[0].clientX - startCoords.x;
      const dy = e.touches[0].clientY - startCoords.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancelTimer();
    };

    const onContextMenu = (e: MouseEvent) => {
      const img = (e.target as HTMLElement | null)?.closest('img');
      if (!img || Date.now() - lastImageTouchAt > 1500) return;
      // Menú nativo del WebView sobre la foto: se sustituye por la copia de la app
      e.preventDefault();
      e.stopPropagation();
      if (longPressTimer !== undefined) {
        cancelTimer();
        void copyPressedImage(img);
      }
    };

    let dom: HTMLElement | null = null;
    const bind = () => {
      if (dom) return;
      try {
        dom = editor.view.dom;
      } catch {
        // Vista aún sin montar (p. ej. al abrir el editor directo con «Tomar apunte», cuando React
        // reconecta el efecto al salir de un Suspense): se engancha al montarse (evento «mount»)
        return;
      }
      dom.addEventListener('touchstart', onTouchStart, { passive: true });
      dom.addEventListener('touchmove', onTouchMove, { passive: true });
      dom.addEventListener('touchend', cancelTimer);
      dom.addEventListener('touchcancel', cancelTimer);
      dom.addEventListener('contextmenu', onContextMenu);
    };
    bind();
    editor.on('mount', bind);
    return () => {
      editor.off('mount', bind);
      cancelTimer();
      if (!dom) return;
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', cancelTimer);
      dom.removeEventListener('touchcancel', cancelTimer);
      dom.removeEventListener('contextmenu', onContextMenu);
    };
  }, [editor]);

  const openCamera = useCallback(() => cameraInputRef.current?.click(), []);
  const openGallery = useCallback(() => galleryInputRef.current?.click(), []);

  // Teclado del teléfono: al abrirse (la zona visible se achica) o al tocar el texto, el cursor sube
  // por encima de la barra de formato. Sin esto el sistema lo deja justo detrás de la barra.
  useEffect(() => {
    if (!editor) return;
    const viewport = window.visualViewport;
    let timer = 0;
    const revealCaret = () => {
      if (!editor.isFocused) return;
      window.clearTimeout(timer);
      // Después de que termine de acomodarse la pantalla con el teclado
      timer = window.setTimeout(() => editor.commands.scrollIntoView(), 150);
    };
    viewport?.addEventListener('resize', revealCaret);
    window.addEventListener('resize', revealCaret);
    editor.on('focus', revealCaret);
    return () => {
      window.clearTimeout(timer);
      viewport?.removeEventListener('resize', revealCaret);
      window.removeEventListener('resize', revealCaret);
      editor.off('focus', revealCaret);
    };
  }, [editor]);

  // Paleta del resaltador: abierta/cerrada y último color usado (se recuerda entre apuntes)
  const [isHighlightMenuOpen, setIsHighlightMenuOpen] = useState(false);
  const [lastHighlight, setLastHighlight] = useState<HighlightColor>(readLastHighlight);
  const highlightMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isHighlightMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (highlightMenuRef.current?.contains(target) || target?.closest(`[aria-label="${HIGHLIGHT_BUTTON_LABEL}"]`)) return;
      setIsHighlightMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsHighlightMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isHighlightMenuOpen]);

  // Menú de tamaño de la foto: se cierra al tocar fuera o con Escape
  useEffect(() => {
    if (!isSizeMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (sizeMenuRef.current?.contains(target) || target?.closest('[aria-label="Tamaño de la imagen"]')) return;
      setIsSizeMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSizeMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isSizeMenuOpen]);

  // Escape cancela el modo «Mover»
  useEffect(() => {
    if (!moving) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoving(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [moving]);

  // Zona de formato desplazable: degradados en los bordes cuando hay más botones fuera de la vista
  const [formatScroller, setFormatScroller] = useState<HTMLDivElement | null>(null);
  const [formatOverflow, setFormatOverflow] = useState({ left: false, right: false });
  useEffect(() => {
    if (!formatScroller) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = formatScroller;
      const left = scrollLeft > 4;
      const right = scrollLeft + clientWidth < scrollWidth - 4;
      setFormatOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    update();
    formatScroller.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(formatScroller);
    return () => {
      formatScroller.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [formatScroller]);

  if (!editor) return null;

  /**
   * Tras insertar una imagen TipTap la deja seleccionada (NodeSelection): lo siguiente que se escriba
   * o inserte la reemplazaría. Se lleva el cursor al párrafo de debajo (creándolo si no existe).
   */
  const placeCursorAfterImage = () => {
    const { state, view } = editor;
    const sel = state.selection;
    if (!(sel instanceof NodeSelection)) return;
    const tr = state.tr;
    if (!tr.doc.resolve(sel.to).nodeAfter) {
      tr.insert(sel.to, state.schema.nodes.paragraph.create());
    }
    tr.setSelection(Selection.near(tr.doc.resolve(sel.to), 1)).scrollIntoView();
    view.dispatch(tr);
    view.focus();
  };

  // Inserta la imagen comprimida exactamente en la posición del cursor
  const handleImageInsert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await insertImageFiles(editor.view, [file]);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const chain = () => editor.chain().focus();

  const showNotice = (text: string) => setNotice((prev) => ({ id: (prev?.id ?? 0) + 1, text }));

  // Foto o nota de voz seleccionada (NodeSelection) y si tiene bloques vecinos para moverla
  const { selection } = editor.state;
  const selectedMedia = selection instanceof NodeSelection && mediaKindOf(selection.node) ? selection : null;
  const mediaKind = selectedMedia ? mediaKindOf(selectedMedia.node) : null;
  const selectedImage = mediaKind === 'image' ? selectedMedia : null;
  const imageAttrs = selectedImage ? (selectedImage.node.attrs as NoteImageAttrs) : null;
  const mediaIndex = selectedMedia ? editor.state.doc.resolve(selectedMedia.from).index() : 0;
  const mediaParent = selectedMedia ? editor.state.doc.resolve(selectedMedia.from).parent : null;
  const canMoveUp = Boolean(selectedMedia) && mediaIndex > 0;
  const canMoveDown = Boolean(mediaParent) && mediaIndex < (mediaParent?.childCount ?? 0) - 1;

  const currentImageClip = (): ImageClip | null => {
    if (!imageAttrs) return null;
    return { src: imageAttrs.src, alt: imageAttrs.alt ?? undefined };
  };

  /** Intercambia el bloque seleccionado con el anterior (-1) o el siguiente (+1), conservándolo seleccionado. */
  const moveSelectedMedia = (direction: -1 | 1) => {
    const { state, view } = editor;
    const sel = state.selection;
    if (!(sel instanceof NodeSelection)) return;
    const $pos = state.doc.resolve(sel.from);
    const index = $pos.index();
    const sibling = $pos.parent.maybeChild(index + direction);
    if (!sibling) return;

    const tr = state.tr.delete(sel.from, sel.to);
    const insertAt = direction < 0 ? sel.from - sibling.nodeSize : sel.from + sibling.nodeSize;
    tr.insert(insertAt, sel.node);
    tr.setSelection(NodeSelection.create(tr.doc, insertAt)).scrollIntoView();
    view.dispatch(tr);
    view.focus();
  };

  /** Cambia atributos de la foto seleccionada sin perder la selección (sigue su barra de acciones). */
  const updateSelectedImage = (attrs: Partial<NoteImageAttrs>) => {
    const { state, view } = editor;
    const sel = state.selection;
    if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'image') return;
    const tr = state.tr.setNodeMarkup(sel.from, undefined, { ...sel.node.attrs, ...attrs });
    tr.setSelection(NodeSelection.create(tr.doc, sel.from));
    view.dispatch(tr);
  };

  const setImageAlign = (align: ImageAlign) => {
    if (!imageAttrs) return;
    // Al pasar a un lado se reduce (si era grande) para que el texto quepa al lado
    const width =
      align !== 'center' && (imageAttrs.width === null || imageAttrs.width > 70) ? SIDE_IMAGE_DEFAULT_WIDTH : imageAttrs.width;
    updateSelectedImage({ align, width });
  };

  const startMoving = () => {
    if (!selectedMedia || !mediaKind) return;
    setIsSizeMenuOpen(false);
    setMoving({ node: selectedMedia.node, kind: mediaKind });
  };

  /** Guarda la foto editada en el mismo sitio, con su tamaño y posición. */
  const saveEditedImage = (dataUrl: string) => {
    const target = editingImage;
    setEditingImage(null);
    if (!target) return;
    const { state, view } = editor;
    const pos = findNodePos(state.doc, target);
    if (pos < 0) {
      showNotice('La foto ya no está en el apunte.');
      return;
    }
    const tr = state.tr.setNodeMarkup(pos, undefined, { ...target.attrs, src: dataUrl });
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    view.dispatch(tr);
    showNotice('Foto editada.');
  };

  /**
   * Copiar/cortar: la foto va al portapapeles del sistema (WhatsApp, otras apps) y además a un
   * búfer interno para "Pegar imagen" dentro del editor. El aviso dice la verdad sobre dónde quedó.
   */
  const copySelectedImage = async (removeAfter: boolean) => {
    const clip = currentImageClip();
    if (!clip) return;
    setImageClip(clip);
    const verb = removeAfter ? 'cortada' : 'copiada';
    // La copia arranca dentro del toque (en la web lo exige el navegador) y la foto se borra ya:
    // si se borrara tras el await, un toque en otro sitio cambiaría la selección y se borraría
    // otro contenido
    const systemCopy = copyImageToSystemClipboard(clip.src);
    if (removeAfter) chain().deleteSelection().run();
    showNotice('Copiando imagen…');
    showNotice(copyNoticeText(verb, await systemCopy));
  };

  const deselectMedia = () => {
    setIsSizeMenuOpen(false);
    placeCursorAfterImage();
  };

  const pasteImage = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const file = await readImageFromSystemClipboard();
        if (file) {
          await insertImageFiles(editor.view, [file]);
          return;
        }
      } catch (err) {
        console.warn('No se pudo leer el portapapeles del teléfono:', err);
      }
    }
    if (imageClip) {
      insertImageInView(editor.view, imageClip.src, imageClip.alt ?? 'Imagen');
      return;
    }
    showNotice('No hay ninguna imagen en el portapapeles. Copia una foto primero.');
  };

  const moveActions: ToolbarAction[] = [
    { id: 'move', label: 'Mover a otro sitio del texto', icon: Move, run: startMoving },
    { id: 'up', label: 'Subir un bloque', icon: ArrowUp, run: () => moveSelectedMedia(-1), disabled: !canMoveUp },
    { id: 'down', label: 'Bajar un bloque', icon: ArrowDown, run: () => moveSelectedMedia(1), disabled: !canMoveDown },
  ];

  const imageActions: ToolbarAction[] = [
    {
      id: 'edit',
      label: 'Editar foto (recortar, girar, dibujar, texto)',
      icon: PenLine,
      run: () => {
        if (!selectedImage) return;
        setIsSizeMenuOpen(false);
        setEditingImage(selectedImage.node);
      },
    },
    ...moveActions,
    {
      id: 'size',
      label: 'Tamaño de la imagen',
      icon: Scaling,
      run: () => setIsSizeMenuOpen((open) => !open),
      isActive: isSizeMenuOpen,
    },
    {
      id: 'align-left',
      label: 'A la izquierda, con el texto al lado',
      icon: AlignHorizontalJustifyStart,
      run: () => setImageAlign('left'),
      isActive: imageAttrs?.align === 'left',
    },
    {
      id: 'align-center',
      label: 'Centrada, sola en su línea',
      icon: AlignHorizontalJustifyCenter,
      run: () => setImageAlign('center'),
      isActive: imageAttrs?.align === 'center',
    },
    {
      id: 'align-right',
      label: 'A la derecha, con el texto al lado',
      icon: AlignHorizontalJustifyEnd,
      run: () => setImageAlign('right'),
      isActive: imageAttrs?.align === 'right',
    },
    {
      id: 'zoom',
      label: 'Ampliar imagen',
      icon: ZoomIn,
      run: () => {
        const clip = currentImageClip();
        if (clip) setZoomedImage({ src: clip.src, alt: clip.alt || 'Foto del apunte' });
      },
    },
    { id: 'copy', label: 'Copiar imagen', icon: Copy, run: () => void copySelectedImage(false) },
    { id: 'cut', label: 'Cortar imagen', icon: Scissors, run: () => void copySelectedImage(true) },
    {
      id: 'delete',
      label: 'Eliminar imagen',
      icon: Trash2,
      run: () => {
        setIsSizeMenuOpen(false);
        chain().deleteSelection().run();
        showNotice('Imagen eliminada.');
      },
    },
  ];

  const voiceNoteActions: ToolbarAction[] = [
    ...moveActions,
    {
      id: 'remove',
      label: 'Quitar del texto (la grabación queda en «Notas de voz»)',
      icon: ArrowDownToLine,
      run: () => {
        chain().deleteSelection().run();
        showNotice('Nota de voz quitada del texto: sigue en «Notas de voz», encima del apunte.');
      },
    },
  ];

  const mediaActions = mediaKind === 'image' ? imageActions : voiceNoteActions;
  const currentWidth = imageAttrs?.width ?? MAX_IMAGE_WIDTH;

  const activeHighlightAttr: unknown = editor.isActive('highlight') ? editor.getAttributes('highlight').color : null;
  const activeHighlight = isHighlightColor(activeHighlightAttr) ? activeHighlightAttr : null;

  const applyHighlight = (color: HighlightColor) => {
    chain().setHighlight(color).run();
    setLastHighlight(color);
    try {
      localStorage.setItem(LAST_HIGHLIGHT_KEY, color);
    } catch {
      // Sin almacenamiento: solo no se recuerda el color para la próxima vez
    }
    setIsHighlightMenuOpen(false);
  };

  // Orden por uso al tomar apuntes: lo más frecuente queda a la vista sin desplazar
  const toolbarGroups: { label: string; actions: ToolbarAction[] }[] = [
    {
      label: 'Estilo de texto',
      actions: [
        { id: 'bold', label: 'Negrita (Ctrl+B)', icon: Bold, run: () => chain().toggleBold().run(), isActive: editor.isActive('bold') },
        { id: 'italic', label: 'Cursiva (Ctrl+I)', icon: Italic, run: () => chain().toggleItalic().run(), isActive: editor.isActive('italic') },
        { id: 'underline', label: 'Subrayado (Ctrl+U)', icon: Underline, run: () => chain().toggleUnderline().run(), isActive: editor.isActive('underline') },
        {
          id: 'highlight',
          label: HIGHLIGHT_BUTTON_LABEL,
          icon: Highlighter,
          run: () => setIsHighlightMenuOpen((open) => !open),
          isActive: editor.isActive('highlight') || isHighlightMenuOpen,
          indicatorColor: activeHighlight ?? lastHighlight,
        },
      ],
    },
    {
      label: 'Listas',
      actions: [
        { id: 'bullet', label: 'Lista con viñetas', icon: List, run: () => chain().toggleBulletList().run(), isActive: editor.isActive('bulletList') },
        { id: 'ordered', label: 'Lista numerada', icon: ListOrdered, run: () => chain().toggleOrderedList().run(), isActive: editor.isActive('orderedList') },
        { id: 'tasks', label: 'Lista de tareas', icon: ListChecks, run: () => chain().toggleTaskList().run(), isActive: editor.isActive('taskList') },
      ],
    },
    {
      label: 'Encabezados',
      actions: [
        { id: 'h1', label: 'Título (H1)', icon: Heading1, run: () => chain().toggleHeading({ level: 1 }).run(), isActive: editor.isActive('heading', { level: 1 }) },
        { id: 'h2', label: 'Subtítulo (H2)', icon: Heading2, run: () => chain().toggleHeading({ level: 2 }).run(), isActive: editor.isActive('heading', { level: 2 }) },
      ],
    },
    {
      label: 'Más formato',
      actions: [
        { id: 'quote', label: 'Cita destacada', icon: Quote, run: () => chain().toggleBlockquote().run(), isActive: editor.isActive('blockquote') },
        { id: 'strike', label: 'Tachado', icon: Strikethrough, run: () => chain().toggleStrike().run(), isActive: editor.isActive('strike') },
        { id: 'divider', label: 'Línea divisoria', icon: Minus, run: () => chain().setHorizontalRule().run() },
        // En Android siempre visible: lee el portapapeles del teléfono (fotos copiadas aquí o en
        // otra app); en la web, solo cuando hay una foto copiada dentro del editor
        ...(imageClip || Capacitor.isNativePlatform()
          ? [{ id: 'paste-image', label: 'Pegar imagen', icon: ClipboardPaste, run: () => void pasteImage(), disabled: isProcessingImage }]
          : []),
      ],
    },
  ];

  return (
    <div className="relative flex w-full flex-1 flex-col">
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageInsert} className="hidden" />
      <input ref={galleryInputRef} type="file" accept={IMAGE_ACCEPT} onChange={handleImageInsert} className="hidden" />

      <div
        onClick={(event) => {
          // Los controles de una nota de voz no deben llevar el cursor (ni el scroll) a otra parte
          if (event.target instanceof Element && event.target.closest('button, input, [data-node-view-wrapper]')) return;
          if (!editor.isFocused) editor.chain().focus().run();
        }}
        className="flex w-full flex-1 cursor-text flex-col"
      >
        <EditorContent
          editor={editor}
          className="flex w-full flex-1 flex-col [&>.ProseMirror]:w-full [&>.ProseMirror]:flex-1"
        />
      </div>

      {/* Barra de formato inferior, en la zona del pulgar. Va en un portal a <body>: si un ancestro
          anima transform, un position:fixed dentro de él dejaría de anclarse a la pantalla. */}
      {createPortal(
      <div
        style={{
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
        }}
        className={`fixed bottom-0 left-0 right-0 z-30 ${toolbarMotionClass} border-t border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)]/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl sm:px-6`}
      >
        {moving ? (
          /* Modo «Mover»: el siguiente toque en el texto elige el sitio nuevo */
          <div role="status" className="m3-menu-enter mx-auto flex max-w-3xl items-center gap-2 py-0.5">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
              <Move className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-xs font-semibold leading-snug text-[var(--color-md-on-surface)]">
              Toca en el texto dónde quieres poner {moving.kind === 'image' ? 'la imagen' : 'la nota de voz'}.
            </p>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setMoving(null)}
              className="min-h-[38px] shrink-0 rounded-full px-3 text-xs font-bold text-[var(--color-md-primary)] hover:bg-[var(--color-md-surface-container-high)]"
            >
              Cancelar
            </button>
          </div>
        ) : selectedMedia && mediaKind ? (
          /* Barra contextual de la foto o nota de voz: reemplaza la de formato mientras está seleccionada */
          <div className="relative mx-auto max-w-3xl">
            {isSizeMenuOpen && imageAttrs && (
              <div
                ref={sizeMenuRef}
                role="group"
                aria-label="Tamaño de la imagen"
                className="m3-menu-enter absolute bottom-[calc(100%+10px)] left-1/2 z-10 w-[min(20rem,calc(100vw-1rem))] origin-bottom -translate-x-1/2 rounded-[22px] border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
              >
                <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-[var(--color-md-on-surface-variant)]">
                  <span>Tamaño</span>
                  <span className="tabular-nums text-[var(--color-md-on-surface)]">{currentWidth} %</span>
                </div>
                <input
                  type="range"
                  min={MIN_IMAGE_WIDTH}
                  max={MAX_IMAGE_WIDTH}
                  step={1}
                  value={currentWidth}
                  onChange={(event) => updateSelectedImage({ width: clampImageWidth(Number(event.target.value)) })}
                  aria-label="Ancho de la imagen"
                  aria-valuetext={`${currentWidth} % del ancho del apunte`}
                  data-no-swipe="true"
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-md-primary)] [&::-webkit-slider-thumb]:shadow-md"
                  style={{
                    background: `linear-gradient(to right, var(--color-md-primary) ${((currentWidth - MIN_IMAGE_WIDTH) / (MAX_IMAGE_WIDTH - MIN_IMAGE_WIDTH)) * 100}%, var(--color-md-outline-variant) ${((currentWidth - MIN_IMAGE_WIDTH) / (MAX_IMAGE_WIDTH - MIN_IMAGE_WIDTH)) * 100}%)`,
                  }}
                />
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {IMAGE_SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => updateSelectedImage({ width: preset.width })}
                      aria-label={`${preset.name} (${preset.width} %)`}
                      aria-pressed={currentWidth === preset.width}
                      className={`min-h-[36px] rounded-full text-xs font-bold transition-colors ${
                        currentWidth === preset.width
                          ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                          : 'bg-[var(--color-md-surface-container)] text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-surface-container-highest)]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-1 text-11px text-[var(--color-md-on-surface-variant)]">
                  También puedes arrastrar la esquina de la foto.
                </p>
              </div>
            )}
            <div
              role="toolbar"
              aria-label={mediaKind === 'image' ? 'Acciones de la imagen' : 'Acciones de la nota de voz'}
              className="m3-menu-enter flex items-center gap-1.5 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <ToolbarButton label={`Terminar edición: ${MEDIA_LABEL[mediaKind].toLowerCase()}`} icon={X} onClick={deselectMedia} />
              <span className="shrink-0 whitespace-nowrap pr-1 text-xs font-bold text-[var(--color-md-on-surface)]">{MEDIA_LABEL[mediaKind]}</span>
              <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--color-md-outline-variant)]" aria-hidden="true" />
              {mediaActions.map(({ id, run, ...action }) => (
                <ToolbarButton key={id} {...action} onClick={run} />
              ))}
            </div>
          </div>
        ) : (
        <div role="toolbar" aria-label="Formato del apunte" className="relative mx-auto flex max-w-3xl items-center gap-2 py-0.5">
          {/* Paleta del resaltador (menú M3 sobre la barra): 7 colores y quitar resaltado */}
          {isHighlightMenuOpen && (
            <div
              ref={highlightMenuRef}
              role="group"
              aria-label="Colores del resaltador"
              className="m3-menu-enter absolute bottom-[calc(100%+10px)] left-1/2 z-10 w-max max-w-[calc(100vw-1rem)] origin-bottom -translate-x-1/2 rounded-[22px] border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            >
              <p className="mb-2 px-1 text-xs font-bold text-[var(--color-md-on-surface-variant)]">Resaltador</p>
              <div className="flex items-center gap-2">
                {HIGHLIGHT_COLORS.map((color) => {
                  const isCurrent = activeHighlight === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      data-color={color.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyHighlight(color.id)}
                      aria-label={`Resaltar en ${color.label.toLowerCase()}`}
                      aria-pressed={isCurrent}
                      title={color.label}
                      className={`note-hl-swatch flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90 ${
                        isCurrent
                          ? 'ring-2 ring-[var(--color-md-primary)] ring-offset-2 ring-offset-[var(--color-md-surface-container-high)]'
                          : color.id === lastHighlight
                            ? 'ring-2 ring-[var(--color-md-outline)]'
                            : 'ring-1 ring-black/10 dark:ring-white/15'
                      }`}
                    >
                      {isCurrent && <Check className="h-4 w-4 text-[var(--color-md-on-surface)]" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  chain().unsetHighlight().run();
                  setIsHighlightMenuOpen(false);
                }}
                disabled={!activeHighlight}
                className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-surface-container)] disabled:opacity-40"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                Quitar resaltado
              </button>
            </div>
          )}
          {/* Formato: se desplaza de lado si no cabe; los degradados avisan que hay más botones */}
          <div className="relative min-w-0 flex-1">
            <div
              ref={setFormatScroller}
              className="flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {toolbarGroups.map((group, index) => (
                <React.Fragment key={group.label}>
                  {index > 0 && <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--color-md-outline-variant)]" aria-hidden="true" />}
                  <div role="group" aria-label={group.label} className="flex shrink-0 items-center gap-1.5">
                    {group.actions.map(({ id, run, ...action }) => (
                      <ToolbarButton key={id} {...action} onClick={run} />
                    ))}
                  </div>
                </React.Fragment>
              ))}
            </div>
            {formatOverflow.left && (
              <span
                className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[var(--color-md-surface-container)] to-transparent"
                aria-hidden="true"
              />
            )}
            {formatOverflow.right && (
              <span
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--color-md-surface-container)] to-transparent"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Fotos y voz: siempre a la vista, en un contenedor tonal M3 al alcance del pulgar */}
          <div
            role="group"
            aria-label="Fotos y voz"
            className="flex shrink-0 items-center gap-0.5 rounded-2xl bg-[var(--color-md-secondary-container)] p-0.5"
          >
            <ToolbarButton tonal label="Tomar foto con la cámara" icon={Camera} onClick={openCamera} disabled={isProcessingImage} />
            <ToolbarButton tonal label="Imagen de la galería" icon={ImageIcon} onClick={openGallery} disabled={isProcessingImage} />
            {onRecordVoice && <ToolbarButton tonal label="Grabar nota de voz" icon={Mic} onClick={onRecordVoice} />}
          </div>
        </div>
        )}

        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-1 pt-0.5 text-11px font-medium text-[var(--color-md-on-surface-variant)]">
          {notice && (
            <span className="mr-auto line-clamp-2 text-[var(--color-md-on-surface)]" role="status">
              {notice.text}
            </span>
          )}
          {isProcessingImage && (
            <span className="inline-flex items-center gap-1" role="status">
              <Loader2 className="h-3 w-3 animate-spin text-[var(--color-md-primary)]" aria-hidden="true" />
              Procesando imagen…
            </span>
          )}
          {statusSlot}
        </div>
      </div>,
      document.body
      )}

      {/* También en un portal: así queda por encima de la barra inferior (que vive en <body>) */}
      {editingImage &&
        typeof (editingImage.attrs as NoteImageAttrs).src === 'string' && (
          <ImageEditModal
            src={(editingImage.attrs as NoteImageAttrs).src}
            onCancel={() => setEditingImage(null)}
            onSave={saveEditedImage}
          />
        )}

      {zoomedImage &&
        createPortal(
          <ImageZoomModal src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} />,
          document.body
        )}
    </div>
  );
};
