import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';

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

  // Control del historial de navegación para el botón "Atrás" de Android / Navegador
  const closedViaPopstateRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Generar un identificador único para la instancia de este modal
    const modalId = `image-zoom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    closedViaPopstateRef.current = false;

    // Registrar estado en el historial para interceptar el botón Atrás de Android
    window.history.pushState({ isModalOpen: 'image-zoom', modalId }, '');

    const handlePopState = (e: PopStateEvent) => {
      // Si la entrada actual en el historial ya no tiene el ID de este modal,
      // significa que el usuario presionó el botón Atrás de Android
      if (e.state?.modalId !== modalId) {
        closedViaPopstateRef.current = true;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Si se desmontó por interacción directa (ej. botón 'X' o Escape) y NO por popstate,
      // revertimos la entrada agregada con history.back() para mantener el stack limpio.
      if (!closedViaPopstateRef.current && window.history.state?.modalId === modalId) {
        window.history.back();
      }
    };
  }, []);

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
