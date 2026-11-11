import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Copy, ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../hooks/useBackButton';
import { copyImageToSystemClipboard } from '../utils/imageClipboard';

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

export interface ImageZoomModalProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  src,
  alt = 'Imagen en detalle',
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Gestos táctiles
  const initialPinchDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);
  const lastTapRef = useRef<number>(0);

  // Copiar al portapapeles del teléfono: pulsación prolongada o botón "Copiar"
  const [copyStatus, setCopyStatus] = useState<{ id: number; text: string } | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const longPressTimerRef = useRef<number | undefined>(undefined);
  const longPressFiredRef = useRef(false);
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!copyStatus) return;
    const timer = window.setTimeout(() => setCopyStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => () => window.clearTimeout(longPressTimerRef.current), []);

  const copyImage = async () => {
    if (isCopying) return;
    setIsCopying(true);
    setCopyStatus({ id: Date.now(), text: 'Copiando imagen…' });
    const result = await copyImageToSystemClipboard(src);
    setIsCopying(false);
    setCopyStatus({
      id: Date.now(),
      text: result.ok
        ? 'Imagen copiada. Ya puedes pegarla en WhatsApp u otra app.'
        : `No se pudo copiar la imagen (${result.error ?? 'error desconocido'}).`,
    });
  };

  const cancelLongPress = () => {
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = undefined;
  };

  // Resetear posición y escala
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(8, Number((prev + 0.5).toFixed(2))));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(2)));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Doble clic o doble toque para alternar zoom rápido
  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2.5);
    }
  };

  // Zoom con rueda del ratón
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.35 : -0.35;
    setScale((prev) => {
      const next = Math.min(8, Math.max(1, Number((prev + delta).toFixed(2))));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Arrastre con Mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    hasMovedRef.current = false;
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    hasMovedRef.current = true;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Gestos táctiles en móvil (Pellizco, arrastre y toque simple/doble)
  const handleTouchStart = (e: React.TouchEvent) => {
    hasMovedRef.current = false;
    longPressFiredRef.current = false;
    cancelLongPress();
    if (e.touches.length === 1) {
      touchStartPointRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = undefined;
        longPressFiredRef.current = true;
        // En Android vibra el puente nativo al copiar; en la web, la Vibration API
        if (!Capacitor.isNativePlatform()) navigator.vibrate?.(50);
        void copyImage();
      }, LONG_PRESS_MS);
    }
    if (e.touches.length === 2) {
      // Iniciar pellizco con 2 dedos
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y,
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touchStartPointRef.current;
    const moved =
      e.touches.length !== 1 ||
      !start ||
      Math.hypot(e.touches[0].clientX - start.x, e.touches[0].clientY - start.y) > MOVE_TOLERANCE_PX;
    if (moved) cancelLongPress();
    // Un temblor del dedo no cuenta como arrastre (no debe anular el toque simple)
    if (!moved) return;
    hasMovedRef.current = true;
    if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      // Zoom por pellizco
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialPinchDistRef.current;
      const newScale = Math.min(8, Math.max(1, Number((initialScaleRef.current * factor).toFixed(2))));
      setScale(newScale);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Mover imagen ampliada
      setPosition({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    initialPinchDistRef.current = null;
    cancelLongPress();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    // Detectar toque simple vs doble toque cuando no hubo arrastre
    if (!hasMovedRef.current && e.changedTouches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Doble toque: alternar zoom
        handleDoubleClick();
        lastTapRef.current = 0;
      } else {
        // Toque simple: alternar visibilidad de botones
        lastTapRef.current = now;
        setTimeout(() => {
          if (Date.now() - lastTapRef.current >= 280 && lastTapRef.current !== 0) {
            setShowControls((prev) => !prev);
          }
        }, 280);
      }
    }
  };

  // Interceptar botón "Atrás" de Android / Navegador con la máxima prioridad de overlay
  useBackButton(() => {
    onClose();
    return true;
  }, BACK_PRIORITY.OVERLAY);

  // Atajos de teclado (Escape, +, -, 0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-' || e.key === '_') handleZoomOut();
      if (e.key === '0') handleReset();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden select-none animate-in fade-in duration-200"
      style={{ touchAction: 'none' }}
    >
      {/* Contenedor Interactivo 100% Edge-to-Edge (Ocupa absolutamente toda la pantalla) */}
      <div
        className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          if (longPressTimerRef.current !== undefined || longPressFiredRef.current) e.preventDefault();
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="w-full h-full object-contain select-none pointer-events-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      {copyStatus && (
        <div
          role="status"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] rounded-2xl border border-white/20 bg-black/80 px-4 py-2 text-center text-xs font-semibold text-white shadow-2xl backdrop-blur-md"
        >
          {copyStatus.text}
        </div>
      )}

      {/* Botón Flotante para Cerrar en la esquina superior derecha */}
      <div
        className={`absolute top-3 right-3 sm:top-5 sm:right-5 z-40 transition-opacity duration-200 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center text-white bg-black/60 hover:bg-black/90 active:scale-95 rounded-full backdrop-blur-md transition-all cursor-pointer border border-white/25 shadow-2xl"
          title="Cerrar visor"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Cápsula de Controles Flotante en la parte inferior */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-40 transition-all duration-200 ${
          showControls
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="inline-flex items-center gap-1 sm:gap-2 px-3 py-1.5 bg-black/75 border border-white/20 rounded-2xl backdrop-blur-md shadow-2xl text-white">
          {/* Copiar al portapapeles del teléfono */}
          <button
            type="button"
            onClick={() => void copyImage()}
            disabled={isCopying}
            aria-label="Copiar imagen"
            className="p-2 hover:bg-white/20 active:scale-90 disabled:opacity-40 rounded-xl transition-all cursor-pointer"
            title="Copiar imagen (o mantén pulsada la foto)"
          >
            <Copy className="w-4 h-4" />
          </button>
          <span className="h-5 w-px bg-white/20" aria-hidden="true" />

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="p-2 hover:bg-white/20 active:scale-90 disabled:opacity-30 rounded-xl transition-all cursor-pointer"
            title="Reducir zoom (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Porcentaje actual */}
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1 text-xs font-mono font-black text-cove-sky hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Restablecer (100%)"
          >
            {Math.round(scale * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 8}
            className="p-2 hover:bg-white/20 active:scale-90 disabled:opacity-30 rounded-xl transition-all cursor-pointer"
            title="Aumentar zoom (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/20 mx-0.5" />

          {/* Botón Reset */}
          <button
            type="button"
            onClick={handleReset}
            disabled={scale === 1 && position.x === 0 && position.y === 0}
            className="p-2 hover:bg-white/20 active:scale-90 disabled:opacity-30 rounded-xl transition-all cursor-pointer"
            title="Restablecer vista"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
