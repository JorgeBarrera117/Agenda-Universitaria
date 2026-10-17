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
      'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border border-[#00639B]/20',
    secondary:
      'bg-[#D8E3F8] dark:bg-[#3C4758] text-[#101C2B] dark:text-[#D8E3F8] border border-[#72787E]/20',
    success:
      'bg-[#C4EED0] dark:bg-[#0A532C] text-[#00210E] dark:text-[#C4EED0] border border-emerald-500/20',
    warning:
      'bg-[#FFDCC1] dark:bg-[#683D00] text-[#2E1500] dark:text-[#FFDCC1] border border-amber-500/20',
    danger:
      'bg-[#FFDAD6] dark:bg-[#93000A] text-[#410002] dark:text-[#FFDAD6] border border-rose-500/20',
    navy: 'bg-[#001D32] text-white shadow-2xs font-mono border border-white/10',
    neutral:
      'bg-[#E2E7EF] dark:bg-[#272A2F] text-[#41474D] dark:text-[#C2C7CF] border border-[#C2C7CE]/40 dark:border-white/10',
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
