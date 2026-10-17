import React from 'react';

export type CardPadding = 'none' | 'compact' | 'normal' | 'relaxed';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  interactive?: boolean;
  accentColor?: string;
  className?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      padding = 'normal',
      interactive = false,
      accentColor,
      className = '',
      style,
      children,
      ...props
    },
    ref
  ) => {
    // Escala de padding para optimizar espacio al estilo Telegram (sin abultar ni recortar)
    const paddingStyles: Record<CardPadding, string> = {
      none: 'p-0',
      compact: 'p-2.5 sm:p-3.5',
      normal: 'p-3.5 sm:p-4.5',
      relaxed: 'p-4.5 sm:p-6',
    };

    // Estilos de interacción táctil y elevación Material Design 3
    const interactiveStyles = interactive
      ? 'hover:shadow-[0_4px_8px_3px_rgba(0,0,0,0.08),0_1px_3px_0_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer'
      : '';

    // Estilo de fondo con tinte cromático sutil si se especifica color de materia
    const cardStyle: React.CSSProperties = {
      ...(accentColor
        ? {
            background: `linear-gradient(145deg, ${accentColor}12 0%, ${accentColor}04 100%), var(--card-bg, #FAF8FD)`,
            borderColor: `${accentColor}30`,
          }
        : {}),
      ...style,
    };

    return (
      <div
        ref={ref}
        style={cardStyle}
        className={`rounded-[24px] sm:rounded-[28px] bg-[#FAF8FD] dark:bg-[#1E1A22] border border-[#C2C7CE]/35 dark:border-white/5 shadow-[0_1px_3px_1px_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.1)] transition-all duration-200 relative overflow-hidden text-[#191C20] dark:text-[#E2E2E6] ${paddingStyles[padding]} ${interactiveStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
