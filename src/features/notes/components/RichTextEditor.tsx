import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import { Subscript as SubscriptMark } from '@tiptap/extension-subscript';
import { Superscript as SuperscriptMark } from '@tiptap/extension-superscript';
import { PageBreak } from '../extensions/PageBreak';
import { Pagination } from '../extensions/Pagination';
import { TableKit } from '@tiptap/extension-table';
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
import { NoteTableCell, NoteTableHeader } from '../extensions/NoteTableCell';
import { toHexColor } from '../utils/colorHex';
import { hasMultiCellSelection, shadeTableCells, type ShadeTarget } from '../utils/tableShading';
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
  Heading3,
  Pilcrow,
  SquareCode,
  ChevronDown,
  Code,
  Link as LinkIcon,
  Palette,
  Table as TableIcon,
  CalendarDays,
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  TableRowsSplit,
  TableColumnsSplit,
  Grid2x2X,
  PaintBucket,
  PanelTop,
  Type,
  ALargeSmall,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  IndentDecrease,
  Subscript,
  Superscript,
  RemoveFormatting,
  Omega,
  SeparatorHorizontal,
  TableCellsMerge,
  TableCellsSplit,
  BetweenHorizontalStart,
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
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { DatePickerDialog } from '../../../shared/components/pickers/DatePickerField';
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
  /** Apartado «Vista» de la barra (vista de hoja, modo enfoque…). */
  viewCommands?: EditorCommand[];
  /** Apartado «Archivo» de la barra (compartir, exportar, imprimir…). */
  fileCommands?: EditorCommand[];
}

