import React from 'react';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

interface RoomAvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
  /** Punto de conexión. undefined = no se muestra. */
  online?: boolean;
}

export const RoomAvatar: React.FC<RoomAvatarProps> = ({ name, color, size = 'md', online }) => (
  <span className="relative inline-flex shrink-0">
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white ${size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
    {online !== undefined && (
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-md-surface-container)] ${online ? 'bg-emerald-500' : 'bg-[var(--color-md-outline)]'}`}
        aria-hidden="true"
      />
    )}
  </span>
);
