import React from 'react';

/**
 * Gorro de fiesta de Año Nuevo sobre la foto del estudiante. Colores fijos (dorado y rojo):
 * es un adorno reconocible, no un elemento de la interfaz.
 */
export const PartyHat: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
    <path d="M16 3L26 27H6Z" fill="#FFB300" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" strokeLinejoin="round" />
    <path d="M13.2 9.8L19.4 11.2M10.6 16L22 18.4M8.2 21.8L24.4 25" stroke="#E53935" strokeWidth="2" strokeLinecap="round" />
    <path d="M5 27.5C10 29 22 29 27 27.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <circle cx="16" cy="3.2" r="2.8" fill="#FFFFFF" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
  </svg>
);
