import React from 'react';
import { CARD_INTERACTIVE_CLASS, CARD_SURFACE_CLASS } from '../../styles/surfaces';

export type CardPadding = 'none' | 'compact' | 'normal' | 'relaxed';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  interactive?: boolean;
  /**
   * Color propio del elemento (materia, docente): la tarjeta toma una variante clara de ese color
   * en modo claro y una oscura en modo oscuro, sobre el acabado elegido (ver .card-tinted en index.css).
   */
  tint?: string;
  className?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      padding = 'normal',
      interactive = false,
      tint,
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

    // Elevación al pasar el cursor y respuesta táctil al presionar. El cursor de mano solo
    // aparece si la tarjeta entera es clicable, para no prometer una acción que no existe.
    const interactiveStyles = interactive
      ? `${CARD_INTERACTIVE_CLASS} ${props.onClick ? 'cursor-pointer' : ''}`
      : '';

    return (
      <div
        ref={ref}
        style={tint ? ({ ...style, '--card-tint': tint } as React.CSSProperties) : style}
        className={`${CARD_SURFACE_CLASS} ${tint ? 'card-tinted' : ''} ${paddingStyles[padding]} ${interactiveStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
