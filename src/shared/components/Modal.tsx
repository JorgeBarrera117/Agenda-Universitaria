import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../hooks/useBackButton';
import { MOTION_EXIT_MS } from '../hooks/useExitTransition';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /**
   * Tocar el fondo oscuro cierra el diálogo. Solo para avisos sin datos que perder (novedades,
   * información); en formularios queda desactivado para no perder lo escrito por un toque perdido.
   */
  dismissOnBackdrop?: boolean;
}

type RenderState = 'open' | 'closing' | 'closed';

const MAX_WIDTH_CLASS: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Diálogos abiertos, el último arriba: solo el de arriba atiende Escape y Tab. */
const openDialogs: symbol[] = [];
/** Bloqueo del scroll de la página compartido entre diálogos apilados. */
let scrollLocks = 0;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Diálogo M3 adaptable:
 * - Teléfono (< 640 px): hoja inferior a todo el ancho que sube desde abajo, con esquinas
 *   superiores redondeadas y respetando la barra de gestos.
 * - Tablet/PC: diálogo centrado que aparece escalando.
 * El título queda fijo arriba y el contenido desplaza por dentro (altura dinámica `dvh`, que
 * descuenta la barra del navegador y el teclado). Las acciones van en <ModalActions>, que se
 * mantiene pegado abajo. El foco entra al abrir, no se escapa con Tab y vuelve al botón que lo
 * abrió al cerrar. Sigue montado ~150 ms tras `isOpen = false` para animar la salida.
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'md', dismissOnBackdrop = false }) => {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const backdropPressRef = useRef(false);
  const [renderState, setRenderState] = useState<RenderState>(isOpen ? 'open' : 'closed');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Sincroniza la fase con la prop durante el render (sin efecto en cascada)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    setRenderState(isOpen ? 'open' : prefersReducedMotion() ? 'closed' : 'closing');
  }

  useEffect(() => {
    if (renderState !== 'closing') return;
    const timer = setTimeout(() => setRenderState('closed'), MOTION_EXIT_MS.dialog);
    return () => clearTimeout(timer);
  }, [renderState]);

  // Escape, trampa de foco y bloqueo del scroll de la página mientras está abierto
  useEffect(() => {
    if (!isOpen) return;
    const id = Symbol('dialog');
    openDialogs.push(id);
    const isTop = () => openDialogs[openDialogs.length - 1] === id;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTop()) return;
      // Un menú desplegable abierto dentro del diálogo atiende su propio Escape primero
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const node = containerRef.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === node || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !node.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    scrollLocks += 1;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const index = openDialogs.indexOf(id);
      if (index >= 0) openDialogs.splice(index, 1);
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Foco: entra al diálogo al abrir y vuelve al elemento que lo abrió al cerrar
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const node = containerRef.current;
      if (!node || node.contains(document.activeElement)) return;
      const preferred = node.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      (preferred ?? node).focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
    };
  }, [isOpen]);

  // Botón "Atrás" de Android / navegador mientras el diálogo está abierto
  useBackButton(() => {
    onClose();
    return true;
  }, BACK_PRIORITY.MODAL, isOpen);

  if (renderState === 'closed') return null;

  const isClosing = renderState === 'closing';

  const modalElement = (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs sm:items-center sm:p-4 ${
        isClosing ? 'm3-backdrop-exit' : 'm3-backdrop-enter'
      }`}
      // Solo cierra si el toque empezó y terminó en el fondo (no al soltar una selección de texto)
      onPointerDown={(e) => {
        backdropPressRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (dismissOnBackdrop && backdropPressRef.current && e.target === e.currentTarget) onClose();
        backdropPressRef.current = false;
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] pb-[env(safe-area-inset-bottom,0px)] text-[var(--color-md-on-surface)] shadow-[0_-4px_24px_rgba(0,0,0,0.18)] outline-none sm:max-h-[90dvh] sm:rounded-[28px] sm:border-b sm:pb-0 sm:shadow-[0_8px_24px_4px_rgba(0,0,0,0.18)] ${MAX_WIDTH_CLASS[maxWidth]} ${
          isClosing ? 'm3-modal-exit' : 'm3-modal-enter'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-md-outline-variant)] py-3.5 pl-6 pr-4 sm:py-4">
          <h3 id={titleId} className="min-w-0 text-lg font-bold tracking-tight sm:text-xl">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isClosing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] hover:text-[var(--color-md-on-primary-container)] active:scale-95"
            aria-label="Cerrar diálogo"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};

interface ModalActionsProps {
  children: React.ReactNode;
  /** 'end': botones a la derecha · 'between': uno a cada lado · 'stack': apilados en el teléfono. */
  layout?: 'end' | 'between' | 'stack';
  className?: string;
}

const ACTIONS_LAYOUT: Record<NonNullable<ModalActionsProps['layout']>, string> = {
  end: 'flex items-center justify-end gap-2',
  between: 'flex items-center justify-between gap-2',
  stack: 'flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end',
};

/**
 * Franja de acciones del diálogo: queda pegada abajo mientras el contenido se desplaza, así
 * "Cancelar" y "Guardar" siempre están a la vista. Debe ser el último elemento del contenido
 * (puede estar dentro de un <form>: los botones de envío siguen funcionando).
 */
export const ModalActions: React.FC<ModalActionsProps> = ({ children, layout = 'end', className = '' }) => (
  <div
    className={`sticky -bottom-5 z-10 -mx-5 -mb-5 mt-4 border-t border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] px-5 py-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:py-4 ${ACTIONS_LAYOUT[layout]} ${className}`}
  >
    {children}
  </div>
);
