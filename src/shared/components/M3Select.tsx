import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

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

/**
 * M3Select - Componente Universal de Selección Desplegable Canónico Material Design 3
 * 
 * Estándar único para TODOS los selectores (antiguos y futuros) de la aplicación.
 * Reemplaza por completo los elementos <select> nativos del sistema operativo por un menú flotante
 * con elevación M3, esquinas orgánicas (rounded-[22px]), adaptación automática a la paleta
 * Material You activa y retroalimentación con checkmarks.
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const isPill = variant === 'pill';

  return (
    <div className={`relative ${isPill ? 'inline-block' : 'w-full'} ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider mb-1.5 select-none">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Botón Disparador del Menú (Field o Pill) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between transition-all text-left cursor-pointer select-none border ${
          isPill
            ? 'gap-2 px-3.5 h-10 sm:h-11 rounded-full text-xs font-bold shadow-2xs'
            : 'gap-2.5 px-3.5 py-2.5 rounded-2xl'
        } ${
          isOpen
            ? 'bg-[#FDFBFF] dark:bg-[#1D2024] border-[#00639B] dark:border-[#92CCFF] ring-2 ring-[#00639B]/20 dark:ring-[#92CCFF]/20 shadow-xs'
            : error
            ? 'bg-red-50/50 dark:bg-red-950/20 border-red-500/60 dark:border-red-500/60'
            : 'bg-[#E2E7EF]/70 dark:bg-[#272A2F]/70 border-[#C3C7D0]/60 dark:border-[#43474E]/60 hover:bg-[#D0E4FF]/50 dark:hover:bg-[#004B76]/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Ícono Fijo Izquierdo (ej. Ordenar) o Indicador de Opción Seleccionada */}
          {leadingIcon ? (
            <span className="shrink-0 flex items-center justify-center text-[#00639B] dark:text-[#92CCFF]">
              {leadingIcon}
            </span>
          ) : selectedOption ? (
            selectedOption.icon ? (
              <span className="shrink-0 flex items-center justify-center">
                {selectedOption.icon}
              </span>
            ) : selectedOption.color ? (
              <span
                className="w-6 h-6 rounded-lg shrink-0 shadow-2xs transition-colors ring-1 ring-black/10 dark:ring-white/20"
                style={{ backgroundColor: selectedOption.color }}
              />
            ) : null
          ) : !isPill ? (
            <span className="w-6 h-6 rounded-lg shrink-0 bg-[#C3C7D0]/30 dark:bg-[#43474E]/30 border border-dashed border-[#C3C7D0]/60 dark:border-[#43474E]/60 flex items-center justify-center" />
          ) : null}

          {/* Texto Principal y Secundario */}
          <div className="min-w-0 flex-1 truncate">
            {selectedOption ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className={`${isPill ? 'text-xs' : 'text-sm'} font-bold text-[#191C20] dark:text-[#E2E2E6] truncate`}>
                  {selectedOption.label}
                </span>
                {selectedOption.sublabel && (
                  <span className="text-xs font-mono font-medium text-[#43474E] dark:text-[#8C9199] truncate shrink-0">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </div>
            ) : (
              <span className={`${isPill ? 'text-xs' : 'text-sm'} font-medium text-[#72777F] dark:text-[#8C9199] truncate`}>
                {placeholder}
              </span>
            )}
          </div>
        </div>

        {/* Chevron indicador con rotación suave */}
        <ChevronDown
          className={`w-4 h-4 text-[#72777F] dark:text-[#8C9199] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#00639B] dark:text-[#92CCFF]' : ''
          }`}
        />
      </button>

      {/* Menú Desplegable Flotante Material Design 3 */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute top-[calc(100%+6px)] z-50 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/70 dark:border-[#43474E]/70 rounded-[22px] shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] p-1.5 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150 ${
            isPill
              ? `min-w-[210px] ${menuAlign === 'right' ? 'right-0' : 'left-0'}`
              : 'left-0 right-0'
          }`}
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-xs text-center text-[#72777F] dark:text-[#8C9199]">
              No hay opciones disponibles
            </div>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer select-none my-0.5 ${
                    isSelected
                      ? 'bg-[#D0E4FF] dark:bg-[#004B76]/50 text-[#001D32] dark:text-[#D0E4FF] font-bold shadow-2xs'
                      : 'hover:bg-[#E2E7EF]/70 dark:hover:bg-[#272A2F]/70 text-[#191C20] dark:text-[#E2E2E6]'
                  } ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Indicador de Color / Ícono de la opción */}
                    {option.icon ? (
                      <span className="shrink-0 flex items-center justify-center">
                        {option.icon}
                      </span>
                    ) : option.color ? (
                      <span
                        className="w-6 h-6 rounded-lg shrink-0 shadow-2xs ring-1 ring-black/10 dark:ring-white/20"
                        style={{ backgroundColor: option.color }}
                      />
                    ) : null}

                    {/* Contenido de la opción */}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate leading-tight">
                        {option.label}
                      </div>
                      {option.sublabel && (
                        <div
                          className={`text-xs font-mono truncate mt-0.5 ${
                            isSelected
                              ? 'text-[#001D32]/80 dark:text-[#D0E4FF]/80'
                              : 'text-[#43474E] dark:text-[#8C9199]'
                          }`}
                        >
                          {option.sublabel}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Checkmark activo M3 */}
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] flex items-center justify-center shrink-0 shadow-2xs animate-in zoom-in-75 duration-100">
                      <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Mensaje de error de validación si existe */}
      {error && (
        <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-1 pl-1">
          {error}
        </p>
      )}
    </div>
  );
};
