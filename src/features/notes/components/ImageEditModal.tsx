import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Crop, Loader2, Pencil, RotateCw, Type, Undo2, X } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import { blobToDataUrl } from '../../../shared/utils/dataUrl';
import {
  canvasToImageBlob,
  cloneCanvas,
  cropCanvas,
  drawTextOnCanvas,
  loadImageToCanvas,
  rotateCanvasClockwise,
  type CropRect,
} from '../utils/imageEditing';

interface ImageEditModalProps {
  /** Foto a editar (data URL del apunte). */
  src: string;
  onCancel: () => void;
  /** Foto editada como data URL (WebP o JPEG). */
  onSave: (dataUrl: string) => void;
}

type Tool = 'none' | 'crop' | 'draw' | 'text';

const COLORS = [
  { value: '#FFFFFF', label: 'Blanco' },
  { value: '#000000', label: 'Negro' },
  { value: '#EF4444', label: 'Rojo' },
  { value: '#FACC15', label: 'Amarillo' },
  { value: '#22C55E', label: 'Verde' },
  { value: '#3B82F6', label: 'Azul' },
  { value: '#EC4899', label: 'Rosa' },
] as const;

/** Grosor del trazo en píxeles de pantalla: se ve igual en fotos grandes y pequeñas. */
const BRUSH_SCREEN_PX = 5;
const MAX_HISTORY = 12;
/** Lado mínimo del recorte, en píxeles de pantalla (para que los tiradores no se crucen). */
const MIN_CROP_SCREEN_PX = 48;
/** Relleno alrededor de la foto (px): los tiradores del recorte sobresalen 18 px. */
const STAGE_PADDING_X = 24;
const STAGE_PADDING_Y = 20;

type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

/**
 * Editor de fotos del apunte, al estilo de WhatsApp: recortar, girar, dibujar a mano alzada y
 * escribir texto encima, con «Deshacer» para cada paso. Trabaja sobre <canvas> a la resolución
 * real de la foto; la pantalla solo muestra una versión escalada para que quepa.
 */
