import React, { useCallback, useEffect, useImperativeHandle } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { ContextualToast } from '../ContextualToast';
import { PAGE_HEADER_PRIMARY_BUTTON, PageHeader } from '../PageHeader';
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
 * encabezado fijo con el estilo de Ajustes (atrás · título · acción primaria) y una superficie continua
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
      {/* Encabezado fijo con el estilo de Ajustes: volver · título · Guardar (envía el formulario) */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        onBack={requestBack}
        backLabel={backLabel}
        className="-mx-4 mb-1 px-4"
        actions={
          <button type="submit" disabled={isSubmitting || submitDisabled} className={PAGE_HEADER_PRIMARY_BUTTON}>
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5 stroke-[2.8]" aria-hidden="true" />
            )}
            <span>{isSubmitting ? 'Guardando…' : submitLabel}</span>
          </button>
        }
      />

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
