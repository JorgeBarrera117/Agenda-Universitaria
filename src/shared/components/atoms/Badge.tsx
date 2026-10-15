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
    xs: 'px-2 py-0.5 text-[10px] rounded-lg font-mono',
    sm: 'px-2.5 py-1 text-xs rounded-xl',
    md: 'px-3 py-1.5 text-xs sm:text-sm rounded-xl',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    primary:
      'bg-cove-blue/10 dark:bg-cove-sky/15 text-cove-blue dark:text-cove-sky border border-cove-sky/30 dark:border-cove-sky/40',
    secondary:
      'bg-cove-sand/50 dark:bg-amber-950/40 text-cove-navy dark:text-amber-200 border border-cove-gold/60 dark:border-amber-800/60',
    success:
      'bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-400/30',
    warning:
      'bg-amber-500/10 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-400/30',
    danger:
      'bg-red-500/10 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-400/30',
    navy: 'bg-cove-navy text-white shadow-2xs font-mono',
    neutral:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80',
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
