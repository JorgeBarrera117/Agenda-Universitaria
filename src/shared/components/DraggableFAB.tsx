import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { useScrollCollapse } from '../hooks/useScrollCollapse';

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
  | 'documents'
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
    bg: 'bg-[var(--color-md-primary)]',
    text: 'text-[var(--color-md-on-primary)]',
    shadow: 'shadow-[0_6px_16px_rgba(0,0,0,0.28),0_2px_4px_rgba(0,0,0,0.2)]',
    dragRing: 'ring-4 ring-[var(--color-md-primary-container)]',
  },
  documents: {
    bg: 'bg-[var(--color-md-primary)]',
    text: 'text-[var(--color-md-on-primary)]',
    shadow: 'shadow-[0_6px_16px_rgba(0,0,0,0.28),0_2px_4px_rgba(0,0,0,0.2)]',
    dragRing: 'ring-4 ring-[var(--color-md-primary-container)]',
  },
  blue: {
    bg: 'bg-[var(--color-md-primary)]',
    text: 'text-[var(--color-md-on-primary)]',
    shadow: 'shadow-[0_6px_16px_rgba(0,0,0,0.28),0_2px_4px_rgba(0,0,0,0.2)]',
    dragRing: 'ring-4 ring-[var(--color-md-primary-container)]',
  },
  subjects: {
    bg: 'bg-[var(--color-md-primary)]',
    text: 'text-[var(--color-md-on-primary)]',
    shadow: 'shadow-[0_6px_16px_rgba(0,0,0,0.28),0_2px_4px_rgba(0,0,0,0.2)]',
    dragRing: 'ring-4 ring-[var(--color-md-primary-container)]',
  },
  emerald: {
    bg: 'bg-[var(--color-md-primary)]',
    text: 'text-[var(--color-md-on-primary)]',
    shadow: 'shadow-[0_6px_16px_rgba(0,0,0,0.28),0_2px_4px_rgba(0,0,0,0.2)]',
    dragRing: 'ring-4 ring-[var(--color-md-primary-container)]',
  },
  professors: {
    bg: 'bg-[var(--color-md-primary)]',
    text: 'text-[var(--color-md-on-primary)]',
    shadow: 'shadow-[0_6px_16px_rgba(0,0,0,0.28),0_2px_4px_rgba(0,0,0,0.2)]',
    dragRing: 'ring-4 ring-[var(--color-md-primary-container)]',
  },
  amber: {
    bg: 'bg-[var(--color-md-primary)]',
    text: 'text-[var(--color-md-on-primary)]',
    shadow: 'shadow-[0_6px_16px_rgba(0,0,0,0.28),0_2px_4px_rgba(0,0,0,0.2)]',
    dragRing: 'ring-4 ring-[var(--color-md-primary-container)]',
  },
  notes: {
    bg: 'bg-[var(--color-md-primary)]',
    text: 'text-[var(--color-md-on-primary)]',
    shadow: 'shadow-[0_6px_16px_rgba(0,0,0,0.28),0_2px_4px_rgba(0,0,0,0.2)]',
    dragRing: 'ring-4 ring-[var(--color-md-primary-container)]',
  },
  purple: {
    bg: 'bg-[var(--color-md-primary)]',
    text: 'text-[var(--color-md-on-primary)]',
    shadow: 'shadow-[0_6px_16px_rgba(0,0,0,0.28),0_2px_4px_rgba(0,0,0,0.2)]',
    dragRing: 'ring-4 ring-[var(--color-md-primary-container)]',
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

  // Estado de arrastre activo (solo cambia al iniciar y terminar el arrastre para máximo rendimiento a 120FPS)
  const [isDragging, setIsDragging] = useState(false);
  const isScrolled = useScrollCollapse(48);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Límite inferior seguro (sobre la barra de navegación móvil cuando vw < 768px, o cerca del borde inferior en horizontal/PC)
  const getSafeBottom = useCallback((vh: number, vw = viewport.width) => {
    const bottomMargin = vw >= 768 ? BUTTON_SIZE + 24 : 144;
    return Math.max(SAFE_TOP + BUTTON_SIZE, vh - bottomMargin);
  }, [viewport.width]);

  // Cálculo de posición docked en reposo
  const getDockedPosition = useCallback(
    (d: DockPosition, vw = viewport.width, vh = viewport.height) => {
      const sBottom = getSafeBottom(vh, vw);
      const x = d.side === 'left' ? EDGE_OFFSET : Math.max(EDGE_OFFSET, vw - BUTTON_SIZE - EDGE_OFFSET);
      const targetY = d.yRatio * vh;
      const y = Math.min(Math.max(targetY, SAFE_TOP), sBottom);
      return { x, y };
    },
    [viewport.width, viewport.height, getSafeBottom]
  );

  const livePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Referencias para capturar coordenadas del puntero con seguimiento 1:1
  const pointerStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialBtnX: number;
    initialBtnY: number;
    hasDragged: boolean;
  } | null>(null);

  // Escuchar redimensionamiento de pantalla y sincronización entre pestañas
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

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('agenda_fab_dock_updated', handleSync);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('agenda_fab_dock_updated', handleSync);
    };
  }, []);

  // Coordenadas en reposo sincronizadas con el viewport actual
  const dockedCoords = getDockedPosition(dock);
  if (!isDragging) {
    livePosRef.current = dockedCoords;
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Aceptar solo clic principal o touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const startCoords = getDockedPosition(dock, vw, vh);
    livePosRef.current = startCoords;

    pointerStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialBtnX: startCoords.x,
      initialBtnY: startCoords.y,
      hasDragged: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current) return;

    const deltaX = e.clientX - pointerStartRef.current.pointerX;
    const deltaY = e.clientY - pointerStartRef.current.pointerY;
    const distance = Math.hypot(deltaX, deltaY);

    // Umbral de discriminación: si se mueve más de 4px se considera arrastre, no tap
    if (distance > 4 || pointerStartRef.current.hasDragged) {
      if (!pointerStartRef.current.hasDragged) {
        pointerStartRef.current.hasDragged = true;
        setIsDragging(true);
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sBottom = getSafeBottom(vh, vw);

      const targetX = pointerStartRef.current.initialBtnX + deltaX;
      const targetY = pointerStartRef.current.initialBtnY + deltaY;

      // Restricción vertical y horizontal dentro de la pantalla real
      const clampedY = Math.min(Math.max(targetY, SAFE_TOP), sBottom);
      const clampedX = Math.min(
        Math.max(targetX, EDGE_OFFSET),
        Math.max(EDGE_OFFSET, vw - BUTTON_SIZE - EDGE_OFFSET)
      );

      livePosRef.current = { x: clampedX, y: clampedY };

      // Actualización directa en el DOM (0ms latencia, 60/120 FPS reales siguiendo el dedo/mouse)
      if (btnRef.current) {
        btnRef.current.style.transition = 'none';
        btnRef.current.style.transform = `translate3d(${Math.round(clampedX)}px, ${Math.round(clampedY)}px, 0)`;
      }
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
      onClick();
      return;
    }

    // Si hubo arrastre, encajar suavemente contra el borde izquierdo o derecho más cercano
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sBottom = getSafeBottom(vh, vw);
    const finalPos = livePosRef.current;

    const btnCenterX = finalPos.x + BUTTON_SIZE / 2;
    const screenMidX = vw / 2;
    const newSide: 'left' | 'right' = btnCenterX < screenMidX ? 'left' : 'right';

    const clampedY = Math.min(Math.max(finalPos.y, SAFE_TOP), sBottom);
    const newYRatio = clampedY / vh;

    const newDock: DockPosition = {
      side: newSide,
      yRatio: Number(newYRatio.toFixed(3)),
    };

    const snapCoords = getDockedPosition(newDock, vw, vh);
    livePosRef.current = snapCoords;

    if (btnRef.current) {
      btnRef.current.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
      btnRef.current.style.transform = `translate3d(${Math.round(snapCoords.x)}px, ${Math.round(snapCoords.y)}px, 0)`;
    }

    setViewport({ width: vw, height: vh });
    setDock(newDock);
    setIsDragging(false);

    try {
      localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(newDock));
      window.dispatchEvent(
        new CustomEvent('agenda_fab_dock_updated', { detail: newDock })
      );
    } catch {}
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
    setIsDragging(false);
    if (btnRef.current) {
      const resetCoords = getDockedPosition(dock, window.innerWidth, window.innerHeight);
      btnRef.current.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
      btnRef.current.style.transform = `translate3d(${Math.round(resetCoords.x)}px, ${Math.round(resetCoords.y)}px, 0)`;
    }
  };

  const fabElement = (
    <div
      className={
        isScrolled || isDragging
          ? 'block'
          : 'block sm:pointer-events-none'
      }
    >
      <button
        ref={btnRef}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        aria-label={label}
        title={label}
        style={{
          transform: `translate3d(${Math.round(livePosRef.current.x)}px, ${Math.round(
            livePosRef.current.y
          )}px, 0)`,
          transition: isDragging
            ? 'none'
            : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease',
          touchAction: 'none',
        }}
        className={`fixed top-0 left-0 z-40 w-14 h-14 rounded-2xl flex items-center justify-center ${currentTheme.bg} ${currentTheme.text} ${currentTheme.shadow} border border-white/20 dark:border-white/10 touch-none select-none cursor-grab active:cursor-grabbing ${
          isDragging
            ? `shadow-2xl ${currentTheme.dragRing} opacity-95`
            : isScrolled
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-100 sm:opacity-0 sm:pointer-events-none'
        } ${className}`}
      >
        <span
          className={`flex items-center justify-center transition-transform duration-200 ${
            isDragging
              ? 'scale-110'
              : isScrolled
                ? 'scale-100 group-active:scale-90'
                : 'scale-100 sm:scale-50 group-active:scale-90'
          }`}
        >
          {icon || <Plus className="w-6 h-6 stroke-[2.4]" />}
        </span>
      </button>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(fabElement, document.body);
  }

  return fabElement;
};
