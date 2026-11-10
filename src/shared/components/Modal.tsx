import React, { useEffect, useId, useState } from 'react';
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
}

type RenderState = 'open' | 'closing' | 'closed';

const MAX_WIDTH_CLASS: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Diálogo M3. Sigue montado unos 150 ms tras `isOpen = false` para animar la salida
 * (fondo y contenedor) en lugar de desaparecer de golpe.
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'md' }) => {
  const titleId = useId();
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Botón "Atrás" de Android / navegador mientras el diálogo está abierto
  useBackButton(() => {
    onClose();
    return true;
  }, BACK_PRIORITY.MODAL, isOpen);

  if (renderState === 'closed') return null;

  const isClosing = renderState === 'closing';

  const modalElement = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-xs sm:p-4 ${
        isClosing ? 'm3-backdrop-exit' : 'm3-backdrop-enter'
      }`}
    >
      <div
        className={`flex max-h-[90vh] w-full ${MAX_WIDTH_CLASS[maxWidth]} flex-col overflow-hidden rounded-[28px] border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] text-[var(--color-md-on-surface)] shadow-[0_8px_24px_4px_rgba(0,0,0,0.18)] ${
          isClosing ? 'm3-dialog-exit' : 'm3-dialog-enter'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-md-outline-variant)] px-6 py-4">
          <h3 id={titleId} className="text-lg font-bold tracking-tight sm:text-xl">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isClosing}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] hover:text-[var(--color-md-on-primary-container)] active:scale-95"
            aria-label="Cerrar diálogo"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="custom-scrollbar overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};
