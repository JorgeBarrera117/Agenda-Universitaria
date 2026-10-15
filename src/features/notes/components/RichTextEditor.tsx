import React, { useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
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
          'min-h-[420px] sm:min-h-[580px] py-3 px-1 focus:outline-none text-slate-800 text-sm sm:text-base leading-relaxed prose prose-slate max-w-none pb-28',
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

      {/* Menú inferior exclusivo de edición (Docked Bottom Action Bar) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl px-2 sm:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Herramientas de formato con scroll horizontal suave */}
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {/* Deshacer / Rehacer */}
          <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg cursor-pointer transition-colors"
              title="Deshacer (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 disabled:opacity-30 rounded-lg cursor-pointer transition-colors"
              title="Rehacer (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Formato de texto básico: Negrita, Cursiva, Subrayado, Tachado */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('bold')
                  ? 'bg-cove-blue text-white shadow-2xs font-bold'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Negrita (Ctrl+B)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('italic')
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Cursiva (Ctrl+I)"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('underline')
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Subrayado (Ctrl+U)"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('strike')
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Tachado"
            >
              <Strikethrough className="w-4 h-4" />
            </button>
          </div>

          {/* Encabezados y Estructura */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('heading', { level: 1 })
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Título Grande (H1)"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('heading', { level: 2 })
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Subtítulo (H2)"
            >
              <Heading2 className="w-4 h-4" />
            </button>
          </div>

          {/* Listas y Citas */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('bulletList')
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Lista con viñetas"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('orderedList')
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Lista numerada"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                editor.isActive('blockquote')
                  ? 'bg-cove-blue text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
              title="Cita o nota destacada"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="p-1.5 text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
              title="Línea divisoria horizontal"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Inserción de Fotos Inline */}
          <div className="flex items-center gap-1 pl-1 shrink-0">
            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-cove-blue/10 hover:bg-cove-blue/20 text-cove-blue text-xs font-bold rounded-lg border border-cove-sky/30 transition-colors cursor-pointer"
              title="Tomar foto con la cámara e insertarla en el texto"
            >
              <Camera className="w-3.5 h-3.5" />
              Foto
            </button>
            <button
              type="button"
              disabled={isProcessingImage}
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              title="Subir imagen de la galería e insertarla en el texto"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Galería
            </button>

            {isProcessingImage && (
              <span className="flex items-center gap-1 text-[11px] text-cove-blue font-medium ml-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Insertando...
              </span>
            )}
          </div>
        </div>

        {/* Botón de Guardar integrado en el menú inferior */}
        {actionsSlot && (
          <div className="shrink-0 pl-1.5 border-l border-slate-200/80">
            {actionsSlot}
          </div>
        )}
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