/** Un botón de la barra: también lo usa NoteEditor para los apartados Vista y Archivo. */
export interface EditorCommand {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  isActive?: boolean;
  disabled?: boolean;
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
  /** Franja de color libre (el color de texto activo). */
  indicatorHex?: string;
  /** Abre un menú de la barra: tocar fuera de él no lo cierra si se toca este botón. */
  menuTrigger?: boolean;
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
  /** Muestra el texto junto al ícono (apartados con pocas opciones: Vista, Archivo). */
  showLabel?: boolean;
};

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ label, icon: Icon, onClick, isActive, disabled, tonal = false, indicatorColor, indicatorHex, menuTrigger, showLabel = false }) => {
  const isToggle = isActive !== undefined;
  return (
    <button
      type="button"
      // Evita que el botón robe el foco: la selección y el teclado del móvil se mantienen
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isToggle && !menuTrigger ? isActive : undefined}
      aria-haspopup={menuTrigger ? 'menu' : undefined}
      aria-expanded={menuTrigger ? isActive : undefined}
      data-menu-trigger={menuTrigger ? 'true' : undefined}
      title={label}
      className={`relative flex h-[38px] shrink-0 items-center justify-center rounded-xl transition-all ${showLabel ? 'gap-2 px-3 text-xs font-bold' : 'w-[38px]'} duration-150 ease-out active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
        isActive
          ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
          : tonal
            ? 'text-[var(--color-md-on-secondary-container)] hover:bg-black/5 dark:hover:bg-white/10'
            : 'text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)] hover:text-[var(--color-md-on-surface)]'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      {showLabel && <span className="whitespace-nowrap">{label}</span>}
      {indicatorColor && (
        <span
          data-color={indicatorColor}
          className="note-hl-swatch absolute bottom-1 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full ring-1 ring-black/10 dark:ring-white/15"
          aria-hidden="true"
        />
      )}
      {indicatorHex && (
        <span
          style={{ backgroundColor: indicatorHex }}
          className="absolute bottom-1 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full ring-1 ring-black/10 dark:ring-white/15"
          aria-hidden="true"
        />
      )}
    </button>
  );
};

/** Colores de texto: tonos medios que se leen sobre fondo claro y oscuro. */
const TEXT_COLORS = [
  { id: 'red', label: 'Rojo', value: '#DC2626' },
  { id: 'orange', label: 'Naranja', value: '#EA580C' },
  { id: 'amber', label: 'Ámbar', value: '#CA8A04' },
  { id: 'green', label: 'Verde', value: '#16A34A' },
  { id: 'blue', label: 'Azul', value: '#2563EB' },
  { id: 'purple', label: 'Morado', value: '#9333EA' },
  { id: 'pink', label: 'Rosa', value: '#DB2777' },
  { id: 'gray', label: 'Gris', value: '#6B7280' },
] as const;

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'code';

/** Tipos de bloque del menú «Texto ▾» (reemplaza los botones sueltos de H1, H2 y cita). */
const BLOCK_TYPES: { id: BlockType; label: string; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'paragraph', label: 'Texto normal', short: 'Texto', icon: Pilcrow },
  { id: 'h1', label: 'Título 1', short: 'Título 1', icon: Heading1 },
  { id: 'h2', label: 'Título 2', short: 'Título 2', icon: Heading2 },
  { id: 'h3', label: 'Título 3', short: 'Título 3', icon: Heading3 },
  { id: 'quote', label: 'Cita destacada', short: 'Cita', icon: Quote },
  { id: 'code', label: 'Bloque de código', short: 'Código', icon: SquareCode },
];

/** Fuentes del menú «Fuente» (null = la de la app). */
const FONT_FAMILIES = [
  { id: 'default', label: 'Predeterminada', value: null },
  { id: 'serif', label: 'Con serifa', value: 'Georgia, serif' },
  { id: 'mono', label: 'Monoespaciada', value: 'ui-monospace, Consolas, monospace' },
] as const;

/** Tamaños del menú «Tamaño» (null = el normal del apunte). */
const FONT_SIZES = [
  { id: 'small', label: 'Pequeño', value: '13px' },
  { id: 'normal', label: 'Normal', value: null },
  { id: 'large', label: 'Grande', value: '19px' },
  { id: 'xlarge', label: 'Muy grande', value: '24px' },
  { id: 'huge', label: 'Enorme', value: '30px' },
] as const;

/** Símbolos frecuentes en apuntes universitarios (matemática, física, griego, flechas). */
const SYMBOLS = ['±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '√', '∑', '∫', '∂', 'π', 'α', 'β', 'γ', 'δ', 'θ', 'λ', 'μ', 'σ', 'Ω', 'Δ', '∇', '→', '←', '↔', '⇒', '⇔', '∈', '∉', '⊂', '∪', '∩', '∀', '∃', '°', '²', '³', '½'];

/** Apartados de la barra, como las pestañas de Word en el teléfono. «Tabla» solo dentro de una tabla. */
type ToolbarSection = 'inicio' | 'insertar' | 'tabla' | 'vista' | 'archivo';
const TOOLBAR_SECTIONS: { id: ToolbarSection; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'insertar', label: 'Insertar' },
  { id: 'tabla', label: 'Tabla' },
  { id: 'vista', label: 'Vista' },
  { id: 'archivo', label: 'Archivo' },
];

/** Menús que salen sobre la barra (uno a la vez). */
type ToolbarMenuId = 'block' | 'highlight' | 'color' | 'shade' | 'font' | 'size' | 'symbol';

const TOOLBAR_MENU_CLASS =
  'm3-menu-enter absolute bottom-[calc(100%+10px)] z-10 max-w-[calc(100vw-1rem)] origin-bottom rounded-[22px] border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)]';

/** Una fecha en palabras («sábado, 28 de noviembre de 2026»); con mayúscula si abre un párrafo. */
function dateText(date: Date, capitalize: boolean): string {
  const text = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  return capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Completa lo escrito como enlace: sin esquema se asume https; un correo pasa a mailto. */
function normalizeLinkUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^(https?:|mailto:|tel:)/i.test(text)) return text;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `mailto:${text}`;
  return `https://${text}`;
}

/**
 * Márgenes que el cursor debe guardar al desplazarse: arriba la cabecera fija del editor (~80 px)
 * y abajo la barra de formato con su pie (~100 px) más un respiro para leer lo que se escribe.
 */
const CARET_SCROLL_MARGIN = { top: 96, bottom: 185, left: 0, right: 0 };

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
  viewCommands = [],
  fileCommands = [],
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
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Enlaces: se editan con el botón de la barra (tocar uno no lo abre mientras se escribe)
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
      }),
      // Color, fuente y tamaño de texto (span con style), desde la barra
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      // Alineación de párrafos y títulos (style="text-align")
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      SubscriptMark,
      SuperscriptMark,
      PageBreak,
      // Paginación A4 real en la vista de hoja (no hace nada fuera de ella)
      Pagination,
      // Tablas con fila de encabezado; en el teléfono se desplazan de lado si no caben
      // Las celdas son las propias (NoteTableCell/Header): suman el sombreado por nombre de tono
      TableKit.configure({ table: { resizable: false }, tableCell: false, tableHeader: false }),
      NoteTableCell,
      NoteTableHeader,
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

  // Teclado en el navegador del teléfono (Chrome en Android): la página NO se achica, solo la zona
  // visible (visualViewport), y la barra fija quedaba detrás del teclado. Se mide cuánto tapa el
  // teclado y la barra se sube esa distancia. En la app (Capacitor) la pantalla sí se achica y queda en 0
  const [keyboardInset, setKeyboardInset] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        // Se compara con el alto de la PÁGINA (clientHeight), no con innerHeight: en Chrome para Android
        // innerHeight también se achica con el teclado y la diferencia daba siempre 0
        const inset = Math.max(0, Math.round(document.documentElement.clientHeight - viewport.height - viewport.offsetTop));
        setKeyboardInset((prev) => (Math.abs(prev - inset) < 2 ? prev : inset));
      });
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  // Con el teclado abierto en el navegador, la línea donde se escribe debe quedar encima de la barra
  // (que ahora está sobre el teclado): si queda tapada, la página se desplaza lo justo
  useEffect(() => {
    if (!editor || keyboardInset === 0) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const reveal = () => {
      if (!editor.isFocused) return;
      const caret = editor.view.coordsAtPos(editor.state.selection.head);
      const toolbarTop = viewport.offsetTop + viewport.height - (toolbarRef.current?.offsetHeight ?? 110);
      const hidden = caret.bottom + 16 - toolbarTop;
      if (hidden > 0) window.scrollBy({ top: hidden });
    };
    reveal();
    editor.on('selectionUpdate', reveal);
    editor.on('update', reveal);
    return () => {
      editor.off('selectionUpdate', reveal);
      editor.off('update', reveal);
    };
  }, [editor, keyboardInset]);

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

  // Menús sobre la barra (tipo de bloque, resaltador, color de texto): uno abierto a la vez.
  // Del resaltador se recuerda el último color usado entre apuntes
  const [openMenu, setOpenMenu] = useState<ToolbarMenuId | null>(null);
  const toggleMenu = (menu: ToolbarMenuId) => setOpenMenu((current) => (current === menu ? null : menu));
  const [lastHighlight, setLastHighlight] = useState<HighlightColor>(readLastHighlight);
  const menuRef = useRef<HTMLDivElement>(null);
  // Apartado visible de la barra; «Tabla» se abre solo al entrar en una tabla (ver más abajo)
  const [section, setSection] = useState<ToolbarSection>('inicio');
  const [prevInTable, setPrevInTable] = useState(false);
  // Sombreado de tabla: a qué se aplica (celda, fila o columna)
  const [shadeTarget, setShadeTarget] = useState<ShadeTarget>('cell');
  // Calendario para insertar una fecha
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  // Enlace en edición: null = cuadro cerrado
  const [linkDraft, setLinkDraft] = useState<{ url: string; text: string; needsText: boolean } | null>(null);
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (menuRef.current?.contains(target) || target?.closest('[data-menu-trigger]')) return;
      setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpenMenu(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

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
    setOpenMenu(null);
  };

  const activeTextColorAttr: unknown = editor.getAttributes('textStyle').color;
  const activeTextColor = typeof activeTextColorAttr === 'string' ? toHexColor(activeTextColorAttr) : null;
  const applyTextColor = (value: string | null) => {
    if (value) chain().setColor(value).run();
    else chain().unsetColor().run();
    setOpenMenu(null);
  };

  const currentBlock: BlockType = editor.isActive('codeBlock')
    ? 'code'
    : editor.isActive('heading', { level: 1 })
      ? 'h1'
      : editor.isActive('heading', { level: 2 })
        ? 'h2'
        : editor.isActive('heading', { level: 3 })
          ? 'h3'
          : editor.isActive('blockquote')
            ? 'quote'
            : 'paragraph';
  const currentBlockInfo = BLOCK_TYPES.find((block) => block.id === currentBlock) ?? BLOCK_TYPES[0];
  const setBlockType = (block: BlockType) => {
    setOpenMenu(null);
    if (block === currentBlock) return;
    // Primero a párrafo (sale de la cita o del bloque de código) y luego al tipo elegido
    let next = chain();
    if (editor.isActive('blockquote')) next = next.unsetBlockquote();
    next = next.setParagraph();
    if (block === 'h1' || block === 'h2' || block === 'h3') next = next.setHeading({ level: block === 'h1' ? 1 : block === 'h2' ? 2 : 3 });
    else if (block === 'quote') next = next.setBlockquote();
    else if (block === 'code') next = next.setCodeBlock();
    next.run();
  };

  /** Abre el cuadro del enlace con lo que ya hay (si el cursor está en un enlace, para editarlo). */
  const openLinkDialog = () => {
    setOpenMenu(null);
    const href: unknown = editor.getAttributes('link').href;
    const needsText = editor.state.selection.empty && !editor.isActive('link');
    setLinkDraft({ url: typeof href === 'string' ? href : '', text: '', needsText });
  };
  const applyLink = () => {
    if (!linkDraft) return;
    const href = normalizeLinkUrl(linkDraft.url);
    setLinkDraft(null);
    if (!href) {
      chain().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (linkDraft.needsText) {
      // Sin texto seleccionado: se escribe el texto (o la dirección) ya enlazado
      const text = linkDraft.text.trim() || href.replace(/^(mailto:|tel:)/i, '');
      chain().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      chain().extendMarkRange('link').setLink({ href }).run();
    }
  };

  /** Escribe la fecha elegida en el calendario, con mayúscula al inicio de un párrafo. */
  const insertDate = (dateKey: string) => {
    setIsDatePickerOpen(false);
    const [year, month, day] = dateKey.split('-').map(Number);
    const capitalize = editor.state.selection.$from.parentOffset === 0;
    chain().insertContent(`${dateText(new Date(year, month - 1, day), capitalize)} `).run();
  };

  const inTable = editor.isActive('table');
  const multiCell = inTable && hasMultiCellSelection(editor);
  const activeShadeAttr: unknown = editor.getAttributes('tableCell').shade ?? editor.getAttributes('tableHeader').shade;
  const activeShade = isHighlightColor(activeShadeAttr) ? activeShadeAttr : null;
  const applyShade = (shade: HighlightColor | null) => {
    shadeTableCells(editor, shadeTarget, shade);
    setOpenMenu(null);
  };

  const listItemType = editor.isActive('taskItem') ? 'taskItem' : 'listItem';
  const activeFontFamilyAttr: unknown = editor.getAttributes('textStyle').fontFamily;
  const activeFontSizeAttr: unknown = editor.getAttributes('textStyle').fontSize;
  const activeFont = FONT_FAMILIES.find((font) => font.value === activeFontFamilyAttr) ?? FONT_FAMILIES[0];
  const activeSize = FONT_SIZES.find((size) => size.value === activeFontSizeAttr) ?? FONT_SIZES[1];
  const insertSymbol = (symbol: string) => {
    chain().insertContent(symbol).run();
    setOpenMenu(null);
  };

  // La pestaña «Tabla» aparece (y se abre sola) al entrar en una tabla, como en Word; al salir vuelve a Inicio
  if (inTable !== prevInTable) {
    setPrevInTable(inTable);
    if (inTable) setSection('tabla');
    else if (section === 'tabla') setSection('inicio');
  }
  const visibleSections = TOOLBAR_SECTIONS.filter((item) =>
    item.id === 'tabla' ? inTable : item.id === 'vista' ? viewCommands.length > 0 : item.id === 'archivo' ? fileCommands.length > 0 : true
  );
  const activeSection: ToolbarSection = visibleSections.some((item) => item.id === section) ? section : 'inicio';
  const chooseSection = (next: ToolbarSection) => {
    setSection(next);
    setOpenMenu(null);
    formatScroller?.scrollTo({ left: 0 });
  };

  const align = (value: 'left' | 'center' | 'right' | 'justify', label: string, icon: React.ComponentType<{ className?: string }>): ToolbarAction => ({
    id: `align-${value}`,
    label,
    icon,
    run: () => chain().setTextAlign(value).run(),
    isActive: value === 'left' ? !editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'justify' }) : editor.isActive({ textAlign: value }),
  });

  // Cada apartado con sus grupos (separados por una línea fina). Orden por uso al tomar apuntes
  const sectionGroups: Record<ToolbarSection, { label: string; actions: ToolbarAction[] }[]> = {
    inicio: [
      {
        label: 'Fuente',
        actions: [
          { id: 'font', label: `Fuente: ${activeFont.label}`, icon: Type, run: () => toggleMenu('font'), isActive: openMenu === 'font' || activeFont.value !== null, menuTrigger: true },
          { id: 'size', label: `Tamaño: ${activeSize.label}`, icon: ALargeSmall, run: () => toggleMenu('size'), isActive: openMenu === 'size' || activeSize.value !== null, menuTrigger: true },
        ],
      },
      {
        label: 'Estilo de texto',
        actions: [
          { id: 'bold', label: 'Negrita (Ctrl+B)', icon: Bold, run: () => chain().toggleBold().run(), isActive: editor.isActive('bold') },
          { id: 'italic', label: 'Cursiva (Ctrl+I)', icon: Italic, run: () => chain().toggleItalic().run(), isActive: editor.isActive('italic') },
          { id: 'underline', label: 'Subrayado (Ctrl+U)', icon: Underline, run: () => chain().toggleUnderline().run(), isActive: editor.isActive('underline') },
          { id: 'strike', label: 'Tachado', icon: Strikethrough, run: () => chain().toggleStrike().run(), isActive: editor.isActive('strike') },
          { id: 'subscript', label: 'Subíndice (H₂O)', icon: Subscript, run: () => chain().toggleSubscript().run(), isActive: editor.isActive('subscript') },
          { id: 'superscript', label: 'Superíndice (x²)', icon: Superscript, run: () => chain().toggleSuperscript().run(), isActive: editor.isActive('superscript') },
          { id: 'code', label: 'Código en línea', icon: Code, run: () => chain().toggleCode().run(), isActive: editor.isActive('code') },
        ],
      },
      {
        label: 'Color',
        actions: [
          {
            id: 'highlight',
            label: HIGHLIGHT_BUTTON_LABEL,
            icon: Highlighter,
            run: () => toggleMenu('highlight'),
            isActive: editor.isActive('highlight') || openMenu === 'highlight',
            indicatorColor: activeHighlight ?? lastHighlight,
            menuTrigger: true,
          },
          {
            id: 'color',
            label: 'Color del texto',
            icon: Palette,
            run: () => toggleMenu('color'),
            isActive: openMenu === 'color',
            indicatorHex: activeTextColor ?? undefined,
            menuTrigger: true,
          },
          { id: 'clear', label: 'Borrar formato', icon: RemoveFormatting, run: () => chain().unsetAllMarks().clearNodes().run() },
        ],
      },
      {
        label: 'Párrafo',
        actions: [
          { id: 'bullet', label: 'Lista con viñetas', icon: List, run: () => chain().toggleBulletList().run(), isActive: editor.isActive('bulletList') },
          { id: 'ordered', label: 'Lista numerada', icon: ListOrdered, run: () => chain().toggleOrderedList().run(), isActive: editor.isActive('orderedList') },
          { id: 'tasks', label: 'Lista de tareas', icon: ListChecks, run: () => chain().toggleTaskList().run(), isActive: editor.isActive('taskList') },
          { id: 'outdent', label: 'Disminuir sangría', icon: IndentDecrease, run: () => chain().liftListItem(listItemType).run(), disabled: !editor.can().liftListItem(listItemType) },
          { id: 'indent', label: 'Aumentar sangría', icon: IndentIncrease, run: () => chain().sinkListItem(listItemType).run(), disabled: !editor.can().sinkListItem(listItemType) },
        ],
      },
      {
        label: 'Alineación',
        actions: [
          align('left', 'Alinear a la izquierda', AlignLeft),
          align('center', 'Centrar', AlignCenter),
          align('right', 'Alinear a la derecha', AlignRight),
          align('justify', 'Justificar', AlignJustify),
        ],
      },
    ],
    insertar: [
      {
        label: 'Imágenes y voz',
        actions: [
          { id: 'ins-gallery', label: 'Imagen de la galería', icon: ImageIcon, run: openGallery, disabled: isProcessingImage },
          { id: 'ins-camera', label: 'Foto con la cámara', icon: Camera, run: openCamera, disabled: isProcessingImage },
          ...(onRecordVoice ? [{ id: 'ins-voice', label: 'Nota de voz', icon: Mic, run: onRecordVoice }] : []),
          // En Android siempre visible: lee el portapapeles del teléfono (fotos copiadas aquí o en
          // otra app); en la web, solo cuando hay una foto copiada dentro del editor
          ...(imageClip || Capacitor.isNativePlatform()
            ? [{ id: 'paste-image', label: 'Pegar imagen', icon: ClipboardPaste, run: () => void pasteImage(), disabled: isProcessingImage }]
            : []),
        ],
      },
      {
        label: 'Elementos',
        actions: [
          { id: 'table', label: 'Tabla (3 × 3)', icon: TableIcon, run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), disabled: inTable },
          { id: 'link', label: editor.isActive('link') ? 'Editar enlace' : 'Enlace', icon: LinkIcon, run: openLinkDialog, isActive: editor.isActive('link') },
          { id: 'date', label: 'Fecha (calendario)', icon: CalendarDays, run: () => setIsDatePickerOpen(true) },
          { id: 'symbol', label: 'Símbolo (π, ±, √…)', icon: Omega, run: () => toggleMenu('symbol'), isActive: openMenu === 'symbol', menuTrigger: true },
          { id: 'divider', label: 'Línea divisoria', icon: Minus, run: () => chain().setHorizontalRule().run() },
          { id: 'page-break', label: 'Salto de página (Ctrl+Enter)', icon: SeparatorHorizontal, run: () => chain().setPageBreak().run() },
        ],
      },
    ],
    tabla: [
      {
        label: 'Formato de la tabla',
        actions: [
          {
            id: 'shade',
            label: 'Sombrear celdas, filas o columnas',
            icon: PaintBucket,
            run: () => toggleMenu('shade'),
            isActive: openMenu === 'shade',
            indicatorColor: activeShade ?? undefined,
            menuTrigger: true,
          },
          {
            id: 'header-row',
            label: 'Primera fila como encabezado',
            icon: PanelTop,
            run: () => chain().toggleHeaderRow().run(),
            isActive: editor.isActive('tableHeader'),
          },
          { id: 'merge', label: 'Combinar celdas seleccionadas', icon: TableCellsMerge, run: () => chain().mergeCells().run(), disabled: !editor.can().mergeCells() },
          { id: 'split', label: 'Dividir celda', icon: TableCellsSplit, run: () => chain().splitCell().run(), disabled: !editor.can().splitCell() },
        ],
      },
      {
        label: 'Filas y columnas',
        actions: [
          { id: 'row-before', label: 'Agregar fila arriba', icon: BetweenHorizontalStart, run: () => chain().addRowBefore().run() },
          { id: 'row-add', label: 'Agregar fila debajo', icon: BetweenHorizontalEnd, run: () => chain().addRowAfter().run() },
          { id: 'col-add', label: 'Agregar columna a la derecha', icon: BetweenVerticalEnd, run: () => chain().addColumnAfter().run() },
          { id: 'row-del', label: 'Quitar esta fila', icon: TableRowsSplit, run: () => chain().deleteRow().run() },
          { id: 'col-del', label: 'Quitar esta columna', icon: TableColumnsSplit, run: () => chain().deleteColumn().run() },
          { id: 'table-del', label: 'Eliminar la tabla', icon: Grid2x2X, run: () => chain().deleteTable().run() },
        ],
      },
    ],
    vista: [{ label: 'Vista', actions: viewCommands }],
    archivo: [{ label: 'Archivo', actions: fileCommands }],
  };
  const toolbarGroups = sectionGroups[activeSection];
  const labeledSection = activeSection === 'vista' || activeSection === 'archivo';

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
        ref={toolbarRef}
        style={{
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
          // Encima del teclado en el navegador del teléfono (ver keyboardInset)
          bottom: keyboardInset,
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
        <>
        {/* Apartados, como las pestañas de Word en el teléfono */}
        <div role="tablist" aria-label="Apartados de herramientas" className="mx-auto flex max-w-3xl items-center gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleSections.map((item) => {
            const selected = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chooseSection(item.id)}
                className={`h-7 shrink-0 rounded-full px-3 text-xs font-bold transition-colors duration-150 ${
                  selected
                    ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                    : item.id === 'tabla'
                      ? 'text-[var(--color-md-primary)] hover:bg-[var(--color-md-surface-container-high)]'
                      : 'text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)] hover:text-[var(--color-md-on-surface)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div role="toolbar" aria-label={`Herramientas: ${TOOLBAR_SECTIONS.find((item) => item.id === activeSection)?.label ?? ''}`} className="relative mx-auto flex max-w-3xl items-center gap-2 py-0.5">
          {/* Tipo de bloque: texto normal, títulos 1 a 3, cita y bloque de código */}
          {openMenu === 'block' && (
            <div ref={menuRef} role="menu" aria-label="Tipo de bloque" className={`${TOOLBAR_MENU_CLASS} left-0 w-56 p-1.5`}>
              {BLOCK_TYPES.map((block) => {
                const BlockIcon = block.icon;
                const isCurrent = block.id === currentBlock;
                return (
                  <button
                    key={block.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isCurrent}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setBlockType(block.id)}
                    className={`flex min-h-[42px] w-full items-center gap-3 rounded-2xl px-3 text-left text-sm transition-colors ${
                      isCurrent
                        ? 'bg-[var(--color-md-primary-container)] font-bold text-[var(--color-md-on-primary-container)]'
                        : 'text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-surface-container)]'
                    }`}
                  >
                    <BlockIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="flex-1">{block.label}</span>
                    {isCurrent && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
          {/* Fuente y tamaño: listas con vista previa */}
          {(openMenu === 'font' || openMenu === 'size') && (
            <div ref={menuRef} role="menu" aria-label={openMenu === 'font' ? 'Fuente' : 'Tamaño de letra'} className={`${TOOLBAR_MENU_CLASS} left-0 w-56 p-1.5`}>
              {(openMenu === 'font' ? FONT_FAMILIES : FONT_SIZES).map((option) => {
                const isCurrent = openMenu === 'font' ? option.id === activeFont.id : option.id === activeSize.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isCurrent}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (openMenu === 'font') {
                        if (option.value) chain().setFontFamily(option.value).run();
                        else chain().unsetFontFamily().run();
                      } else if (option.value) chain().setFontSize(option.value).run();
                      else chain().unsetFontSize().run();
                      setOpenMenu(null);
                    }}
                    style={openMenu === 'font' ? { fontFamily: option.value ?? undefined } : { fontSize: option.value ?? undefined }}
                    className={`flex min-h-[42px] w-full items-center gap-3 rounded-2xl px-3 text-left text-sm transition-colors ${
                      isCurrent
                        ? 'bg-[var(--color-md-primary-container)] font-bold text-[var(--color-md-on-primary-container)]'
                        : 'text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-surface-container)]'
                    }`}
                  >
                    <span className="flex-1">{option.label}</span>
                    {isCurrent && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
          {/* Símbolos frecuentes */}
          {openMenu === 'symbol' && (
            <div ref={menuRef} role="group" aria-label="Símbolos" className={`${TOOLBAR_MENU_CLASS} left-1/2 w-max -translate-x-1/2`}>
              <p className="mb-2 px-1 text-xs font-bold text-[var(--color-md-on-surface-variant)]">Símbolos</p>
              <div className="grid grid-cols-8 gap-1">
                {SYMBOLS.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertSymbol(symbol)}
                    aria-label={`Insertar ${symbol}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-base text-[var(--color-md-on-surface)] transition-colors hover:bg-[var(--color-md-surface-container)] active:scale-90"
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Sombreado de tabla: a qué se aplica y el tono (los del resaltador) */}
          {openMenu === 'shade' && (
            <div ref={menuRef} role="group" aria-label="Sombreado de la tabla" className={`${TOOLBAR_MENU_CLASS} left-0 w-max`}>
              <p className="mb-2 px-1 text-xs font-bold text-[var(--color-md-on-surface-variant)]">Sombrear</p>
              <div role="radiogroup" aria-label="Aplicar a" className="mb-3 flex gap-1 rounded-full bg-[var(--color-md-surface-container)] p-1">
                {(
                  [
                    { id: 'cell', label: multiCell ? 'Celdas' : 'Celda' },
                    { id: 'row', label: 'Fila' },
                    { id: 'column', label: 'Columna' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={shadeTarget === option.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShadeTarget(option.id)}
                    className={`min-h-[34px] flex-1 rounded-full px-3 text-xs font-bold transition-colors ${
                      shadeTarget === option.id
                        ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                        : 'text-[var(--color-md-on-surface-variant)] hover:text-[var(--color-md-on-surface)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    data-color={color.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyShade(color.id)}
                    aria-label={`Sombrear en ${color.label.toLowerCase()}`}
                    title={color.label}
                    className={`note-hl-swatch flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90 ${
                      activeShade === color.id
                        ? 'ring-2 ring-[var(--color-md-primary)] ring-offset-2 ring-offset-[var(--color-md-surface-container-high)]'
                        : 'ring-1 ring-black/10 dark:ring-white/15'
                    }`}
                  >
                    {activeShade === color.id && <Check className="h-4 w-4 text-[var(--color-md-on-surface)]" aria-hidden="true" />}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyShade(null)}
                className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-surface-container)]"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                Sin sombreado
              </button>
            </div>
          )}
          {/* Color del texto: 8 tonos y quitar color */}
          {openMenu === 'color' && (
            <div ref={menuRef} role="group" aria-label="Colores del texto" className={`${TOOLBAR_MENU_CLASS} left-1/2 w-max -translate-x-1/2`}>
              <p className="mb-2 px-1 text-xs font-bold text-[var(--color-md-on-surface-variant)]">Color del texto</p>
              <div className="grid grid-cols-4 gap-2 min-[400px]:grid-cols-8">
                {TEXT_COLORS.map((color) => {
                  const isCurrent = activeTextColor === color.value;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTextColor(color.value)}
                      aria-label={`Texto en ${color.label.toLowerCase()}`}
                      aria-pressed={isCurrent}
                      title={color.label}
                      style={{ backgroundColor: color.value }}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-90 ${
                        isCurrent ? 'ring-2 ring-[var(--color-md-primary)] ring-offset-2 ring-offset-[var(--color-md-surface-container-high)]' : 'ring-1 ring-black/10 dark:ring-white/15'
                      }`}
                    >
                      {isCurrent && <Check className="h-4 w-4 text-white" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTextColor(null)}
                disabled={!activeTextColor}
                className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-surface-container)] disabled:opacity-40"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                Color normal
              </button>
            </div>
          )}
          {/* Paleta del resaltador (menú M3 sobre la barra): 7 colores y quitar resaltado */}
          {openMenu === 'highlight' && (
            <div
              ref={menuRef}
              role="group"
              aria-label="Colores del resaltador"
              className={`${TOOLBAR_MENU_CLASS} left-1/2 w-max -translate-x-1/2`}
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
                  setOpenMenu(null);
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
              {/* Tipo de bloque (solo en Inicio): muestra el actual (Texto, Título 1…) y abre el menú */}
              {activeSection === 'inicio' && (
              <>
              <button
                type="button"
                data-menu-trigger="true"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleMenu('block')}
                aria-label={`Tipo de bloque: ${currentBlockInfo.label}`}
                aria-haspopup="menu"
                aria-expanded={openMenu === 'block'}
                title="Tipo de bloque"
                className={`flex h-[38px] shrink-0 items-center gap-1 rounded-xl pl-2 pr-1.5 text-xs font-bold transition-all duration-150 ease-out active:scale-95 ${
                  openMenu === 'block'
                    ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                    : 'text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-surface-container-high)]'
                }`}
              >
                <currentBlockInfo.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{currentBlockInfo.short}</span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${openMenu === 'block' ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--color-md-outline-variant)]" aria-hidden="true" />
              </>
              )}
              {toolbarGroups.map((group, index) => (
                <React.Fragment key={group.label}>
                  {index > 0 && <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--color-md-outline-variant)]" aria-hidden="true" />}
                  <div role="group" aria-label={group.label} className="flex shrink-0 items-center gap-1.5">
                    {group.actions.map(({ id, run, ...action }) => (
                      <ToolbarButton key={id} {...action} onClick={run} showLabel={labeledSection} />
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
            // En el teléfono solo en Inicio: los demás apartados necesitan el ancho (Insertar ya los trae)
            className={`${activeSection === 'inicio' ? 'flex' : 'hidden sm:flex'} shrink-0 items-center gap-0.5 rounded-2xl bg-[var(--color-md-secondary-container)] p-0.5`}
          >
            <ToolbarButton tonal label="Tomar foto con la cámara" icon={Camera} onClick={openCamera} disabled={isProcessingImage} />
            <ToolbarButton tonal label="Imagen de la galería" icon={ImageIcon} onClick={openGallery} disabled={isProcessingImage} />
            {onRecordVoice && <ToolbarButton tonal label="Grabar nota de voz" icon={Mic} onClick={onRecordVoice} />}
          </div>
        </div>
        </>
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

      {/* Calendario: se elige el día y se escribe en el cursor */}
      {isDatePickerOpen && (
        <DatePickerDialog
          initial=""
          allowClear={false}
          title="Insertar fecha"
          confirmLabel="Insertar"
          onCancel={() => setIsDatePickerOpen(false)}
          onConfirm={insertDate}
        />
      )}

      {/* Enlace: dirección (y el texto, si no había nada seleccionado). Vaciar la dirección lo quita */}
      <Modal isOpen={linkDraft !== null} onClose={() => setLinkDraft(null)} title={editor.isActive('link') ? 'Editar enlace' : 'Agregar enlace'} maxWidth="sm">
        {linkDraft && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
            noValidate
            className="space-y-3"
          >
            <label className="block text-xs font-bold text-[var(--color-md-on-surface-variant)]">
              Dirección
              <input
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                value={linkDraft.url}
                onChange={(event) => setLinkDraft({ ...linkDraft, url: event.target.value })}
                placeholder="ejemplo.com o https://…"
                className="mt-1 h-11 w-full rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] px-3 text-sm font-medium text-[var(--color-md-on-surface)] outline-none focus:border-[var(--color-md-primary)]"
              />
            </label>
            {linkDraft.needsText && (
              <label className="block text-xs font-bold text-[var(--color-md-on-surface-variant)]">
                Texto que se verá (opcional)
                <input
                  type="text"
                  value={linkDraft.text}
                  onChange={(event) => setLinkDraft({ ...linkDraft, text: event.target.value })}
                  placeholder="Si lo dejas vacío, se verá la dirección"
                  className="mt-1 h-11 w-full rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] px-3 text-sm font-medium text-[var(--color-md-on-surface)] outline-none focus:border-[var(--color-md-primary)]"
                />
              </label>
            )}
            <ModalActions>
              {editor.isActive('link') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLinkDraft(null);
                    chain().extendMarkRange('link').unsetLink().run();
                  }}
                >
                  Quitar enlace
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setLinkDraft(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Listo
              </Button>
            </ModalActions>
          </form>
        )}
      </Modal>

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
