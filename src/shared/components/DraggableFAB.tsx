import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';

export interface DockPosition {
  side: 'left' | 'right';
  yRatio: number; // Ratio 0.0 to 1.0 respecto a window.innerHeight
}

const FAB_STORAGE_KEY = 'agenda_fab_dock_v1';
const BUTTON_SIZE = 56; // 56px (w-14 h-14)
const EDGE_OFFSET = 16; // 16px margen del borde (right-4 / left-4)
const SAFE_TOP = 72; // Debajo del header navbar

export type FABColorScheme =
  | 'schedule'
  | 'subjects'
  | 'professors'
  | 'notes'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'purple';

const FAB_THEMES: Record<
  FABColorScheme,
  {
    bg: string;
    ring: string;
    shadow: string;
    dragRing: string;
  }
> = {
  schedule: {
    bg: 'bg-gradient-to-br from-blue-600 via-blue-700 to-cove-navy',
    ring: 'ring-2 ring-sky-300/40',
    shadow: 'shadow-xl shadow-blue-950/50',
    dragRing: 'ring-4 ring-sky-400/70',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-600 via-blue-700 to-cove-navy',
    ring: 'ring-2 ring-sky-300/40',
    shadow: 'shadow-xl shadow-blue-950/50',
    dragRing: 'ring-4 ring-sky-400/70',
  },
  subjects: {
    bg: 'bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900',
    ring: 'ring-2 ring-teal-300/40',
    shadow: 'shadow-xl shadow-emerald-950/50',
    dragRing: 'ring-4 ring-teal-400/70',
  },
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900',
    ring: 'ring-2 ring-teal-300/40',
    shadow: 'shadow-xl shadow-emerald-950/50',
    dragRing: 'ring-4 ring-teal-400/70',
  },
  professors: {
    bg: 'bg-gradient-to-br from-amber-500 via-orange-600 to-slate-900',
    ring: 'ring-2 ring-amber-300/40',
    shadow: 'shadow-xl shadow-orange-950/50',
    dragRing: 'ring-4 ring-amber-400/70',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-500 via-orange-600 to-slate-900',
    ring: 'ring-2 ring-amber-300/40',
    shadow: 'shadow-xl shadow-orange-950/50',
    dragRing: 'ring-4 ring-amber-400/70',
  },
  notes: {
    bg: 'bg-gradient-to-br from-indigo-500 via-violet-700 to-slate-900',
    ring: 'ring-2 ring-violet-300/40',
    shadow: 'shadow-xl shadow-indigo-950/50',
    dragRing: 'ring-4 ring-violet-400/70',
  },
  purple: {
    bg: 'bg-gradient-to-br from-indigo-500 via-violet-700 to-slate-900',
    ring: 'ring-2 ring-violet-300/40',
    shadow: 'shadow-xl shadow-indigo-950/50',
    dragRing: 'ring-4 ring-violet-400/70',
  },
};

interface DraggableFABProps {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  colorScheme?: FABColorScheme;
  className?: string;
}

