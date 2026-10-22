import React, { useRef, useState, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
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
  actionsSlot?: React.ReactNode;
  onEditorReady?: (editor: Editor) => void;
  onTriggerCameraReady?: (fn: () => void) => void;
  onTriggerGalleryReady?: (fn: () => void) => void;
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

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = 'Comienza a redactar tu apunte aquí...',
  actionsSlot,
  onEditorReady,
  onTriggerCameraReady,
  onTriggerGalleryReady,
}) => {
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt?: string } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Underline,
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class:
            'rounded-2xl max-w-full my-4 shadow-md border border-slate-200 block mx-auto cursor-zoom-in hover:ring-2 hover:ring-[#2481cc]/50 transition-all active:scale-[0.99]',
          title: 'Toca para ampliar y hacer zoom',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'min-h-full flex-1 w-full py-2 px-0.5 sm:px-1 focus:outline-none text-[var(--color-md-on-surface)] text-base sm:text-lg leading-relaxed prose dark:prose-invert max-w-none pb-24',
      },
      handleDOMEvents: {
        click: (_view, event) => {
          const target = event.target as HTMLElement;
          if (target && target.tagName === 'IMG') {
            const img = target as HTMLImageElement;
            setZoomedImage({
              src: img.src,
              alt: img.alt || 'Foto del apunte',
            });
            return true;
          }
          return false;
        },
      },
    },
  });

  useEffect(() => {
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    onTriggerCameraReady?.(() => cameraInputRef.current?.click());
    onTriggerGalleryReady?.(() => galleryInputRef.current?.click());
  }, [onTriggerCameraReady, onTriggerGalleryReady]);

  if (!editor) return null;

  // Insertar imagen comprimida exactamente en el cursor
  const handleImageInsert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const { blob } = await compressImage(file);
      const dataUrl = await blobToDataUrl(blob);

      editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al insertar la imagen.');
    } finally {
      setIsProcessingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="relative w-full flex-1 flex flex-col">
      {/* Inputs ocultos para Cámara directa y Galería */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageInsert}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageInsert}
        className="hidden"
      />

      {/* Todo el espacio dedicado al lienzo editable estilo Google Docs (clic en cualquier área vacía enfoca el editor) */}
      <div
        onClick={() => {
          if (!editor.isFocused) {
            editor.chain().focus().run();
          }
        }}
        className="flex-1 w-full flex flex-col cursor-text"
      >
        <EditorContent
          editor={editor}
          className="flex-1 w-full flex flex-col [&>.ProseMirror]:flex-1 [&>.ProseMirror]:w-full"
        />
      </div>

      {/* Barra de Herramientas Inferior estilo Google Docs Mobile (100% borde a borde) */}
      <div
        style={{
          paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
        }}
        className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--color-md-surface-container)] border-t border-[var(--color-md-outline-variant)] shadow-lg sm:px-6 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="w-full flex items-center justify-between md:justify-start md:gap-2 overflow-x-auto scrollbar-none py-0.5">
          {/* Bloque Formato Tipográfico: B, I, U, S */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Bold */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('bold')
                  ? 'bg-[#2481cc] text-white shadow-xs font-black'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Negrita (Ctrl+B)"
            >
              <span className="font-black text-sm">B</span>
            </button>

            {/* Italic */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('italic')
                  ? 'bg-[#2481cc] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Cursiva (Ctrl+I)"
            >
              <span className="italic font-serif font-black text-sm">I</span>
            </button>

            {/* Underline */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('underline')
                  ? 'bg-[#2481cc] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Subrayado (Ctrl+U)"
            >
              <span className="underline font-black text-sm underline-offset-2">U</span>
            </button>

            {/* Strikethrough */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('strike')
                  ? 'bg-[#2481cc] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Tachado"
            >
              <span className="line-through font-bold text-sm">S</span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-0.5 shrink-0" />

          {/* Bloque Encabezados: H1, H2 */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('heading', { level: 1 })
                  ? 'bg-[#2481cc] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Título Grande (H1)"
            >
              <Heading1 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('heading', { level: 2 })
                  ? 'bg-[#2481cc] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Subtítulo (H2)"
            >
              <Heading2 className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-0.5 shrink-0" />

          {/* Bloque Listas y Bloques: Bullet, Numbered, Quote, Divider */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('bulletList')
                  ? 'bg-[#2481cc] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Lista con viñetas"
            >
              <List className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('orderedList')
                  ? 'bg-[#2481cc] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Lista numerada"
            >
              <ListOrdered className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('blockquote')
                  ? 'bg-[#2481cc] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
              title="Cita o nota destacada"
            >
              <Quote className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg cursor-pointer transition-all active:scale-90"
              title="Línea horizontal divisoria"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-white/10 mx-0.5 shrink-0" />

          {/* Bloque Multimedia: Cámara y Galería */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2481cc]/10 hover:bg-[#2481cc]/20 text-[#2481cc] dark:text-[#2AABEE] text-xs font-bold rounded-lg border border-[#2481cc]/30 transition-all active:scale-95 cursor-pointer"
              title="Tomar foto con la cámara"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cámara</span>
            </button>

            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg border border-slate-200 dark:border-white/10 transition-all active:scale-95 cursor-pointer"
              title="Insertar imagen de la galería"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Galería</span>
            </button>

            {isProcessingImage && (
              <span className="flex items-center gap-1 text-[11px] text-[#2481cc] font-medium ml-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </span>
            )}
          </div>

          {actionsSlot && <div className="shrink-0">{actionsSlot}</div>}
        </div>
      </div>

      {/* Visor Interactivo con Zoom y Arrastre para fotos ampliadas */}
      {zoomedImage && (
        <ImageZoomModal
          src={zoomedImage.src}
          alt={zoomedImage.alt}
          onClose={() => setZoomedImage(null)}
        />
      )}
    </div>
  );
};
