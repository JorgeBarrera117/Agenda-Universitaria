import React from 'react';

/**
 * Gorro de Navidad que se pone sobre la foto del estudiante en la barra superior.
 * Lleva colores fijos (rojo y blanco): es un adorno reconocible, no un elemento de la interfaz.
 */
export const SantaHat: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
    <path
      d="M5 22C6 12 12.5 5 21.5 5.5C26 5.8 29 9.5 28.5 15C26.5 12.5 23.8 11.4 21 12C16.5 13 13.8 17 13.5 22Z"
      fill="#D32F2F"
      stroke="rgba(0,0,0,0.18)"
      strokeWidth="0.8"
    />
    <path d="M16 9.5C18 8.6 20 8.4 22 8.8" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    <circle cx="28.2" cy="16" r="3.2" fill="#FFFFFF" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
    <rect x="2.5" y="19.5" width="15" height="6" rx="3" fill="#FFFFFF" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
  </svg>
);
