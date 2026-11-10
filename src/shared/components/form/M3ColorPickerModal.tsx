import React, { useId, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../atoms';
import { formInputClass } from './formStyles';

interface M3ColorPickerModalProps {
  isOpen: boolean;
  /** Color actual (#RRGGBB); es el punto de partida cada vez que se abre el modal. */
  initialColor: string;
  onClose: () => void;
  onApply: (hex: string) => void;
  title?: string;
}

/** 24 tonos armónicos: 8 matices (rojo → rosa) en versión pastel, vibrante y profunda. */
const HARMONIC_SWATCHES: { tone: string; groupLabel: string; colors: string[] }[] = [
  { tone: 'Pastel', groupLabel: 'Tonos pastel', colors: ['#F2B8B5', '#FFCC80', '#FFE082', '#A5D6A7', '#80CBC4', '#90CAF9', '#B39DDB', '#F48FB1'] },
  { tone: 'Vibrante', groupLabel: 'Tonos vibrantes', colors: ['#E53935', '#FB8C00', '#F9A825', '#43A047', '#00897B', '#1E88E5', '#5E35B1', '#D81B60'] },
  { tone: 'Profundo', groupLabel: 'Tonos profundos', colors: ['#B71C1C', '#E65100', '#E67700', '#1B5E20', '#004D40', '#0D47A1', '#311B92', '#880E4F'] },
];

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

function normalizeHex(value: string): string | null {
  const match = HEX_PATTERN.exec(value.trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[0, 8, 4]
    .map((n) => Math.round(channel(n) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** Contraste WCAG entre el color y el blanco (los íconos de materias y docentes son blancos). */
function contrastWithWhite(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05);
}

/**
 * Selector de color M3 propio, en sustitución del diálogo nativo de <input type="color"> (que en
 * Android abre una ventana del sistema ajena al estilo de la app). Ofrece tonos armónicos, un
 * deslizador de matiz y entrada hexadecimal; el color solo se aplica al pulsar "Aplicar color".
 */
export const M3ColorPickerModal: React.FC<M3ColorPickerModalProps> = ({
  isOpen,
  initialColor,
  onClose,
  onApply,
  title = 'Color personalizado',
}) => {
  const hexInputId = useId();
  const startColor = normalizeHex(initialColor) ?? '#1E88E5';
  const [draft, setDraft] = useState(startColor);
  const [hexText, setHexText] = useState(startColor.slice(1));
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Cada apertura parte del color actual (ajuste de estado durante el render, sin efectos)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDraft(startColor);
      setHexText(startColor.slice(1));
    }
  }

  const choose = (hex: string) => {
    setDraft(hex);
    setHexText(hex.slice(1));
  };

  const { h, s, l } = hexToHsl(draft);
  const isHexValid = normalizeHex(hexText) !== null;
  const lowContrast = contrastWithWhite(draft) < 3;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        {/* Vista previa */}
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-[var(--color-md-outline-variant)] transition-colors duration-150"
            style={{ backgroundColor: draft }}
            aria-hidden="true"
          >
            <Check className="h-6 w-6 text-white drop-shadow" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-lg font-black text-[var(--color-md-on-surface)]">{draft}</p>
            {lowContrast ? (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-[var(--color-md-on-surface-variant)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Color muy claro: los íconos blancos se leerán con dificultad.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[var(--color-md-on-surface-variant)]">Buen contraste con íconos blancos.</p>
            )}
          </div>
        </div>

        {/* Tonos armónicos */}
        <div className="space-y-2">
          {HARMONIC_SWATCHES.map((row) => (
            <div key={row.tone} role="group" aria-label={row.groupLabel} className="grid grid-cols-8 gap-1.5">
              {row.colors.map((c) => {
                const isSelected = c === draft;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => choose(c)}
                    aria-label={`${row.tone} ${c}`}
                    aria-pressed={isSelected}
                    className={`flex aspect-square min-h-[34px] items-center justify-center rounded-full transition-all duration-150 ease-out active:scale-95 ${
                      isSelected ? 'ring-2 ring-[var(--color-md-on-surface)] ring-offset-2 ring-offset-[var(--color-md-surface-container)]' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {isSelected && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Matiz continuo: conserva la saturación y luminosidad del color actual */}
        <div className="space-y-1.5">
          <label htmlFor={`${hexInputId}-hue`} className="flex justify-between text-xs font-semibold text-[var(--color-md-on-surface)]">
            Matiz
            <span className="font-mono text-[var(--color-md-on-surface-variant)]">{Math.round(h)}°</span>
          </label>
          <input
            id={`${hexInputId}-hue`}
            type="range"
            min={0}
            max={359}
            value={Math.round(h)}
            onChange={(e) => choose(hslToHex(Number(e.target.value), s < 15 ? 70 : s, l < 15 || l > 90 ? 50 : l))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--color-md-on-surface)] [&::-webkit-slider-thumb]:shadow-md"
            style={{
              background:
                'linear-gradient(to right, #FF0000, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000)',
            }}
          />
        </div>

        {/* Código hexadecimal */}
        <div className="space-y-1.5">
          <label htmlFor={hexInputId} className="block text-xs font-semibold text-[var(--color-md-on-surface)]">
            Código HEX
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-[var(--color-md-on-surface-variant)]">
              #
            </span>
            <input
              id={hexInputId}
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              value={hexText}
              aria-invalid={!isHexValid}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9a-f]/gi, '').toUpperCase();
                setHexText(value);
                const valid = normalizeHex(value);
                if (valid) setDraft(valid);
              }}
              className={`${formInputClass} pl-7 font-mono uppercase`}
            />
          </div>
          {!isHexValid && (
            <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">Escribe 6 caracteres hexadecimales (0-9, A-F).</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-md-outline-variant)] pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!isHexValid}
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Aplicar color
          </Button>
        </div>
      </div>
    </Modal>
  );
};
