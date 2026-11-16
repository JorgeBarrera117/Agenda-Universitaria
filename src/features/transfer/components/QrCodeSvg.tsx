import React, { useMemo } from 'react';
import { encode } from 'uqr';

interface QrCodeSvgProps {
  value: string;
  /** Lado en píxeles CSS. */
  size?: number;
  label?: string;
}

/**
 * Dibuja un código QR como SVG (sin red ni canvas). Siempre negro sobre blanco, también en modo
 * oscuro: las cámaras leen mal los QR invertidos o de poco contraste.
 */
export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({ value, size = 232, label = 'Código QR' }) => {
  const { path, modules } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 3 });
    let d = '';
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { path: d, modules: qr.size };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${modules} ${modules}`}
      shapeRendering="crispEdges"
      className="block max-w-full"
    >
      <rect width={modules} height={modules} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
};
