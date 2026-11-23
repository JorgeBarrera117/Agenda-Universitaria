import React from 'react';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const SIZE_CLASS = {
  xs: 'h-7 w-7 text-10px',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const;

interface RoomAvatarProps {
  name: string;
  color: string;
  /** Miniatura de la foto de perfil; sin ella, iniciales sobre el color. */
  photo?: string;
  size?: keyof typeof SIZE_CLASS;
  /** Punto de conexión o de «está cerca». undefined = no se muestra. */
  online?: boolean;
}

/** Avatar de la sala: foto real con borde del color elegido, o iniciales con color. */
export const RoomAvatar: React.FC<RoomAvatarProps> = ({ name, color, photo, size = 'md', online }) => (
  <span className="relative inline-flex shrink-0">
    {photo ? (
      <img
        src={photo}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`rounded-full object-cover ring-2 ring-offset-1 ring-offset-[var(--color-md-surface-container)] ${SIZE_CLASS[size]}`}
        style={{ ['--tw-ring-color' as string]: color } as React.CSSProperties}
      />
    ) : (
      <span className={`inline-flex items-center justify-center rounded-full font-bold text-white ${SIZE_CLASS[size]}`} style={{ backgroundColor: color }} aria-hidden="true">
        {initials(name)}
      </span>
    )}
    {online !== undefined && (
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-md-surface-container)] ${online ? 'bg-emerald-500' : 'bg-[var(--color-md-outline)]'}`}
        aria-hidden="true"
      />
    )}
  </span>
);
