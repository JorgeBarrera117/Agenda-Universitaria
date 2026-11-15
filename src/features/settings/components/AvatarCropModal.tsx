import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ZoomIn, ZoomOut } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { SUPPORTED_IMAGE_FORMATS_LABEL, toBrowserReadableImage } from '../../../shared/utils/imageFormats';
import { cropImageRegionToDataUrl, decodeImage } from '../utils/avatarCrop';

interface AvatarCropModalProps {
  /** Foto elegida; null = cerrado. */
  file: File | null;
  onCancel: () => void;
  /** Foto recortada (256×256 JPEG en data URL). */
  onConfirm: (dataUrl: string) => void;
}

/** El marco ocupa el 80 % del visor: alrededor se ve el resto de la foto oscurecido. */
const FRAME_RATIO = 0.8;
const MAX_ZOOM = 4;
const KEY_STEP_PX = 12;

interface View {
  zoom: number;
  x: number;
  y: number;
}

const INITIAL_VIEW: View = { zoom: 1, x: 0, y: 0 };

/**
 * Recortador de la foto de perfil, al estilo de WhatsApp: la foto se ve completa y un marco con la
 * forma del avatar (cuadrado redondeado) marca lo que se guardará. Se mueve arrastrando, se acerca
 * pellizcando, con el control deslizante o con la rueda del mouse; con teclado, flechas y +/−.
 * La foto siempre cubre el marco (no quedan bordes vacíos).
 */
