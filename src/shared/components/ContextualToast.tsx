import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, LogOut } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error' | 'exit';

export interface ContextualToastProps {
  message: string | null;
  variant?: ToastVariant;
  /** 'nav' deja espacio sobre la barra inferior en móvil; 'compact' se posiciona más cerca del borde inferior */
  bottomOffset?: 'nav' | 'compact';
  onClose?: () => void;
}

/**
 * Clasifica automáticamente el tipo de aviso contextual según su contenido semántico
 * cuando no se especifica explícitamente la variante.
 */
export function inferToastVariant(message: string): ToastVariant {
  const lower = message.toLowerCase();

  if (lower.includes('salir de la aplicación') || lower.includes('presiona de nuevo')) {
    return 'exit';
  }
  if (
    lower.includes('error') ||
    lower.includes('no se pudo') ||
    lower.includes('denegado') ||
    lower.includes('no otorgados') ||
    lower.includes('inválido')
  ) {
    return 'error';
  }
  if (
    lower.includes('debes ') ||
    lower.includes('desactivado') ||
    lower.includes('intenta con') ||
    lower.includes('atención')
  ) {
    return 'warning';
  }
  if (
    lower.includes('éxito') ||
    lower.includes('correctamente') ||
    lower.includes('copiado') ||
    lower.includes('guardado') ||
    lower.includes('guardada') ||
    lower.includes('restaurado') ||
    lower.includes('programados') ||
    lower.includes('activados') ||
    lower.includes('vinculado') ||
    lower.includes('actualizado') ||
    lower.includes('actualizada') ||
    lower.includes('actualizados')
  ) {
    return 'success';
  }
  return 'info';
}

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    border: string;
    iconBg: string;
    iconColor: string;
    IconComponent: React.FC<{ className?: string }>;
  }
> = {
  exit: {
    border: 'border-amber-400/35 dark:border-amber-400/30',
    iconBg: 'bg-amber-500/20 border border-amber-400/35',
    iconColor: 'text-amber-300',
    IconComponent: LogOut,
  },
  warning: {
    border: 'border-amber-400/35 dark:border-amber-400/30',
    iconBg: 'bg-amber-500/20 border border-amber-400/35',
    iconColor: 'text-amber-300',
    IconComponent: AlertTriangle,
  },
  error: {
    border: 'border-rose-400/40 dark:border-rose-400/35',
    iconBg: 'bg-rose-500/25 border border-rose-400/40',
    iconColor: 'text-rose-300',
    IconComponent: AlertTriangle,
  },
  success: {
    border: 'border-emerald-400/35 dark:border-emerald-400/30',
    iconBg: 'bg-emerald-500/20 border border-emerald-400/35',
    iconColor: 'text-emerald-300',
    IconComponent: CheckCircle2,
  },
  info: {
    border: 'border-sky-400/35 dark:border-sky-400/30',
    iconBg: 'bg-sky-500/20 border border-sky-400/35',
    iconColor: 'text-sky-300',
    IconComponent: Info,
  },
};

/**
 * Componente Canónico de Aviso Contextual Flotante (Snackbar / Toast M3 Translúcido).
 * Se renderiza mediante Portal en document.body para garantizar centrado horizontal absoluto
 * sin verse afectado por contenedores con transformaciones CSS.
 */
export const ContextualToast: React.FC<ContextualToastProps> = ({
  message,
  variant,
  bottomOffset = 'nav',
  onClose,
}) => {
  if (!message) return null;

  const resolvedVariant = variant ?? inferToastVariant(message);
  const style = VARIANT_STYLES[resolvedVariant];
  const Icon = style.IconComponent;

  const toastNode = (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 z-[100] flex justify-center px-4 pointer-events-none ${
        bottomOffset === 'compact'
          ? 'bottom-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1rem))]'
          : 'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-8'
      }`}
    >
      <div
        onClick={onClose}
        className={`pointer-events-auto max-w-[92vw] sm:max-w-md bg-[#141923]/78 dark:bg-[#161C26]/80 backdrop-blur-xl text-[#F8FAFC] px-4 py-2.5 sm:px-5 sm:py-3 rounded-full shadow-[0_10px_32px_rgba(0,0,0,0.35)] border ${style.border} flex items-center justify-center gap-2.5 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 cursor-pointer select-none`}
      >
        <span
          className={`w-6 h-6 rounded-full ${style.iconBg} flex items-center justify-center shrink-0`}
        >
          <Icon className={`w-3.5 h-3.5 ${style.iconColor} stroke-[2.4]`} />
        </span>
        <span className="text-xs sm:text-sm font-semibold tracking-tight leading-snug text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
          {message}
        </span>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(toastNode, document.body);
  }

  return toastNode;
};
