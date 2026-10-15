import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X, Maximize2 } from 'lucide-react';

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
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Pinch-to-zoom en pantallas táctiles
  const initialPinchDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);

  // Resetear posición si la escala vuelve a 1
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(5, Number((prev + 0.5).toFixed(2))));
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
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setScale((prev) => {
      const next = Math.min(5, Math.max(1, Number((prev + delta).toFixed(2))));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Arrastre con Mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Gestos táctiles (Pellizco y Arrastre en móvil)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Iniciar pellizco con dos dedos
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      // Iniciar arrastre con un dedo
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      // Zoom por pellizco
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialPinchDistRef.current;
      const newScale = Math.min(5, Math.max(1, Number((initialScaleRef.current * factor).toFixed(2))));
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

  const handleTouchEnd = () => {
    setIsDragging(false);
    initialPinchDistRef.current = null;
  };

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
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 select-none animate-in fade-in duration-200"
      style={{ touchAction: 'none' }}
    >
      {/* Barra Superior del Visor */}
      <header className="flex items-center justify-between z-20 gap-3">
        <div className="flex items-center gap-2 min-w-0 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
          <Maximize2 className="w-4 h-4 text-cove-sky shrink-0" />
          <span className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-md">
            {alt}
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition-all cursor-pointer border border-white/15 shadow-md"
          title="Cerrar visor (Escape)"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Contenedor Interactivo de la Imagen */}
      <main
        className="flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing relative"
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
          className="max-w-full max-h-full object-contain pointer-events-auto rounded-lg shadow-2xl select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
        />
      </main>

      {/* Barra Inferior Flotante de Controles de Zoom */}
      <footer className="flex flex-col items-center gap-2 z-20 pb-1">
        {/* Cápsula de Controles Táctiles y Ergonómicos */}
        <div className="inline-flex items-center gap-1 sm:gap-2 px-3 py-1.5 bg-slate-900/90 border border-white/20 rounded-2xl backdrop-blur-md shadow-2xl text-white">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 1}
            className="p-2 hover:bg-white/15 active:scale-90 disabled:opacity-30 rounded-xl transition-all cursor-pointer"
            title="Reducir zoom (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Porcentaje actual (al tocarlo restablece a 100%) */}
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1 text-xs font-mono font-black text-cove-sky hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Restablecer tamaño original (0)"
          >
            {Math.round(scale * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 5}
            className="p-2 hover:bg-white/15 active:scale-90 disabled:opacity-30 rounded-xl transition-all cursor-pointer"
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
            className="p-2 hover:bg-white/15 active:scale-90 disabled:opacity-30 rounded-xl transition-all cursor-pointer"
            title="Restablecer vista"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Sugerencia de Interacción */}
        <p className="text-[11px] text-white/50 text-center font-medium">
          Doble toque para zoom rápido • Pellizca o rueda para ampliar • Arrastra para mover
        </p>
      </footer>
    </div>
  );
};
