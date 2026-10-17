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
    text: string;
    shadow: string;
    dragRing: string;
  }
> = {
  schedule: {
    bg: 'bg-[#00639B] dark:bg-[#004B76]',
    text: 'text-white',
    shadow: 'shadow-[0_4px_12px_rgba(0,99,155,0.35),0_1px_3px_0_rgba(0,0,0,0.3)]',
    dragRing: 'ring-4 ring-[#00639B]/50',
  },
  blue: {
    bg: 'bg-[#00639B] dark:bg-[#004B76]',
    text: 'text-white',
    shadow: 'shadow-[0_4px_12px_rgba(0,99,155,0.35),0_1px_3px_0_rgba(0,0,0,0.3)]',
    dragRing: 'ring-4 ring-[#00639B]/50',
  },
  subjects: {
    bg: 'bg-emerald-600 dark:bg-[#0A532C]',
    text: 'text-white',
    shadow: 'shadow-[0_4px_12px_rgba(5,150,105,0.35),0_1px_3px_0_rgba(0,0,0,0.3)]',
    dragRing: 'ring-4 ring-emerald-500/50',
  },
  emerald: {
    bg: 'bg-emerald-600 dark:bg-[#0A532C]',
    text: 'text-white',
    shadow: 'shadow-[0_4px_12px_rgba(5,150,105,0.35),0_1px_3px_0_rgba(0,0,0,0.3)]',
    dragRing: 'ring-4 ring-emerald-500/50',
  },
  professors: {
    bg: 'bg-amber-600 dark:bg-[#683D00]',
    text: 'text-white',
    shadow: 'shadow-[0_4px_12px_rgba(217,119,6,0.35),0_1px_3px_0_rgba(0,0,0,0.3)]',
    dragRing: 'ring-4 ring-amber-500/50',
  },
  amber: {
    bg: 'bg-amber-600 dark:bg-[#683D00]',
    text: 'text-white',
    shadow: 'shadow-[0_4px_12px_rgba(217,119,6,0.35),0_1px_3px_0_rgba(0,0,0,0.3)]',
    dragRing: 'ring-4 ring-amber-500/50',
  },
  notes: {
    bg: 'bg-violet-600 dark:bg-[#4A4458]',
    text: 'text-white',
    shadow: 'shadow-[0_4px_12px_rgba(124,58,237,0.35),0_1px_3px_0_rgba(0,0,0,0.3)]',
    dragRing: 'ring-4 ring-violet-500/50',
  },
  purple: {
    bg: 'bg-violet-600 dark:bg-[#4A4458]',
    text: 'text-white',
    shadow: 'shadow-[0_4px_12px_rgba(124,58,237,0.35),0_1px_3px_0_rgba(0,0,0,0.3)]',
    dragRing: 'ring-4 ring-violet-500/50',
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
        className={`fixed top-0 left-0 z-40 w-14 h-14 rounded-2xl flex items-center justify-center ${currentTheme.bg} ${currentTheme.text} ${currentTheme.shadow} border border-white/20 dark:border-white/10 touch-none select-none cursor-grab active:cursor-grabbing ${
          isDragging
            ? `transition-none scale-110 shadow-2xl ${currentTheme.dragRing} opacity-95`
            : 'transition-transform duration-300 ease-out active:scale-95'
        } ${className}`}
      >
        {icon || <Plus className="w-6 h-6 stroke-[2.4]" />}
      </button>
    </div>
  );
};
