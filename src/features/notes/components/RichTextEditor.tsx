import React, { useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Camera,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { compressImage } from '../utils/imageCompression';
import { ImageZoomModal } from '../../../shared/components/ImageZoomModal';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  actionsSlot?: React.ReactNode;
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
  placeholder = 'Escribe aquí tus apuntes de clase...',
  actionsSlot,
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
          class: 'rounded-2xl max-w-full my-4 shadow-md border border-slate-200 block mx-auto cursor-zoom-in hover:ring-2 hover:ring-cove-sky/50 transition-all active:scale-[0.99]',
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
          'min-h-[420px] sm:min-h-[580px] py-3 px-1 focus:outline-none text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed prose prose-slate dark:prose-invert max-w-none pb-28',
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
    <div className="space-y-3">
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

      {/* Área del documento editable (con espacio suficiente para no solaparse con la barra inferior) */}
      <EditorContent editor={editor} />

      {/* Menú inferior exclusivo de edición (Docked Two-Row Bottom Action Bar) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-2xl px-3 sm:px-6 py-2.5 space-y-2">
        {/* FILA 1: Deshacer, Rehacer, Formato (B, I, U, S), Encabezados (H1, H2) + Guardar Apunte */}
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          {/* Herramientas de formato con scroll horizontal suave en móviles pequeños */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {/* Deshacer / Rehacer */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg cursor-pointer transition-all active:scale-90"
                title="Deshacer (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg cursor-pointer transition-all active:scale-90"
                title="Rehacer (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Separador vertical */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

            {/* Formato de texto básico: Negrita, Cursiva, Subrayado, Tachado */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                  editor.isActive('bold')
                    ? 'bg-cove-blue text-white shadow-2xs font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Negrita (Ctrl+B)"
              >
                <span className="font-bold text-sm">B</span>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                  editor.isActive('italic')
                    ? 'bg-cove-blue text-white shadow-2xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Cursiva (Ctrl+I)"
              >
                <span className="italic font-serif font-bold text-sm">I</span>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                  editor.isActive('underline')
                    ? 'bg-cove-blue text-white shadow-2xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Subrayado (Ctrl+U)"
              >
                <span className="underline font-bold text-sm underline-offset-2">U</span>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                  editor.isActive('strike')
                    ? 'bg-cove-blue text-white shadow-2xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Tachado"
              >
                <span className="line-through font-bold text-sm">S</span>
              </button>
            </div>

            {/* Separador vertical */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

            {/* Encabezados H1, H2 */}
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                  editor.isActive('heading', { level: 1 })
                    ? 'bg-cove-blue text-white shadow-2xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Título Principal (H1)"
              >
                <span className="font-black text-xs">H<sub className="text-[10px]">1</sub></span>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                  editor.isActive('heading', { level: 2 })
                    ? 'bg-cove-blue text-white shadow-2xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Subtítulo (H2)"
              >
                <span className="font-black text-xs">H<sub className="text-[10px]">2</sub></span>
              </button>
            </div>

            {/* Separador vertical */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
          </div>

          {/* Botón Guardar Apunte en la Fila 1 */}
          {actionsSlot && (
            <div className="shrink-0 pl-1.5">
              {actionsSlot}
            </div>
          )}
        </div>

        {/* FILA 2: Viñetas, Lista ordenada, Citas, Separador + Botones Foto y Galería */}
        <div className="flex items-center gap-1 sm:gap-1.5 pt-0.5">
          {/* Listas, Cita y Separador */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-all active:scale-90 ${
                editor.isActive('bulletList')
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Cita o nota destacada"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-all active:scale-90"
              title="Línea divisoria horizontal"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Separador vertical */}
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

          {/* Inserción de Fotos Inline */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-cove-blue dark:text-cove-sky text-xs font-bold rounded-xl border border-cove-sky/40 dark:border-cove-sky/50 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Tomar foto con la cámara e insertarla en el texto"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Foto</span>
            </button>

            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-900 dark:text-white text-xs font-bold rounded-xl border-2 border-slate-900 dark:border-slate-200 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Subir imagen de la galería e insertarla en el texto"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Galería</span>
            </button>

            {isProcessingImage && (
              <span className="flex items-center gap-1 text-[11px] text-cove-blue dark:text-cove-sky font-medium ml-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Insertando...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Visor Interactivo con Zoom y Arrastre para la foto ampliada */}
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
