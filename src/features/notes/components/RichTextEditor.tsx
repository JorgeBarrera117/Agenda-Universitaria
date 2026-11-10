import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
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
        HTMLAttributes: {
          class: 'rounded-2xl max-w-full my-3 block mx-auto cursor-zoom-in transition-shadow duration-150',
          title: 'Toca para ampliar y hacer zoom',
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
      handleDOMEvents: {
        click: (_view, event) => {
          const target = event.target as HTMLElement;
          if (target && target.tagName === 'IMG') {
            const img = target as HTMLImageElement;
            setZoomedImage({ src: img.src, alt: img.alt || 'Foto del apunte' });
            return true;
          }
          return false;
        },
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  const openCamera = useCallback(() => cameraInputRef.current?.click(), []);
  const openGallery = useCallback(() => galleryInputRef.current?.click(), []);

  if (!editor) return null;

  // Inserta la imagen comprimida exactamente en la posición del cursor
  const handleImageInsert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const { blob } = await compressImage(file);
      const dataUrl = await blobToDataUrl(blob);
      editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
    } catch (err: unknown) {
      onImageError?.(err instanceof Error ? err.message : 'No se pudo insertar la imagen.');
    } finally {
      setIsProcessingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const chain = () => editor.chain().focus();

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

        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-1 pt-0.5 text-[11px] font-medium text-[var(--color-md-on-surface-variant)]">
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

      {zoomedImage && <ImageZoomModal src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} />}
    </div>
  );
};
