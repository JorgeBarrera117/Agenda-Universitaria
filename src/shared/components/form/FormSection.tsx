import React from 'react';

interface FormSectionProps {
  title?: string;
  description?: string;
  /** Acción discreta alineada a la derecha del título (p. ej. "+ Nuevo"). */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Bloque semántico dentro de FormSheet: título en Sentence case, sin tarjeta propia. */
export const FormSection: React.FC<FormSectionProps> = ({ title, description, action, className = '', children }) => (
  <section className={`space-y-3 p-4 sm:p-5 ${className}`}>
    {(title || action) && (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <h3 className="text-sm font-bold text-[var(--color-md-on-surface)]">{title}</h3>}
          {description && (
            <p className="mt-0.5 text-xs text-[var(--color-md-on-surface-variant)]">{description}</p>
          )}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);
