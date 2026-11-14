import React, { useState, useRef, useEffect, useLayoutEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { useExitTransition, MOTION_EXIT_MS } from '../hooks/useExitTransition';
import { useBackButton, BACK_PRIORITY } from '../hooks/useBackButton';

export interface M3SelectOption<T extends string | number = string> {
  value: T;
  label: string;
  sublabel?: string;
  color?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface M3SelectProps<T extends string | number = string> {
  value: T | '';
  onChange: (value: T) => void;
  options: M3SelectOption<T>[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  error?: string | null;
  required?: boolean;
  /** Variante visual: 'field' para formularios y 'pill' para barras de herramientas/ordenamiento */
  variant?: 'field' | 'pill';
  /** Ícono opcional fijo a la izquierda del disparador (ej. ArrowUpDown en ordenamiento) */
  leadingIcon?: React.ReactNode;
  /** Alineación del menú desplegable cuando es variante 'pill' */
  menuAlign?: 'left' | 'right';
}

/** Mismo corte que Modal (sm = 640 px): por debajo, la lista se abre como hoja inferior. */
const PHONE_QUERY = '(max-width: 639.98px)';
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;
const MENU_MAX_HEIGHT = 320;
const TYPEAHEAD_RESET_MS = 600;

type Presentation = 'menu' | 'sheet';

/**
 * M3Select - selector desplegable Material Design 3 de toda la app.
 *
 * - PC/tablet: menú flotante dibujado por encima de todo (portal en <body>, posición fija junto
 *   al campo). Así nunca queda recortado dentro de un diálogo o de una tarjeta con scroll; se abre
 *   hacia arriba o hacia abajo según el espacio y se reacomoda al desplazar o cambiar el tamaño.
 * - Teléfono: hoja inferior con la lista completa y opciones grandes para el dedo.
 * - Teclado: flechas, Inicio/Fin, Enter/Espacio para elegir, Escape para cerrar y escribir una
 *   letra salta a la opción que empieza con ella. El foco se queda en el campo
 *   (aria-activedescendant), como en el patrón "combobox" de WAI-ARIA.
 */
export const M3Select = <T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = '-- Selecciona una opción --',
  label,
  disabled = false,
  className = '',
  error,
  required = false,
  variant = 'field',
  leadingIcon,
  menuAlign = 'left',
}: M3SelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [presentation, setPresentation] = useState<Presentation>('menu');
  const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const labelId = useId();
  const valueId = useId();
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const { isClosing, runExit } = useExitTransition(presentation === 'sheet' ? MOTION_EXIT_MS.dialog : MOTION_EXIT_MS.menu);

  const isPill = variant === 'pill';
  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // Cierre con animación de salida antes de desmontar el menú
  const closeMenu = useCallback(() => runExit(() => setIsOpen(false)), [runExit]);

  const enabledIndex = useCallback(
    (from: number, step: 1 | -1) => {
      if (options.length === 0) return -1;
      for (let i = 1; i <= options.length; i += 1) {
        const index = (from + step * i + options.length * 2) % options.length;
        if (!options[index].disabled) return index;
      }
      return -1;
    },
    [options]
  );

  const openMenu = () => {
    if (disabled) return;
    setPresentation(window.matchMedia(PHONE_QUERY).matches ? 'sheet' : 'menu');
    setMenuStyle({ visibility: 'hidden' });
    setActiveIndex(selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : enabledIndex(-1, 1));
    setIsOpen(true);
  };

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    closeMenu();
    triggerRef.current?.focus({ preventScroll: true });
  };

  // Posición del menú flotante (PC/tablet): junto al campo, sin salirse de la pantalla
  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Si el campo salió de la vista (scroll), el menú ya no tiene a qué anclarse
    if (rect.bottom < 0 || rect.top > vh) {
      closeMenu();
      return;
    }
    const spaceBelow = vh - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    const wanted = Math.min(MENU_MAX_HEIGHT, options.length * 52 + 16);
    const up = spaceBelow < Math.min(wanted, 220) && spaceAbove > spaceBelow;
    const width = Math.min(isPill ? Math.max(rect.width, 210) : rect.width, vw - VIEWPORT_MARGIN * 2);
    const preferredLeft = isPill && menuAlign === 'right' ? rect.right - width : rect.left;
    const left = Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), vw - width - VIEWPORT_MARGIN);
    setOpenDirection(up ? 'up' : 'down');
    setMenuStyle({
      position: 'fixed',
      left,
      width,
      maxHeight: Math.max(140, Math.min(MENU_MAX_HEIGHT, up ? spaceAbove : spaceBelow)),
      ...(up ? { bottom: vh - rect.top + MENU_GAP } : { top: rect.bottom + MENU_GAP }),
    });
  }, [closeMenu, isPill, menuAlign, options.length]);

  useLayoutEffect(() => {
    if (!isOpen || presentation !== 'menu') return;
    positionMenu();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(positionMenu);
    };
    // capture: también los scrolls de contenedores internos (el cuerpo de un diálogo, por ejemplo)
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [isOpen, presentation, positionMenu]);

  // Mantener visible la opción activa al moverse con el teclado
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, activeIndex, listboxId]);

  // Cerrar al tocar fuera del campo y del menú (el menú vive en un portal, fuera del contenedor)
  useEffect(() => {
    if (!isOpen || presentation !== 'menu') return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, presentation, closeMenu]);

  // Teclado mientras está abierto (el foco sigue en el campo). Escape se marca como atendido
  // para que el diálogo que lo contiene no se cierre también.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        triggerRef.current?.focus({ preventScroll: true });
      } else if (event.key === 'Tab') {
        closeMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

  // Botón "Atrás" de Android: cierra la lista antes que el diálogo que la contiene
  useBackButton(
    () => {
      closeMenu();
      return true;
    },
    BACK_PRIORITY.MODAL + 5,
    isOpen
  );

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const { key } = event;
    if (!isOpen) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => enabledIndex(current, key === 'ArrowDown' ? 1 : -1));
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault();
      setActiveIndex(key === 'Home' ? enabledIndex(-1, 1) : enabledIndex(options.length, -1));
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option && !option.disabled) handleSelect(option.value);
    } else if (key.length === 1 && /\S/.test(key)) {
      // Búsqueda por letras: "m" → primera opción que empieza con M; "ma" → con "Ma"…
      const now = event.timeStamp;
      const buffer = now - typeaheadRef.current.at > TYPEAHEAD_RESET_MS ? key : typeaheadRef.current.text + key;
      typeaheadRef.current = { text: buffer, at: now };
      const normalized = buffer.toLocaleLowerCase('es');
      const start = buffer.length === 1 ? activeIndex + 1 : activeIndex;
      for (let i = 0; i < options.length; i += 1) {
        const index = (start + i + options.length) % options.length;
        if (!options[index].disabled && options[index].label.toLocaleLowerCase('es').startsWith(normalized)) {
          setActiveIndex(index);
          break;
        }
      }
    }
  };

  const renderOptions = (large: boolean) =>
    options.length === 0 ? (
      <div className="px-4 py-3 text-center text-xs text-[var(--color-md-on-surface-variant)]">No hay opciones disponibles</div>
    ) : (
      options.map((option, index) => {
        const isSelected = option.value === value;
        // El resaltado de "opción activa" es para el teclado: en la hoja táctil no se muestra
        const isActive = !large && index === activeIndex;
        return (
          <div
            key={String(option.value)}
            id={optionId(index)}
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            onPointerEnter={() => !option.disabled && setActiveIndex(index)}
            onClick={() => !option.disabled && handleSelect(option.value)}
            className={`my-0.5 flex w-full cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-3.5 text-left transition-colors ${
              large ? 'min-h-[52px] py-3' : 'py-2.5'
            } ${
              isSelected
                ? 'bg-[var(--color-md-primary-container)] font-bold text-[var(--color-md-on-primary-container)] shadow-2xs'
                : isActive
                  ? 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface)]'
                  : 'text-[var(--color-md-on-surface)]'
            } ${isActive ? 'ring-2 ring-inset ring-[var(--color-md-primary)]/35' : ''} ${
              option.disabled ? 'cursor-not-allowed opacity-40' : ''
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {option.icon ? (
                <span className="flex shrink-0 items-center justify-center">{option.icon}</span>
              ) : option.color ? (
                <span
                  className="h-6 w-6 shrink-0 rounded-lg shadow-2xs ring-1 ring-black/10 dark:ring-white/20"
                  style={{ backgroundColor: option.color }}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className={`truncate font-semibold leading-tight ${large ? 'text-[15px]' : 'text-sm'}`}>{option.label}</div>
                {option.sublabel && (
                  <div
                    className={`mt-0.5 truncate font-mono text-xs ${
                      isSelected ? 'text-[var(--color-md-on-primary-container)] opacity-80' : 'text-[var(--color-md-on-surface-variant)]'
                    }`}
                  >
                    {option.sublabel}
                  </div>
                )}
              </div>
            </div>
            {isSelected && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-2xs">
                <Check className="h-3.5 w-3.5 stroke-[2.8]" />
              </div>
            )}
          </div>
        );
      })
    );

  const popup =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          presentation === 'menu' ? (
            <div
              ref={popupRef}
              id={listboxId}
              role="listbox"
              aria-labelledby={label ? labelId : undefined}
              style={menuStyle}
              className={`custom-scrollbar z-[70] overflow-y-auto rounded-[22px] border border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${
                isClosing ? 'm3-menu-exit' : 'm3-menu-enter'
              } ${openDirection === 'up' ? 'origin-bottom' : 'origin-top'}`}
            >
              {renderOptions(false)}
            </div>
          ) : (
            <div
              className={`fixed inset-0 z-[70] flex items-end bg-black/40 ${isClosing ? 'm3-backdrop-exit' : 'm3-backdrop-enter'}`}
              onClick={(event) => {
                if (event.target === event.currentTarget) closeMenu();
              }}
            >
              <div
                ref={popupRef}
                className={`flex max-h-[75dvh] w-full flex-col rounded-t-[28px] bg-[var(--color-md-surface-container)] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] text-[var(--color-md-on-surface)] shadow-[0_-4px_24px_rgba(0,0,0,0.2)] ${
                  isClosing ? 'm3-bottom-sheet-exit' : 'm3-bottom-sheet-enter'
                }`}
              >
                <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden="true">
                  <span className="h-1 w-8 rounded-full bg-[var(--color-md-outline)] opacity-60" />
                </div>
                <p className="shrink-0 px-6 pb-2 pt-1 text-sm font-bold text-[var(--color-md-on-surface-variant)]">
                  {label ?? placeholder}
                </p>
                <div
                  id={listboxId}
                  role="listbox"
                  aria-label={label ?? placeholder}
                  className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3"
                >
                  {renderOptions(true)}
                </div>
              </div>
            </div>
          ),
          document.body
        )
      : null;

  return (
    <div className={`relative ${isPill ? 'inline-block' : 'w-full'} ${className}`} ref={containerRef}>
      {label && (
        <span id={labelId} className="mb-1.5 block select-none text-xs font-semibold text-[var(--color-md-on-surface)]">
          {label}
          {required && <span className="text-[var(--color-md-primary)]" aria-hidden="true"> *</span>}
        </span>
      )}

      {/* Disparador del menú (Field o Pill) */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        role="combobox"
        aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className={`flex w-full cursor-pointer select-none items-center justify-between border text-left transition-all ${
          isPill ? 'h-10 gap-2 rounded-full px-3.5 text-xs font-bold shadow-2xs sm:h-11' : 'gap-2.5 rounded-2xl px-3.5 py-2.5'
        } ${
          isOpen
            ? 'border-[var(--color-md-primary)] bg-[var(--color-md-card-bg)] shadow-xs ring-2 ring-[var(--color-md-primary)]/20'
            : error
              ? 'border-red-500/60 bg-red-50/50 dark:border-red-500/60 dark:bg-red-950/20'
              : 'border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] hover:border-[var(--color-md-outline)]'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Ícono fijo izquierdo (ej. Ordenar) o indicador de la opción elegida */}
          {leadingIcon ? (
            <span className="flex shrink-0 items-center justify-center text-[var(--color-md-primary)]">{leadingIcon}</span>
          ) : selectedOption ? (
            selectedOption.icon ? (
              <span className="flex shrink-0 items-center justify-center">{selectedOption.icon}</span>
            ) : selectedOption.color ? (
              <span
                className="h-6 w-6 shrink-0 rounded-lg shadow-2xs ring-1 ring-black/10 transition-colors dark:ring-white/20"
                style={{ backgroundColor: selectedOption.color }}
              />
            ) : null
          ) : !isPill ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)]" />
          ) : null}

          {/* Texto principal y secundario */}
          <div id={valueId} className="min-w-0 flex-1 truncate">
            {selectedOption ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className={`${isPill ? 'text-xs' : 'text-sm'} truncate font-bold text-[var(--color-md-on-surface)]`}>
                  {selectedOption.label}
                </span>
                {selectedOption.sublabel && (
                  <span className="shrink-0 truncate font-mono text-xs font-medium text-[var(--color-md-on-surface-variant)]">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </div>
            ) : (
              <span className={`${isPill ? 'text-xs' : 'text-sm'} truncate font-medium text-[var(--color-md-on-surface-variant)]`}>
                {placeholder}
              </span>
            )}
          </div>
        </div>

        {/* Chevron indicador con rotación suave */}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)] transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--color-md-primary)]' : ''
          }`}
        />
      </button>

      {popup}

      {/* Mensaje de error de validación si existe */}
      {error && <p className="mt-1 pl-1 text-[11px] font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};
