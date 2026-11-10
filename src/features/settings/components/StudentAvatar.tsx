import React from 'react';
import { initialsOf } from '../studentIdentity';

interface StudentAvatarProps {
  avatarUrl?: string;
  name?: string;
  /** Tamaño, radio y tipografía de las iniciales (ej. "h-11 w-11 rounded-2xl text-sm"). */
  className?: string;
  /** Qué mostrar sin foto ni nombre; por defecto, el ícono de la app. */
  fallback?: React.ReactNode;
}

/**
 * Avatar del estudiante con tres niveles: foto de perfil → monograma con el color primario del
 * tema → ícono de la app. Es decorativo (aria-hidden): el nombre ya se lee en el texto vecino.
 */
export const StudentAvatar: React.FC<StudentAvatarProps> = ({ avatarUrl, name, className = '', fallback }) => {
  const trimmedName = name?.trim();

  if (avatarUrl) {
    return (
      <span aria-hidden="true" className={`block shrink-0 overflow-hidden bg-[var(--color-md-surface-container-high)] ${className}`}>
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      </span>
    );
  }

  if (trimmedName) {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center bg-[var(--color-md-primary)] font-black text-[var(--color-md-on-primary)] ${className}`}
      >
        {initialsOf(trimmedName)}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      {fallback ?? <img src="./app-icon-claro.svg" alt="" className="h-full w-full bg-white object-contain p-0.5" draggable={false} />}
    </span>
  );
};
