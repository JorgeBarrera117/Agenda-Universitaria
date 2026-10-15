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
    // Escala de padding para optimizar espacio y evitar desperdicio de pantalla
    const paddingStyles: Record<CardPadding, string> = {
      none: 'p-0',
      compact: 'p-3 sm:p-4',
      normal: 'p-4 sm:p-5',
      relaxed: 'p-5 sm:p-6',
    };

    // Estilos de interacción táctil y elevación
    const interactiveStyles = interactive
      ? 'hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer'
      : '';

    // Estilo de fondo con tinte cromático sutil si se especifica color de materia
    const cardStyle: React.CSSProperties = {
      ...(accentColor
        ? {
            background: `linear-gradient(145deg, ${accentColor}18 0%, ${accentColor}08 100%), var(--card-bg, #ffffff)`,
            borderColor: `${accentColor}38`,
          }
        : {}),
      ...style,
    };

    return (
      <div
        ref={ref}
        style={cardStyle}
        className={`rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs transition-all duration-200 relative overflow-hidden ${paddingStyles[padding]} ${interactiveStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
