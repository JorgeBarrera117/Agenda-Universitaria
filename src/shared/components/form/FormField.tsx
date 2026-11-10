import React from 'react';

interface FormFieldProps {
  /** id del control que etiqueta; el input hijo debe usar el mismo id. */
  htmlFor: string;
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Etiqueta en Sentence case + control + texto de ayuda opcional. */
export const FormField: React.FC<FormFieldProps> = ({ htmlFor, label, required = false, hint, className = '', children }) => (
  <div className={`space-y-1.5 ${className}`}>
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-[var(--color-md-on-surface)]">
      {label}
      {required && (
        <span className="text-[var(--color-md-primary)]" aria-hidden="true">
          {' '}*
        </span>
      )}
    </label>
    {children}
    {hint && <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">{hint}</p>}
  </div>
);
