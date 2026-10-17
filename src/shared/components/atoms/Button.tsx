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

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon-xs' | 'icon-sm' | 'icon-md';

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

    // 2. Variantes visuales semánticas Material Design 3 (Material Web M3)
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-[#00639B] dark:bg-[#96CCFF] text-white dark:text-[#003353] hover:shadow-xs hover:bg-[#005282] dark:hover:bg-[#B3D9FF] active:scale-95 shadow-xs',
      secondary:
        'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] hover:bg-[#B3D3FF] dark:hover:bg-[#005B8F] active:scale-95 shadow-2xs',
      outline:
        'border border-[#72787E] dark:border-[#8C9199] text-[#00639B] dark:text-[#96CCFF] bg-transparent hover:bg-[#00639B]/8 dark:hover:bg-white/8 active:scale-95',
      ghost:
        'bg-transparent text-[#00639B] dark:text-[#96CCFF] hover:bg-[#00639B]/8 dark:hover:bg-white/8 active:scale-95',
      danger:
        'bg-[#BA1A1A] dark:bg-[#FFB4AB] text-white dark:text-[#690005] hover:bg-[#93000A] dark:hover:bg-[#FFDAD6] active:scale-95 shadow-xs',
      success:
        'bg-[#006E1C] dark:bg-[#78DC77] text-white dark:text-[#003A0B] hover:bg-[#005313] dark:hover:bg-[#98F096] active:scale-95 shadow-xs',
      'action-blue':
        'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] hover:bg-[#B3D3FF] dark:hover:bg-[#005B8F] active:scale-90 transition-all shadow-2xs',
      'action-emerald':
        'bg-[#C4EED0] dark:bg-[#0A532C] text-[#00210E] dark:text-[#C4EED0] hover:bg-[#A6E6B8] dark:hover:bg-[#0E6838] active:scale-90 transition-all shadow-2xs',
      'action-indigo':
        'bg-[#E8DEF8] dark:bg-[#4A4458] text-[#1D192B] dark:text-[#E8DEF8] hover:bg-[#DBCDEE] dark:hover:bg-[#585168] active:scale-90 transition-all shadow-2xs',
      'action-rose':
        'bg-[#FFDAD6] dark:bg-[#93000A] text-[#410002] dark:text-[#FFDAD6] hover:bg-[#FFB4AB] dark:hover:bg-[#BA1A1A] active:scale-90 transition-all shadow-2xs',
    };

    // 3. Tamaños calibrados Material Design 3 (Pills y Icon Buttons circulares)
    const sizeStyles: Record<ButtonSize, string> = {
      xs: 'px-3 py-1 text-xs rounded-full gap-1.5',
      sm: 'px-4 py-1.5 text-xs rounded-full gap-1.5 font-medium',
      md: 'px-5 py-2.5 text-xs sm:text-sm rounded-full gap-2 font-medium',
      lg: 'px-7 py-3 text-sm sm:text-base rounded-full gap-2.5 font-medium',
      'icon-xs': 'w-8 h-8 rounded-full p-0 shrink-0',
      'icon-sm': 'w-9 h-9 rounded-full p-0 shrink-0',
      'icon-md': 'w-10 h-10 rounded-full p-0 shrink-0',
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
          icon && <span className="shrink-0 text-current flex items-center justify-center">{icon}</span>
        )}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
