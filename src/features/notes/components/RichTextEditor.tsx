import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { NodeSelection, Selection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import {
  ArrowDown,
  ArrowUp,
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
  Quote,
  Minus,
  Camera,
  Image as ImageIcon,
  Mic,
  Loader2,
  Heading1,
  Heading2,
} from 'lucide-react';
import { compressImage } from '../utils/imageCompression';
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
}

interface ImageClip {
  src: string;
  alt?: string;
}

/** Archivos de imagen de un pegado o arrastre (algunos WebView solo los exponen en items). */
function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  // Los archivos vacíos (0 bytes) se descartan: no hay imagen que insertar
  const files = Array.from(data.files).filter((file) => file.type.startsWith('image/') && file.size > 0);
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

/**
 * Inserta una imagen en la selección (o en `pos`, al soltar un arrastre) y deja el cursor en el
 * párrafo de debajo, creándolo si hace falta: si la imagen quedara seleccionada, lo siguiente que
 * se escribiera la reemplazaría.
 */
function insertImageInView(view: EditorView, src: string, alt: string, pos?: number): void {
  const { state } = view;
  const imageType = state.schema.nodes.image;
  if (!imageType) return;
  const node = imageType.create({ src, alt });
  const tr = state.tr;
  const target = pos ?? (state.selection.empty ? state.selection.from : undefined);
  const $target = target === undefined ? null : state.doc.resolve(target);
  if (!$target || !$target.parent.isTextblock) {
    if (target === undefined) tr.replaceSelectionWith(node, false);
    else tr.insert(target, node);
  } else if ($target.parent.content.size === 0) {
    // Párrafo vacío: la foto lo sustituye en vez de dejar un hueco encima
    tr.replaceWith($target.before(), $target.after(), node);
  } else if ($target.parentOffset === 0) {
    tr.insert($target.before(), node);
  } else if ($target.parentOffset === $target.parent.content.size) {
    tr.insert($target.after(), node);
  } else {
    // En medio del texto: se divide el párrafo
    tr.insert(target as number, node);
  }

  // ProseMirror conserva la instancia del nodo insertado: se localiza para situar el cursor debajo
  let after = -1;
  tr.doc.descendants((child, childPos) => {
    if (after >= 0) return false;
    if (child === node) {
      after = childPos + child.nodeSize;
      return false;
    }
    return true;
  });
  if (after >= 0) {
    if (!tr.doc.resolve(after).nodeAfter) tr.insert(after, state.schema.nodes.paragraph.create());
    tr.setSelection(Selection.near(tr.doc.resolve(after), 1));
  }
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

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

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ label, icon: Icon, onClick, isActive, disabled, tonal = false }) => {
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
      className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl transition-all duration-150 ease-out active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
        isActive
          ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
          : tonal
            ? 'text-[var(--color-md-on-secondary-container)] hover:bg-black/5 dark:hover:bg-white/10'
            : 'text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)] hover:text-[var(--color-md-on-surface)]'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  );
};

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
      Image.configure({
        inline: false,
        allowBase64: true,
        // TipTap 3 ya declara la imagen como arrastrable (draggable: true en el nodo)
        HTMLAttributes: {
          class: 'rounded-2xl max-w-full my-3 block mx-auto cursor-pointer select-none transition-shadow duration-150',
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-full flex-1 w-full py-2 px-0.5 sm:px-1 focus:outline-none text-[var(--color-md-on-surface)] text-[15px] sm:text-base leading-relaxed max-w-none pb-24',
        'aria-label': 'Contenido del apunte',
      },
      // Sin handleDOMEvents.click: tocar una foto la selecciona para editarla; el zoom es un botón
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
    if (!editor) return;
    const dom = editor.view.dom;
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
      const pos = view.posAtDOM(img, 0);
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

    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    dom.addEventListener('touchmove', onTouchMove, { passive: true });
    dom.addEventListener('touchend', cancelTimer);
    dom.addEventListener('touchcancel', cancelTimer);
    dom.addEventListener('contextmenu', onContextMenu);
    return () => {
      cancelTimer();
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', cancelTimer);
      dom.removeEventListener('touchcancel', cancelTimer);
      dom.removeEventListener('contextmenu', onContextMenu);
    };
  }, [editor]);

  const openCamera = useCallback(() => cameraInputRef.current?.click(), []);
  const openGallery = useCallback(() => galleryInputRef.current?.click(), []);

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

  // Imagen seleccionada (NodeSelection) y si tiene hermanos para moverla
  const { selection } = editor.state;
  const selectedImage =
    selection instanceof NodeSelection && selection.node.type.name === 'image' ? selection : null;
  const imageIndex = selectedImage ? editor.state.doc.resolve(selectedImage.from).index() : 0;
  const imageParent = selectedImage ? editor.state.doc.resolve(selectedImage.from).parent : null;
  const canMoveUp = Boolean(selectedImage) && imageIndex > 0;
  const canMoveDown = Boolean(imageParent) && imageIndex < (imageParent?.childCount ?? 0) - 1;

  const currentImageClip = (): ImageClip | null => {
    if (!selectedImage) return null;
    const { src, alt } = selectedImage.node.attrs as { src: string; alt?: string | null };
    return { src, alt: alt ?? undefined };
  };

  /** Intercambia la imagen con el bloque anterior (-1) o siguiente (+1), conservándola seleccionada. */
  const moveSelectedImage = (direction: -1 | 1) => {
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

  const deselectImage = placeCursorAfterImage;

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

  const imageActions: ToolbarAction[] = [
    {
      id: 'zoom',
      label: 'Ampliar imagen',
      icon: ZoomIn,
      run: () => {
        const clip = currentImageClip();
        if (clip) setZoomedImage({ src: clip.src, alt: clip.alt || 'Foto del apunte' });
      },
    },
    { id: 'up', label: 'Mover arriba', icon: ArrowUp, run: () => moveSelectedImage(-1), disabled: !canMoveUp },
    { id: 'down', label: 'Mover abajo', icon: ArrowDown, run: () => moveSelectedImage(1), disabled: !canMoveDown },
    { id: 'copy', label: 'Copiar imagen', icon: Copy, run: () => void copySelectedImage(false) },
    { id: 'cut', label: 'Cortar imagen', icon: Scissors, run: () => void copySelectedImage(true) },
    {
      id: 'delete',
      label: 'Eliminar imagen',
      icon: Trash2,
      run: () => {
        chain().deleteSelection().run();
        showNotice('Imagen eliminada.');
      },
    },
  ];

  // Orden por uso al tomar apuntes: lo más frecuente queda a la vista sin desplazar
  const toolbarGroups: { label: string; actions: ToolbarAction[] }[] = [
    {
      label: 'Estilo de texto',
      actions: [
        { id: 'bold', label: 'Negrita (Ctrl+B)', icon: Bold, run: () => chain().toggleBold().run(), isActive: editor.isActive('bold') },
        { id: 'italic', label: 'Cursiva (Ctrl+I)', icon: Italic, run: () => chain().toggleItalic().run(), isActive: editor.isActive('italic') },
        { id: 'underline', label: 'Subrayado (Ctrl+U)', icon: Underline, run: () => chain().toggleUnderline().run(), isActive: editor.isActive('underline') },
      ],
    },
    {
      label: 'Listas',
      actions: [
        { id: 'bullet', label: 'Lista con viñetas', icon: List, run: () => chain().toggleBulletList().run(), isActive: editor.isActive('bulletList') },
        { id: 'ordered', label: 'Lista numerada', icon: ListOrdered, run: () => chain().toggleOrderedList().run(), isActive: editor.isActive('orderedList') },
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
      <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleImageInsert} className="hidden" />

      <div
        onClick={() => {
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
        {selectedImage ? (
          /* Barra contextual de imagen: reemplaza la de formato mientras la foto está seleccionada */
          <div
            role="toolbar"
            aria-label="Acciones de la imagen"
            className="m3-menu-enter mx-auto flex max-w-3xl items-center gap-1.5 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <ToolbarButton label="Terminar edición de la imagen" icon={X} onClick={deselectImage} />
            <span className="shrink-0 pr-1 text-xs font-bold text-[var(--color-md-on-surface)]">Imagen</span>
            <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--color-md-outline-variant)]" aria-hidden="true" />
            {imageActions.map(({ id, run, ...action }) => (
              <ToolbarButton key={id} {...action} onClick={run} />
            ))}
          </div>
        ) : (
        <div role="toolbar" aria-label="Formato del apunte" className="mx-auto flex max-w-3xl items-center gap-2 py-0.5">
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

        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-1 pt-0.5 text-[11px] font-medium text-[var(--color-md-on-surface-variant)]">
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
      {zoomedImage &&
        createPortal(
          <ImageZoomModal src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} />,
          document.body
        )}
    </div>
  );
};