export const ImageEditModal: React.FC<ImageEditModalProps> = ({ src, onCancel, onSave }) => {
  const [working, setWorking] = useState<HTMLCanvasElement | null>(null);
  const [history, setHistory] = useState<HTMLCanvasElement[]>([]);
  const [tool, setTool] = useState<Tool>('none');
  const [color, setColor] = useState<string>(COLORS[2].value);
  const [textDraft, setTextDraft] = useState('');
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const displayRef = useRef<HTMLCanvasElement | null>(null);
  const strokeRef = useRef<{ pointerId: number; last: { x: number; y: number } } | null>(null);
  const cropDragRef = useRef<{ pointerId: number; handle: CropHandle; startX: number; startY: number; start: CropRect } | null>(null);

  useEffect(() => {
    let active = true;
    loadImageToCanvas(src)
      .then((canvas) => {
        if (active) setWorking(canvas);
      })
      .catch(() => {
        if (active) setError('No se pudo abrir la foto para editarla.');
      });
    return () => {
      active = false;
    };
  }, [src]);

  // Espacio disponible para la foto (cambia al girar el teléfono o abrir paneles)
  useEffect(() => {
    if (!stage) return;
    // Sin el relleno del contenedor: deja sitio a los tiradores del recorte en los bordes
    const update = () =>
      setStageSize({ width: stage.clientWidth - STAGE_PADDING_X * 2, height: stage.clientHeight - STAGE_PADDING_Y * 2 });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  // Lienzo visible: callback ref que cambia con cada versión de la foto, así React lo vuelve a
  // llamar y el lienzo copia el de trabajo (también cuando aparece por primera vez)
  const attachDisplay = useCallback(
    (display: HTMLCanvasElement | null) => {
      displayRef.current = display;
      if (!display || !working) return;
      display.width = working.width;
      display.height = working.height;
      display.getContext('2d')?.drawImage(working, 0, 0);
    },
    [working]
  );

  const scale =
    working && stageSize.width > 0 && stageSize.height > 0
      ? Math.min(stageSize.width / working.width, stageSize.height / working.height, 1)
      : 0;

  const hasChanges = history.length > 0;

  /** Aplica una operación guardando el estado anterior para «Deshacer». */
  const commit = useCallback(
    (next: HTMLCanvasElement) => {
      if (!working) return;
      setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), working]);
      setWorking(next);
    },
    [working]
  );

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((prev) => prev.slice(0, -1));
    setWorking(previous);
    setCrop(null);
    if (tool === 'crop') setTool('none');
  };

  const requestClose = () => {
    if (tool !== 'none') {
      setTool('none');
      setCrop(null);
    } else if (hasChanges && !confirmDiscard) {
      setConfirmDiscard(true);
    } else {
      onCancel();
    }
  };

  useBackButton(
    () => {
      requestClose();
      return true;
    },
    BACK_PRIORITY.MODAL,
    true
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const selectTool = (next: Tool) => {
    setConfirmDiscard(false);
    if (next === tool) {
      setTool('none');
      setCrop(null);
      return;
    }
    setTool(next);
    setCrop(next === 'crop' && working ? { x: 0, y: 0, width: working.width, height: working.height } : null);
  };

  /** Punto del evento en píxeles reales de la foto. */
  const toImagePoint = (event: React.PointerEvent): { x: number; y: number } | null => {
    const display = displayRef.current;
    if (!display || !working) return null;
    const rect = display.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * working.width,
      y: ((event.clientY - rect.top) / rect.height) * working.height,
    };
  };

  // Dibujo a mano alzada: el trazo se pinta en vivo en el lienzo visible y se fija al soltar
  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toImagePoint(event);
    if (!point || !working) return;
    if (tool === 'text') {
      const text = textDraft.trim();
      if (!text) return;
      const fontPx = Math.max(18, Math.round(Math.min(working.width, working.height) * 0.09));
      commit(drawTextOnCanvas(working, text, point, color, fontPx));
      setTextDraft('');
      return;
    }
    if (tool !== 'draw' || scale <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    strokeRef.current = { pointerId: event.pointerId, last: point };
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    // Un toque sin arrastrar deja un punto
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, BRUSH_SCREEN_PX / scale / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId || scale <= 0) return;
    const point = toImagePoint(event);
    const ctx = event.currentTarget.getContext('2d');
    if (!point || !ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = BRUSH_SCREEN_PX / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.last.x, stroke.last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    stroke.last = point;
  };

  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return;
    strokeRef.current = null;
    commit(cloneCanvas(event.currentTarget));
  };

  // Recorte: arrastrar el marco para moverlo o una esquina para cambiar su tamaño
  const handleCropPointerDown = (handle: CropHandle) => (event: React.PointerEvent<HTMLElement>) => {
    if (!crop) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragRef.current = { pointerId: event.pointerId, handle, startX: event.clientX, startY: event.clientY, start: crop };
  };

  const handleCropPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const dragState = cropDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !working || scale <= 0) return;
    const dx = (event.clientX - dragState.startX) / scale;
    const dy = (event.clientY - dragState.startY) / scale;
    const min = MIN_CROP_SCREEN_PX / scale;
    const { start } = dragState;
    let { x, y, width, height } = start;
    const right = start.x + start.width;
    const bottom = start.y + start.height;

    if (dragState.handle === 'move') {
      x = Math.min(Math.max(0, start.x + dx), working.width - start.width);
      y = Math.min(Math.max(0, start.y + dy), working.height - start.height);
    } else {
      if (dragState.handle === 'nw' || dragState.handle === 'sw') {
        x = Math.min(Math.max(0, start.x + dx), right - min);
        width = right - x;
      } else {
        width = Math.min(Math.max(min, start.width + dx), working.width - start.x);
      }
      if (dragState.handle === 'nw' || dragState.handle === 'ne') {
        y = Math.min(Math.max(0, start.y + dy), bottom - min);
        height = bottom - y;
      } else {
        height = Math.min(Math.max(min, start.height + dy), working.height - start.y);
      }
    }
    setCrop({ x, y, width, height });
  };

  const handleCropPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (cropDragRef.current?.pointerId === event.pointerId) cropDragRef.current = null;
  };

  const applyCrop = () => {
    if (!working || !crop) return;
    const isWhole = crop.x <= 0.5 && crop.y <= 0.5 && crop.width >= working.width - 1 && crop.height >= working.height - 1;
    if (!isWhole) commit(cropCanvas(working, crop));
    setCrop(null);
    setTool('none');
  };

  const handleRotate = () => {
    if (!working) return;
    setConfirmDiscard(false);
    setCrop(null);
    if (tool === 'crop') setTool('none');
    commit(rotateCanvasClockwise(working));
  };

  const handleSave = async () => {
    if (!working) return;
    if (!hasChanges) {
      onCancel();
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      onSave(await blobToDataUrl(await canvasToImageBlob(working)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la foto editada.');
      setIsSaving(false);
    }
  };

  const toolButton = (id: Tool, label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <button
      type="button"
      onClick={() => selectTool(id)}
      disabled={!working}
      aria-label={label}
      aria-pressed={tool === id}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
        tool === id ? 'bg-white text-black' : 'text-white hover:bg-white/15'
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );

  const colorPicker = (
    <div role="radiogroup" aria-label="Color" className="flex items-center justify-center gap-2.5">
      {COLORS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={color === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => setColor(option.value)}
          className={`h-8 w-8 rounded-full border-2 transition-transform active:scale-90 ${
            color === option.value ? 'scale-110 border-white ring-2 ring-white/50' : 'border-white/40'
          }`}
          style={{ backgroundColor: option.value }}
        />
      ))}
    </div>
  );

  const displayWidth = working ? working.width * scale : 0;
  const displayHeight = working ? working.height * scale : 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar foto"
      className="fixed inset-0 z-[70] flex flex-col bg-black text-white"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      data-no-swipe="true"
    >
      {/* Barra superior: cerrar · deshacer · herramientas */}
      <div className="flex shrink-0 items-center gap-1 px-2 py-2">
        <button
          type="button"
          onClick={requestClose}
          aria-label={tool === 'none' ? 'Cerrar sin guardar' : 'Salir de la herramienta'}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/15"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={!hasChanges}
          aria-label="Deshacer"
          title="Deshacer"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-30"
        >
          <Undo2 className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="ml-auto flex items-center gap-1" role="toolbar" aria-label="Herramientas">
          {toolButton('crop', 'Recortar', Crop)}
          <button
            type="button"
            onClick={handleRotate}
            disabled={!working}
            aria-label="Girar"
            title="Girar 90°"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-40"
          >
            <RotateCw className="h-5 w-5" aria-hidden="true" />
          </button>
          {toolButton('text', 'Texto', Type)}
          {toolButton('draw', 'Dibujar', Pencil)}
        </div>
      </div>

      {confirmDiscard && (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm" role="alert">
          <span className="mr-auto">¿Descartar los cambios de la foto?</span>
          <button type="button" onClick={() => setConfirmDiscard(false)} className="rounded-full px-3 py-1.5 font-semibold hover:bg-white/15">
            Seguir editando
          </button>
          <button type="button" onClick={onCancel} className="rounded-full bg-white px-3 py-1.5 font-semibold text-black">
            Descartar
          </button>
        </div>
      )}

      {/* Foto */}
      <div
        ref={setStage}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        style={{ padding: `${STAGE_PADDING_Y}px ${STAGE_PADDING_X}px` }}
      >
        {!working && !error && <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-label="Abriendo foto" />}
        {error && <p className="px-6 text-center text-sm font-semibold">{error}</p>}
        {working && scale > 0 && (
          <div className="relative" style={{ width: displayWidth, height: displayHeight }}>
            <canvas
              ref={attachDisplay}
              aria-label="Foto"
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              className={`block h-full w-full touch-none select-none ${tool === 'draw' || tool === 'text' ? 'cursor-crosshair' : ''}`}
            />
            {tool === 'crop' && crop && (
              <div
                className="absolute cursor-move touch-none border-2 border-white"
                style={{
                  left: crop.x * scale,
                  top: crop.y * scale,
                  width: crop.width * scale,
                  height: crop.height * scale,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                }}
                onPointerDown={handleCropPointerDown('move')}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
                aria-label="Zona del recorte: arrastra el marco o sus esquinas"
              >
                {/* Guías de tercios */}
                <span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/40" aria-hidden="true" />
                <span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/40" aria-hidden="true" />
                <span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/40" aria-hidden="true" />
                <span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/40" aria-hidden="true" />
                {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                  <span
                    key={corner}
                    onPointerDown={handleCropPointerDown(corner)}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
                    onPointerCancel={handleCropPointerUp}
                    aria-hidden="true"
                    className={`absolute flex h-9 w-9 touch-none items-center justify-center ${
                      corner === 'nw'
                        ? '-left-[18px] -top-[18px] cursor-nwse-resize'
                        : corner === 'ne'
                          ? '-right-[18px] -top-[18px] cursor-nesw-resize'
                          : corner === 'sw'
                            ? '-bottom-[18px] -left-[18px] cursor-nesw-resize'
                            : '-bottom-[18px] -right-[18px] cursor-nwse-resize'
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full border-2 border-black/30 bg-white shadow" />
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel inferior según la herramienta */}
      <div className="shrink-0 space-y-3 px-4 pb-3 pt-3">
        {tool === 'draw' && (
          <>
            <p className="text-center text-xs text-white/70">Dibuja con el dedo sobre la foto.</p>
            {colorPicker}
          </>
        )}
        {tool === 'text' && (
          <>
            <label className="block">
              <span className="sr-only">Texto para poner en la foto</span>
              <input
                value={textDraft}
                onChange={(event) => setTextDraft(event.target.value)}
                maxLength={80}
                placeholder="Escribe y toca la foto donde va"
                autoFocus
                className="w-full rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white focus:outline-none"
              />
            </label>
            {colorPicker}
          </>
        )}
        {tool === 'crop' && (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => working && setCrop({ x: 0, y: 0, width: working.width, height: working.height })}
              className="rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-white/15"
            >
              Restablecer
            </button>
            <button type="button" onClick={applyCrop} className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">
              <Check className="h-4 w-4" aria-hidden="true" />
              Recortar
            </button>
          </div>
        )}
        {tool !== 'crop' && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!working || isSaving}
              aria-label="Listo: guardar la foto editada"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <Check className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
