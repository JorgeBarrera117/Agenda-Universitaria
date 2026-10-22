import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackButton, BACK_PRIORITY } from '../hooks/useBackButton';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Interceptar botón "Atrás" de Android / Navegador cuando el modal esté abierto
  useBackButton(() => {
    onClose();
    return true;
  }, BACK_PRIORITY.MODAL, isOpen);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  const modalElement = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className={`w-full ${maxWidthClass} bg-[#F1F4FA] dark:bg-[#272A2F] rounded-[28px] shadow-[0_8px_24px_4px_rgba(0,0,0,0.18)] border border-[#C2C7CE]/30 dark:border-white/5 overflow-hidden flex flex-col max-h-[90vh] text-[#191C20] dark:text-[#E2E2E6] animate-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#C2C7CE]/30 dark:border-white/5">
          <h3 className="text-lg sm:text-xl font-bold text-[#191C20] dark:text-[#E2E2E6] tracking-tight">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#E2E7EF] dark:bg-white/10 hover:bg-[#D0E4FF] dark:hover:bg-white/20 text-[#41474D] dark:text-[#C2C7CF] hover:text-[#001D32] dark:hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
            aria-label="Cerrar diálogo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }

  return modalElement;
};