export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({ file, onCancel, onConfirm }) => {
  // Foto lista para mostrarse (las HEIC se convierten a JPEG antes)
  const [readable, setReadable] = useState<File | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevFile, setPrevFile] = useState<File | null>(file);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; midX: number; midY: number } | null>(null);

  // Foto nueva: vista inicial (ajuste de estado durante el render, sin efecto en cascada)
  if (file !== prevFile) {
    setPrevFile(file);
    setView(INITIAL_VIEW);
    setReadable(null);
    setNatural(null);
    setError(null);
  }

  // URL para mostrar la foto (se libera al cambiarla o cerrar)
  const imageUrl = useMemo(() => (readable ? URL.createObjectURL(readable) : null), [readable]);
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl]
  );

  // Convierte la foto si hace falta y mide su tamaño real (con la orientación de la cámara aplicada)
  useEffect(() => {
    if (!file) return;
    let active = true;
    toBrowserReadableImage(file)
      .then(async (converted) => {
        const bitmap = await decodeImage(converted);
        if (active) {
          setReadable(converted);
          setNatural({ w: bitmap.width, h: bitmap.height });
        }
        bitmap.close();
      })
      .catch(() => {
        if (active) setError(`No se pudo abrir esa foto. Prueba con otra (${SUPPORTED_IMAGE_FORMATS_LABEL}).`);
      });
    return () => {
      active = false;
    };
  }, [file]);

  // Tamaño del visor (se adapta al ancho del diálogo en teléfono y PC)
  useEffect(() => {
    if (!viewport) return;
    const update = () => setViewportSize(viewport.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewport]);

  const frame = viewportSize * FRAME_RATIO;
  const baseScale = natural && frame > 0 ? Math.max(frame / natural.w, frame / natural.h) : 1;

  /** Limita el zoom y el desplazamiento para que la foto siempre cubra el marco. */
  const clampView = (next: View): View => {
    if (!natural || frame <= 0) return next;
    const zoom = Math.min(MAX_ZOOM, Math.max(1, next.zoom));
    const scale = baseScale * zoom;
    const maxX = Math.max(0, (natural.w * scale - frame) / 2);
    const maxY = Math.max(0, (natural.h * scale - frame) / 2);
    return {
      zoom,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  const updateView = (change: (current: View) => View) => setView((current) => clampView(change(current)));

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchRef.current = null;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      // Un dedo o el mouse: mover la foto
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      updateView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
      return;
    }

    // Dos dedos: pellizcar para acercar/alejar (y mover con el punto medio)
    const [a, b] = Array.from(pointers.values());
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const pinch = pinchRef.current;
    if (pinch && pinch.distance > 0) {
      const ratio = distance / pinch.distance;
      updateView((current) => ({
        zoom: current.zoom * ratio,
        x: current.x * ratio + (midX - pinch.midX),
        y: current.y * ratio + (midY - pinch.midY),
      }));
    }
    pinchRef.current = { distance, midX, midY };
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
  };

  const setZoom = (zoom: number) =>
    updateView((current) => {
      // Al cambiar el zoom, el centro del marco sigue mostrando la misma parte de la foto
      const ratio = Math.min(MAX_ZOOM, Math.max(1, zoom)) / current.zoom;
      return { zoom, x: current.x * ratio, y: current.y * ratio };
    });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP_PX, 0],
      ArrowRight: [-KEY_STEP_PX, 0],
      ArrowUp: [0, KEY_STEP_PX],
      ArrowDown: [0, -KEY_STEP_PX],
    };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      updateView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom(view.zoom * 1.15);
    } else if (event.key === '-') {
      event.preventDefault();
      setZoom(view.zoom / 1.15);
    }
  };

  const handleConfirm = async () => {
    if (!readable || !natural || frame <= 0) return;
    setIsSaving(true);
    setError(null);
    try {
      // Esquina superior izquierda del marco, medida desde la esquina de la foto, en píxeles reales
      const scale = baseScale * view.zoom;
      const side = frame / scale;
      const x = (natural.w * scale) / 2 - view.x - frame / 2;
      const y = (natural.h * scale) / 2 - view.y - frame / 2;
      onConfirm(await cropImageRegionToDataUrl(readable, { x: x / scale, y: y / scale, side }));
    } catch {
      setError('No se pudo recortar la foto. Prueba con otra imagen.');
    } finally {
      setIsSaving(false);
    }
  };

  const displayWidth = natural ? natural.w * baseScale * view.zoom : 0;
  const displayHeight = natural ? natural.h * baseScale * view.zoom : 0;

  return (
    <Modal isOpen={file !== null} onClose={onCancel} title="Ajusta tu foto" maxWidth="sm">
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-md-on-surface-variant)]">
          Arrastra para mover la foto y pellizca o usa el control para acercarla. Se guardará lo que queda dentro del marco.
        </p>

        <div
          ref={setViewport}
          role="group"
          tabIndex={0}
          aria-label="Recorte de la foto. Flechas para mover, más y menos para acercar o alejar."
          data-no-swipe="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={(event) => setZoom(view.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08))}
          onKeyDown={handleKeyDown}
          className="relative mx-auto aspect-square w-full max-w-[340px] cursor-grab touch-none select-none overflow-hidden rounded-3xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-md-primary)] focus-visible:ring-offset-2 active:cursor-grabbing"
        >
          {imageUrl && natural && (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: displayWidth,
                height: displayHeight,
                transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
              }}
            />
          )}
          {/* Marco con la forma del avatar; fuera de él la foto se ve oscurecida */}
          {natural && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[25%] ring-2 ring-white/90"
              style={{ width: frame, height: frame, boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)' }}
            >
              {/* Guías de tercios para centrar la cara */}
              <span className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
              <span className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
              <span className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
            </div>
          )}
          {!natural && !error && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white/80">Preparando foto…</span>
          )}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={() => setZoom(view.zoom / 1.25)}
            disabled={!natural || view.zoom <= 1}
            aria-label="Alejar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-surface-container-high)] disabled:opacity-40"
          >
            <ZoomOut className="h-5 w-5" aria-hidden="true" />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            disabled={!natural}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Zoom de la foto"
            data-no-swipe="true"
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-md-primary)] [&::-webkit-slider-thumb]:shadow-md"
            style={{
              background: `linear-gradient(to right, var(--color-md-primary) ${((view.zoom - 1) / (MAX_ZOOM - 1)) * 100}%, var(--color-md-outline-variant) ${((view.zoom - 1) / (MAX_ZOOM - 1)) * 100}%)`,
            }}
          />
          <button
            type="button"
            onClick={() => setZoom(view.zoom * 1.25)}
            disabled={!natural || view.zoom >= MAX_ZOOM}
            aria-label="Acercar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-surface-container-high)] disabled:opacity-40"
          >
            <ZoomIn className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <p className="text-xs font-semibold text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <ModalActions>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Check className="h-4 w-4" aria-hidden="true" />}
            isLoading={isSaving}
            disabled={!natural}
            onClick={() => void handleConfirm()}
          >
            Usar foto
          </Button>
        </ModalActions>
      </div>
    </Modal>
  );
};
