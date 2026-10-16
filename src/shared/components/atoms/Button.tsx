import React from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'action-blue'
  | 'action-emerald'
  | 'action-indigo'
  | 'action-rose';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      isLoading = false,
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // 1. Estilos base comunes a todos los botones
    const isHidden = className.includes('hidden');
    const baseStyles = `${
      isHidden ? '' : 'inline-flex'
    } items-center justify-center font-bold transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-cove-sky/50 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed`;

    // 2. Variantes visuales semánticas
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue text-white shadow-md shadow-cove-blue/25 active:scale-95',
      secondary:
        'bg-cove-navy dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-700 text-white shadow-sm active:scale-95',
      outline:
        'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 active:scale-95 shadow-2xs',
      ghost:
        'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:scale-95',
      danger:
        'bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 text-white shadow-md shadow-rose-600/25 active:scale-95',
      success:
        'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-600/25 active:scale-95',
      'action-blue':
        'bg-gradient-to-br from-blue-600 via-blue-700 to-cove-navy hover:from-blue-500 hover:via-blue-600 hover:to-cove-navy ring-1 ring-sky-300/40 text-white shadow-sm hover:shadow-md shadow-blue-950/20 active:scale-95',
      'action-emerald':
        'bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 hover:from-emerald-500 hover:via-teal-600 hover:to-slate-900 ring-1 ring-teal-300/40 text-white shadow-sm hover:shadow-md shadow-emerald-950/20 active:scale-95',
      'action-indigo':
        'bg-gradient-to-br from-indigo-500 via-violet-700 to-slate-900 hover:from-indigo-400 hover:via-violet-600 hover:to-slate-900 ring-1 ring-violet-300/40 text-white shadow-sm hover:shadow-md shadow-indigo-950/20 active:scale-95',
      'action-rose':
        'bg-gradient-to-br from-red-500 via-rose-600 to-slate-900 hover:from-red-400 hover:via-rose-500 hover:to-slate-900 ring-1 ring-rose-300/40 text-white shadow-sm hover:shadow-md shadow-red-950/20 active:scale-95',
    };

    // 3. Tamaños calibrados para optimizar espacio
    const sizeStyles: Record<ButtonSize, string> = {
      xs: 'px-2.5 py-1 text-xs rounded-xl gap-1.5',
      sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
      md: 'px-4 py-2.5 text-xs sm:text-sm rounded-2xl gap-2',
      lg: 'px-6 py-3 text-sm sm:text-base rounded-2xl gap-2.5',
      'icon-sm': 'w-8 h-8 rounded-xl p-0 shrink-0',
      'icon-md': 'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl p-0 shrink-0',
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
