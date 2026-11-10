import React from 'react';
import { Check, Plus } from 'lucide-react';

export interface IdentityIconOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface IdentityPickerProps {
  /** Vista previa en vivo (avatar/insignia) que refleja color e ícono elegidos. */
  preview: React.ReactNode;
  previewTitle: string;
  previewSubtitle?: string;
  colors: string[];
  color: string;
  onColorChange: (color: string) => void;
  icons: IdentityIconOption[];
  icon: string;
  onIconChange: (iconId: string) => void;
}

/**
 * Hero de identidad visual: vista previa grande + paleta táctil (34 px) con color libre +
 * cuadrícula compacta de íconos. Todo se ajusta en filas; nunca aparece una barra de scroll horizontal.
 */
export const IdentityPicker: React.FC<IdentityPickerProps> = ({
  preview,
  previewTitle,
  previewSubtitle,
  colors,
  color,
  onColorChange,
  icons,
  icon,
  onIconChange,
}) => {
  const isCustomColor = !colors.some((c) => c.toLowerCase() === color.toLowerCase());

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
      <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:text-center">
        {preview}
        <div className="min-w-0 sm:max-w-[120px]">
          <p className="truncate text-sm font-black text-[var(--color-md-on-surface)]">{previewTitle}</p>
          {previewSubtitle && (
            <p className="truncate font-mono text-[11px] text-[var(--color-md-on-surface-variant)]">{previewSubtitle}</p>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold text-[var(--color-md-on-surface)]">Color</legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const isSelected = c.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onColorChange(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={isSelected}
                  className={`flex h-[34px] w-[34px] items-center justify-center rounded-full transition-all duration-150 ease-out active:scale-95 ${
                    isSelected
                      ? 'ring-2 ring-[var(--color-md-on-surface)] ring-offset-2 ring-offset-[var(--color-md-card-bg)]'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {isSelected && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
                </button>
              );
            })}
            <label
              title="Color personalizado"
              className={`relative flex h-[34px] w-[34px] cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-all duration-150 ease-out hover:scale-105 ${
                isCustomColor
                  ? 'border-transparent ring-2 ring-[var(--color-md-on-surface)] ring-offset-2 ring-offset-[var(--color-md-card-bg)]'
                  : 'border-[var(--color-md-outline)] bg-[var(--color-md-surface-container-high)]'
              }`}
              style={isCustomColor ? { backgroundColor: color } : undefined}
            >
              <Plus
                className={`h-4 w-4 ${isCustomColor ? 'text-white drop-shadow' : 'text-[var(--color-md-on-surface-variant)]'}`}
                aria-hidden="true"
              />
              <span className="sr-only">Elegir color personalizado</span>
              <input
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold text-[var(--color-md-on-surface)]">Ícono</legend>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {icons.map((opt) => {
              const IconComp = opt.icon;
              const isSelected = icon === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onIconChange(opt.id)}
                  title={opt.label}
                  aria-label={opt.label}
                  aria-pressed={isSelected}
                  className={`flex aspect-square min-h-[40px] items-center justify-center rounded-xl border transition-all duration-150 ease-out active:scale-95 ${
                    isSelected
                      ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                      : 'border-transparent bg-[var(--color-md-surface-container)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-outline-variant)] hover:text-[var(--color-md-on-surface)]'
                  }`}
                >
                  <IconComp className="h-[18px] w-[18px]" />
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
};
