import React, { useId, useRef, useState } from 'react';
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
  /**
   * Aviso de contraste con íconos blancos (materias y docentes). En "Crea tu paleta" no aplica:
   * allí el generador ya garantiza el contraste de todos los textos.
   */
  showIconContrastHint?: boolean;
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

/** HSV: matiz 0-360, saturación y brillo 0-1 (el modelo del cuadro de color). */
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)]
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Selector de color M3 propio, en sustitución del diálogo nativo de <input type="color"> (que en
 * Android abre una ventana del sistema ajena al estilo de la app). Ofrece tonos armónicos, un
 * cuadro de saturación y brillo, un deslizador de matiz y entrada hexadecimal; el color solo se
 * aplica al pulsar "Aplicar color".
 */
export const M3ColorPickerModal: React.FC<M3ColorPickerModalProps> = ({
  isOpen,
  initialColor,
  onClose,
  onApply,
  title = 'Color personalizado',
  showIconContrastHint = true,
}) => {
  const hexInputId = useId();
  const startColor = normalizeHex(initialColor) ?? '#1E88E5';
  const [draft, setDraft] = useState(startColor);
  const [hexText, setHexText] = useState(startColor.slice(1));
  // El matiz se guarda aparte: en grises/negro (saturación o brillo 0) el hex no lo conserva
  const [hue, setHue] = useState(() => hexToHsv(startColor).h);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const padRef = useRef<HTMLDivElement>(null);

  // Cada apertura parte del color actual (ajuste de estado durante el render, sin efectos)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDraft(startColor);
      setHexText(startColor.slice(1));
      setHue(hexToHsv(startColor).h);
    }
  }

  const setColor = (hex: string, nextHue?: number) => {
    setDraft(hex);
    setHexText(hex.slice(1));
    const hsv = hexToHsv(hex);
    if (nextHue !== undefined) setHue(nextHue);
    else if (hsv.s > 0 && hsv.v > 0) setHue(hsv.h);
  };

  const { s, v } = hexToHsv(draft);
  const isHexValid = normalizeHex(hexText) !== null;
  const lowContrast = contrastWithWhite(draft) < 3;

  // Cuadro de saturación (horizontal) y brillo (vertical)
  const pickFromPad = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextS = clamp01((clientX - rect.left) / rect.width);
    const nextV = clamp01(1 - (clientY - rect.top) / rect.height);
    setColor(hsvToHex(hue, nextS, nextV), hue);
  };

  const handlePadKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setColor(hsvToHex(hue, clamp01(s + move[0]), clamp01(v + move[1])), hue);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        {/* Vista previa */}
        <div className="flex items-center gap-3">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-[var(--color-md-outline-variant)] transition-colors duration-150"
            style={{ backgroundColor: draft }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-mono text-lg font-black text-[var(--color-md-on-surface)]">{draft}</p>
            {showIconContrastHint &&
              (lowContrast ? (
                <p className="mt-0.5 flex items-start gap-1 text-xs text-[var(--color-md-on-surface-variant)]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Color muy claro: los íconos blancos se leerán con dificultad.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-[var(--color-md-on-surface-variant)]">Buen contraste con íconos blancos.</p>
              ))}
          </div>
        </div>

        {/* Cuadro de saturación y brillo */}
        <div
          ref={padRef}
          role="slider"
          tabIndex={0}
          aria-label="Saturación y brillo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(s * 100)}
          aria-valuetext={`Saturación ${Math.round(s * 100)} %, brillo ${Math.round(v * 100)} %`}
          data-no-swipe="true"
          onKeyDown={handlePadKeyDown}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pickFromPad(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) pickFromPad(e.clientX, e.clientY);
          }}
          className="relative h-40 w-full cursor-crosshair touch-none select-none overflow-hidden rounded-2xl ring-1 ring-[var(--color-md-outline-variant)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-md-primary)]"
          style={{
            backgroundColor: hsvToHex(hue, 1, 1),
            backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #FFF, transparent)',
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.35)]"
            style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, backgroundColor: draft }}
          />
        </div>

        {/* Matiz continuo */}
        <div className="space-y-1.5">
          <label htmlFor={`${hexInputId}-hue`} className="flex justify-between text-xs font-semibold text-[var(--color-md-on-surface)]">
            Matiz
            <span className="font-mono text-[var(--color-md-on-surface-variant)]">{Math.round(hue)}°</span>
          </label>
          <input
            id={`${hexInputId}-hue`}
            type="range"
            min={0}
            max={359}
            value={Math.round(hue)}
            data-no-swipe="true"
            onChange={(e) => {
              const nextHue = Number(e.target.value);
              // Desde un gris o negro, el matiz se hace visible con saturación y brillo razonables
              setColor(hsvToHex(nextHue, s < 0.05 ? 0.75 : s, v < 0.05 ? 0.85 : v), nextHue);
            }}
            className="h-3 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--hue-thumb)] [&::-webkit-slider-thumb]:shadow-md"
            style={
              {
                background:
                  'linear-gradient(to right, #FF0000, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000)',
                '--hue-thumb': hsvToHex(hue, 1, 1),
              } as React.CSSProperties
            }
          />
        </div>

        {/* Tonos armónicos */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--color-md-on-surface)]">Tonos sugeridos</p>
          {HARMONIC_SWATCHES.map((row) => (
            <div key={row.tone} role="group" aria-label={row.groupLabel} className="grid grid-cols-8 gap-1.5">
              {row.colors.map((c) => {
                const isSelected = c === draft;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
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
                if (valid) {
                  setDraft(valid);
                  const hsv = hexToHsv(valid);
                  if (hsv.s > 0 && hsv.v > 0) setHue(hsv.h);
                }
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
