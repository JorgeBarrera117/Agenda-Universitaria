import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { NodeSelection, Selection } from '@tiptap/pm/state';
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
  Loader2,
  Heading1,
  Heading2,
} from 'lucide-react';
import { compressImage } from '../utils/imageCompression';
import { ImageZoomModal } from '../../../shared/components/ImageZoomModal';

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
}

interface ToolbarAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

// Convertir Blob a DataURL para inserción directa en el documento
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface ImageClip {
  src: string;
  alt?: string;
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** El portapapeles del sistema solo admite imágenes PNG: se re-codifica la foto (JPEG/WebP). */
async function dataUrlToPngBlob(src: string): Promise<Blob> {
  const img = new window.Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')?.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error('No se pudo convertir la imagen.');
  return blob;
}

/**
 * Copia la foto al portapapeles del sistema como HTML (TipTap la vuelve a pegar como imagen) y
 * como PNG (para pegarla en otras apps). Es un extra: si el WebView no lo permite, el botón
 * "Pegar imagen" del editor usa el búfer interno.
 */
async function writeImageToSystemClipboard(clip: ImageClip): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return;
  const html = `<img src="${clip.src}" alt="${escapeHtmlAttr(clip.alt ?? '')}">`;
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'image/png': dataUrlToPngBlob(clip.src),
    }),
  ]);
}

type ToolbarButtonProps = Omit<ToolbarAction, 'id' | 'run'> & { onClick: () => void };

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ label, icon: Icon, onClick, isActive, disabled }) => {
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
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openCamera = useCallback(() => cameraInputRef.current?.click(), []);
  const openGallery = useCallback(() => galleryInputRef.current?.click(), []);

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
      setIsProcessingImage(true);
      const { blob } = await compressImage(file);
      const dataUrl = await blobToDataUrl(blob);
      editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
      placeCursorAfterImage();
    } catch (err: unknown) {
      onImageError?.(err instanceof Error ? err.message : 'No se pudo insertar la imagen.');
    } finally {
      setIsProcessingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const chain = () => editor.chain().focus();

  const showNotice = (text: string) => setNotice({ id: Date.now(), text });

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

  const copySelectedImage = (removeAfter: boolean) => {
    const clip = currentImageClip();
    if (!clip) return;
    setImageClip(clip);
    writeImageToSystemClipboard(clip).catch(() => undefined);
    if (removeAfter) chain().deleteSelection().run();
    showNotice(
      removeAfter
        ? 'Imagen cortada. Toca «Pegar imagen» donde quieras ponerla.'
        : 'Imagen copiada. Toca «Pegar imagen» donde quieras duplicarla.'
    );
  };

  const deselectImage = placeCursorAfterImage;

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
    { id: 'copy', label: 'Copiar imagen', icon: Copy, run: () => copySelectedImage(false) },
    { id: 'cut', label: 'Cortar imagen', icon: Scissors, run: () => copySelectedImage(true) },
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

  const toolbarGroups: { label: string; actions: ToolbarAction[] }[] = [
    {
      label: 'Estilo de texto',
      actions: [
        { id: 'bold', label: 'Negrita (Ctrl+B)', icon: Bold, run: () => chain().toggleBold().run(), isActive: editor.isActive('bold') },
        { id: 'italic', label: 'Cursiva (Ctrl+I)', icon: Italic, run: () => chain().toggleItalic().run(), isActive: editor.isActive('italic') },
        { id: 'underline', label: 'Subrayado (Ctrl+U)', icon: Underline, run: () => chain().toggleUnderline().run(), isActive: editor.isActive('underline') },
        { id: 'strike', label: 'Tachado', icon: Strikethrough, run: () => chain().toggleStrike().run(), isActive: editor.isActive('strike') },
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
      label: 'Listas y citas',
      actions: [
        { id: 'bullet', label: 'Lista con viñetas', icon: List, run: () => chain().toggleBulletList().run(), isActive: editor.isActive('bulletList') },
        { id: 'ordered', label: 'Lista numerada', icon: ListOrdered, run: () => chain().toggleOrderedList().run(), isActive: editor.isActive('orderedList') },
        { id: 'quote', label: 'Cita destacada', icon: Quote, run: () => chain().toggleBlockquote().run(), isActive: editor.isActive('blockquote') },
      ],
    },
    {
      label: 'Insertar',
      actions: [
        { id: 'divider', label: 'Línea divisoria', icon: Minus, run: () => chain().setHorizontalRule().run() },
        ...(imageClip
          ? [
              {
                id: 'paste-image',
                label: 'Pegar imagen',
                icon: ClipboardPaste,
                run: () => {
                  chain().setImage({ src: imageClip.src, alt: imageClip.alt }).run();
                  placeCursorAfterImage();
                },
              },
            ]
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
        <div
          role="toolbar"
          aria-label="Formato del apunte"
          className="mx-auto flex max-w-3xl items-center gap-1.5 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {toolbarGroups.map((group, index) => (
            <React.Fragment key={group.label}>
              {index > 0 && <span className="mx-0.5 h-6 w-px shrink-0 bg-[var(--color-md-outline-variant)]" aria-hidden="true" />}
              <div role="group" aria-label={group.label} className="flex shrink-0 items-center gap-1.5">
                {group.label === 'Insertar' && (
                  <>
                    <ToolbarButton label="Tomar foto con la cámara" icon={Camera} onClick={openCamera} disabled={isProcessingImage} />
                    <ToolbarButton label="Imagen de la galería" icon={ImageIcon} onClick={openGallery} disabled={isProcessingImage} />
                  </>
                )}
                {group.actions.map(({ id, run, ...action }) => (
                  <ToolbarButton key={id} {...action} onClick={run} />
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
        )}

        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-1 pt-0.5 text-[11px] font-medium text-[var(--color-md-on-surface-variant)]">
          {notice && (
            <span className="mr-auto truncate text-[var(--color-md-on-surface)]" role="status">
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