export const DraggableFAB: React.FC<DraggableFABProps> = ({
  onClick,
  label,
  icon,
  colorScheme = 'schedule',
  className = '',
}) => {
  const currentTheme = FAB_THEMES[colorScheme] || FAB_THEMES.schedule;
  // Dimensiones del viewport
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844,
  });

  // Cargar posición inicial guardada en localStorage o usar posición por defecto (inferior derecha)
  const [dock, setDock] = useState<DockPosition>(() => {
    try {
      const stored = localStorage.getItem(FAB_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          (parsed.side === 'left' || parsed.side === 'right') &&
          typeof parsed.yRatio === 'number'
        ) {
          return parsed;
        }
      }
    } catch {}
    // Por defecto: apegado al borde derecho, justo sobre la barra de navegación inferior (~80% de altura)
    return { side: 'right', yRatio: 0.78 };
  });

  // Estado de arrastre activo
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // Referencias para capturar coordenadas del puntero
  const pointerStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialBtnX: number;
    initialBtnY: number;
    hasDragged: boolean;
  } | null>(null);

  // Límite inferior seguro (sobre la barra de navegación móvil)
  const safeBottom = Math.max(SAFE_TOP + BUTTON_SIZE, viewport.height - 148);

  // Cálculo de posición docked en reposo
  const getDockedPosition = useCallback(
    (d: DockPosition) => {
      const x = d.side === 'left' ? EDGE_OFFSET : viewport.width - BUTTON_SIZE - EDGE_OFFSET;
      const targetY = d.yRatio * viewport.height;
      const y = Math.min(Math.max(targetY, SAFE_TOP), safeBottom);
      return { x, y };
    },
    [viewport.width, viewport.height, safeBottom]
  );

  // Escuchar redimensionamiento de pantalla
  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    const handleSync = (e: Event) => {
      const custom = e as CustomEvent<DockPosition>;
      if (custom.detail) {
        setDock(custom.detail);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('agenda_fab_dock_updated', handleSync);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('agenda_fab_dock_updated', handleSync);
    };
  }, []);

  // Coordenadas actuales para renderizar
  const dockedCoords = getDockedPosition(dock);
  const currentCoords = dragPos || dockedCoords;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Aceptar solo clic principal o touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    pointerStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialBtnX: currentCoords.x,
      initialBtnY: currentCoords.y,
      hasDragged: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current) return;

    const deltaX = e.clientX - pointerStartRef.current.pointerX;
    const deltaY = e.clientY - pointerStartRef.current.pointerY;
    const distance = Math.hypot(deltaX, deltaY);

    // Umbral de discriminación: si se mueve más de 6px se considera arrastre, no tap
    if (distance > 6) {
      pointerStartRef.current.hasDragged = true;
      if (!isDragging) setIsDragging(true);

      const targetX = pointerStartRef.current.initialBtnX + deltaX;
      const targetY = pointerStartRef.current.initialBtnY + deltaY;

      // Restricción vertical dentro de los márgenes seguros (arriba/abajo/en medio)
      const clampedY = Math.min(Math.max(targetY, SAFE_TOP), safeBottom);
      // Restricción horizontal dentro de la pantalla
      const clampedX = Math.min(
        Math.max(targetX, EDGE_OFFSET),
        viewport.width - BUTTON_SIZE - EDGE_OFFSET
      );

      setDragPos({ x: clampedX, y: clampedY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const hasDragged = pointerStartRef.current.hasDragged;
    pointerStartRef.current = null;

    if (!hasDragged) {
      // Tap limpio sin arrastre -> ejecutar acción
      setIsDragging(false);
      setDragPos(null);
      onClick();
      return;
    }

    // Si hubo arrastre, encajar inmediatamente contra el borde izquierdo o derecho más cercano
    if (dragPos) {
      const btnCenterX = dragPos.x + BUTTON_SIZE / 2;
      const screenMidX = viewport.width / 2;
      const newSide: 'left' | 'right' = btnCenterX < screenMidX ? 'left' : 'right';

      const clampedY = Math.min(Math.max(dragPos.y, SAFE_TOP), safeBottom);
      const newYRatio = clampedY / viewport.height;

      const newDock: DockPosition = {
        side: newSide,
        yRatio: Number(newYRatio.toFixed(3)),
      };

      setDock(newDock);
      setDragPos(null);
      setIsDragging(false);

      try {
        localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(newDock));
        window.dispatchEvent(
          new CustomEvent('agenda_fab_dock_updated', { detail: newDock })
        );
      } catch {}
    } else {
      setIsDragging(false);
      setDragPos(null);
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
    setIsDragging(false);
    setDragPos(null);
  };

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        aria-label={label}
        title={label}
        style={{
          transform: `translate3d(${Math.round(currentCoords.x)}px, ${Math.round(
            currentCoords.y
          )}px, 0)`,
        }}
        className={`fixed top-0 left-0 z-40 w-14 h-14 rounded-2xl flex items-center justify-center text-white ${currentTheme.bg} ${currentTheme.shadow} ${currentTheme.ring} touch-none select-none cursor-grab active:cursor-grabbing ${
          isDragging
            ? `transition-none scale-110 shadow-2xl ${currentTheme.dragRing} opacity-95`
            : 'transition-transform duration-300 ease-out active:scale-95'
        } ${className}`}
      >
        {icon || <Plus className="w-7 h-7 text-white stroke-[2.5]" />}
      </button>
    </div>
  );
};
