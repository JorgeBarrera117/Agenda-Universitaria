import { useRef, type ChangeEvent } from 'react';
import { Capacitor } from '@capacitor/core';

/** Tope antes de leer un archivo elegido a mano (los paquetes reales pesan unos pocos KB). */
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

interface SharedFilePickerOptions {
  /** Extensión del formato, p. ej. ".agclass". */
  extension: string;
  /** MIME propio del formato. */
  mimeType: string;
  maxBytes?: number;
  /** Recibe el texto del archivo; si lanza un error (o rechaza), su mensaje se pasa a onError. */
  onContent: (content: string) => void | Promise<void>;
  onError: (message: string) => void;
}

/**
 * Selector de archivos para importar un paquete compartido (.agcontact, .agclass, .agschedule).
 * Devuelve las props de un <input type="file"> oculto y open() para abrirlo desde un botón.
 * En Android no se filtra por tipo: los archivos guardados desde WhatsApp suelen figurar como
 * "archivo desconocido" y un filtro los ocultaría; el contenido se valida después igualmente.
 */
export function useSharedFilePicker({ extension, mimeType, maxBytes = DEFAULT_MAX_BYTES, onContent, onError }: SharedFilePickerOptions) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Se vacía para poder elegir el mismo archivo otra vez
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > maxBytes) throw new Error('El archivo es demasiado grande para importarlo.');
      await onContent(await file.text());
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo abrir el archivo.');
    }
  };

  return {
    open: () => inputRef.current?.click(),
    inputProps: {
      ref: inputRef,
      type: 'file' as const,
      accept: Capacitor.isNativePlatform() ? undefined : `${extension},${mimeType},application/json`,
      className: 'hidden',
      onChange: (event: ChangeEvent<HTMLInputElement>) => void handleChange(event),
    },
  };
}
