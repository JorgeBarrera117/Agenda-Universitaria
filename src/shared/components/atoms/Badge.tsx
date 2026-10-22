import React from 'react';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'navy'
  | 'neutral';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  customColor?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  size = 'sm',
  icon,
  customColor,
  children,
  className = '',
  style,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center gap-1 font-bold leading-none select-none tracking-tight';

  const sizeStyles: Record<BadgeSize, string> = {
    xs: 'px-2 py-0.5 text-[10px] rounded-md font-mono',
    sm: 'px-2.5 py-1 text-xs rounded-lg font-medium',
    md: 'px-3 py-1.5 text-xs sm:text-sm rounded-lg font-medium',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    primary:
      'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] border border-[var(--color-md-outline-variant)]',
    secondary:
      'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] border border-[var(--color-md-outline-variant)]',
    success:
      'bg-[#C4EED0] dark:bg-[#0A532C] text-[#00210E] dark:text-[#C4EED0] border border-emerald-500/20',
    warning:
      'bg-[#FFDCC1] dark:bg-[#683D00] text-[#2E1500] dark:text-[#FFDCC1] border border-amber-500/20',
    danger:
      'bg-[#FFDAD6] dark:bg-[#93000A] text-[#410002] dark:text-[#FFDAD6] border border-rose-500/20',
    navy: 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-2xs font-mono border border-white/10',
    neutral:
      'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)] border border-[var(--color-md-outline-variant)]',
  };

  const customStyle: React.CSSProperties = {
    ...(customColor
      ? {
          backgroundColor: customColor,
          color: '#ffffff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        }
      : {}),
    ...style,
  };

  return (
    <span
      style={customStyle}
      className={`${baseStyles} ${sizeStyles[size]} ${
        customColor ? '' : variantStyles[variant]
      } ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children && <span className="truncate">{children}</span>}
    </span>
  );
};
