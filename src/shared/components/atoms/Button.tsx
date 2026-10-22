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

    // 2. Variantes visuales semánticas Material Design 3 (Adaptativas a la paleta Material You activa)
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] hover:shadow-sm hover:bg-[var(--color-md-primary-hover)] active:scale-95 shadow-xs',
      secondary:
        'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] hover:bg-[var(--color-md-secondary-container)] active:scale-95 shadow-2xs',
      outline:
        'border-2 border-[var(--color-md-outline)] text-[var(--color-md-primary)] bg-transparent hover:bg-[var(--color-md-primary-container)]/30 active:scale-95',
      ghost:
        'bg-transparent text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary-container)]/30 active:scale-95',
      danger:
        'bg-[#BA1A1A] dark:bg-[#FFB4AB] text-white dark:text-[#690005] hover:bg-[#93000A] dark:hover:bg-[#FFDAD6] active:scale-95 shadow-xs',
      success:
        'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] hover:bg-[var(--color-md-primary-hover)] active:scale-95 shadow-xs',
      'action-blue':
        'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] hover:bg-[var(--color-md-secondary-container)] active:scale-90 transition-all shadow-2xs',
      'action-emerald':
        'bg-[#C4EED0] dark:bg-[#0A532C] text-[#00210E] dark:text-[#C4EED0] hover:bg-[#A6E6B8] dark:hover:bg-[#0E6838] active:scale-90 transition-all shadow-2xs',
      'action-indigo':
        'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] hover:bg-[var(--color-md-primary-container)] active:scale-90 transition-all shadow-2xs',
      'action-rose':
        'bg-[#FFDAD6] dark:bg-[#93000A] text-[#410002] dark:text-[#FFDAD6] hover:bg-[#FFB4AB] dark:hover:bg-[#BA1A1A] active:scale-90 transition-all shadow-2xs',
    };

    // 3. Tamaños calibrados Material Design 3 con Accesibilidad Visual (WCAG 2.1 AAA en Desktop)
    const sizeStyles: Record<ButtonSize, string> = {
      xs: 'px-3 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-[13px] rounded-full gap-1.5 font-bold',
      sm: 'px-4 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm rounded-full gap-2 font-bold',
      md: 'px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm rounded-full gap-2 font-bold',
      lg: 'px-6 sm:px-7 py-3 sm:py-3.5 min-h-[48px] sm:min-h-[52px] text-sm sm:text-base rounded-full gap-2.5 font-extrabold tracking-wide',
      'icon-xs': 'w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0 shrink-0',
      'icon-sm': 'w-9 h-9 sm:w-10 sm:h-10 rounded-full p-0 shrink-0',
      'icon-md': 'w-10 h-10 sm:w-11 sm:h-11 rounded-full p-0 shrink-0',
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
