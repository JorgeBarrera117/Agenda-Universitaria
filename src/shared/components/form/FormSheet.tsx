import React, { useCallback, useEffect, useImperativeHandle } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { ContextualToast } from '../ContextualToast';
import { useBackButton, BACK_PRIORITY } from '../../hooks/useBackButton';
import { useExitTransition, MOTION_EXIT_MS } from '../../hooks/useExitTransition';

export interface FormSheetHandle {
  /** Sale con la animación de cierre (p. ej. tras confirmar "Salir sin guardar"). */
  close: () => void;
}

interface FormSheetProps {
  title: string;
  subtitle?: string;
  /** Sale del formulario (flecha, Escape o botón físico de Android), tras la animación de cierre. */
  onBack: () => void;
  /** Guarda opcional: devuelve false para quedarse (p. ej. para pedir confirmación antes de salir). */
  onRequestBack?: () => boolean;
  sheetRef?: React.Ref<FormSheetHandle>;
  backLabel: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  error?: string | null;
  onDismissError?: () => void;
  backPriority?: number;
  children: React.ReactNode;
}

/**
 * Hoja de formulario M3 compartida por los formularios de creación/edición:
 * Top App Bar canónica (atrás · título · acción primaria) y una sola superficie continua
 * con secciones separadas por divisores, sin tarjetas anidadas.
 */
export const FormSheet: React.FC<FormSheetProps> = ({
  title,
  subtitle,
  onBack,
  onRequestBack,
  sheetRef,
  backLabel,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  submitDisabled = false,
  error,
  onDismissError,
  backPriority = BACK_PRIORITY.MODAL,
  children,
}) => {
  const { isClosing, runExit } = useExitTransition(MOTION_EXIT_MS.sheet);

  const exit = useCallback(() => runExit(onBack), [runExit, onBack]);

  const requestBack = useCallback(() => {
    if (onRequestBack && !onRequestBack()) return;
    exit();
  }, [onRequestBack, exit]);

  useImperativeHandle(sheetRef, () => ({ close: exit }), [exit]);

  useBackButton(() => {
    requestBack();
    return true;
  }, backPriority, true);

  // Escape vuelve atrás, salvo que lo esté usando un diálogo o un menú abierto encima
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"], [role="listbox"]')) return;
      requestBack();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestBack]);

  return (
    <form onSubmit={onSubmit} noValidate className={`mx-auto w-full max-w-3xl pb-10 ${isClosing ? 'm3-sheet-exit' : 'm3-sheet-enter'}`}>
      <div className="sticky top-0 z-30 -mx-3 mb-3 flex items-center gap-3 border-b border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface)]/95 px-3 py-2.5 backdrop-blur-xl sm:mx-0 sm:rounded-b-2xl sm:px-4">
        <button
          type="button"
          onClick={requestBack}
          aria-label={backLabel}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-95"
        >
          <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-black leading-tight text-[var(--color-md-on-surface)]">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--color-md-on-surface-variant)]">
              {subtitle}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || submitDisabled}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--color-md-primary)] px-4 text-xs font-bold text-[var(--color-md-on-primary)] shadow-xs transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5 stroke-[2.8]" aria-hidden="true" />
          )}
          <span>{isSubmitting ? 'Guardando…' : submitLabel}</span>
        </button>
      </div>

      <ContextualToast
        message={error ?? null}
        variant="error"
        bottomOffset="compact"
        onClose={() => onDismissError?.()}
      />

      <div className="md-card divide-y divide-[var(--color-md-outline-variant)] overflow-hidden rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] text-[var(--color-md-on-surface)] shadow-xs">
        {children}
      </div>
    </form>
  );
};
