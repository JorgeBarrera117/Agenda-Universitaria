import React, { useId, useState } from 'react';
import { ChevronDown, GraduationCap, PencilLine, ShieldCheck, Target } from 'lucide-react';
import type { AppSettings } from '../types';
import { StudentAvatar } from './StudentAvatar';

interface StudentCredentialProps {
  settings: AppSettings;
  appVersion: string;
  onEdit: () => void;
}

/**
 * Credencial digital del estudiante en la portada de Ajustes. Plegada muestra nombre, carrera y
 * semestre; desplegada añade la meta del semestre y el acceso para editar el perfil.
 */
export const StudentCredential: React.FC<StudentCredentialProps> = ({ settings, appVersion, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const name = settings.studentName?.trim();
  const career = settings.careerName?.trim();
  const goal = settings.semesterGoal?.trim();

  return (
    <section
      aria-label="Credencial estudiantil"
      className="md-card overflow-hidden rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] shadow-2xs"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        className="flex w-full items-center gap-3 p-2.5 text-left transition-all duration-150 ease-out active:scale-[0.98] sm:p-3"
      >
        <StudentAvatar
          avatarUrl={settings.studentAvatarUrl}
          name={name}
          className="h-11 w-11 rounded-2xl text-sm"
          fallback={
            <span className="flex h-full w-full items-center justify-center bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]">
              <GraduationCap className="h-5 w-5" />
            </span>
          }
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[var(--color-md-on-surface)]">
            {name || 'Tu credencial estudiantil'}
          </p>
          <p className="truncate text-[11px] font-medium text-[var(--color-md-on-surface-variant)]">
            {career || (name ? 'Añade tu carrera o facultad' : 'Toca para ver y personalizar tu perfil')}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-[var(--color-md-primary-container)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-md-on-primary-container)]">
              {settings.semesterName || 'Ciclo académico'}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-md-on-surface-variant)]">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Offline · v{appVersion}
            </span>
          </div>
        </div>

        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)] transition-transform duration-150 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <div
          id={detailsId}
          className="space-y-2.5 border-t border-[var(--color-md-outline-variant)] px-3 pb-3 pt-2.5"
        >
          <div className="flex items-start gap-2 rounded-xl bg-[var(--color-md-surface-container)] p-2.5">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">
                Meta del semestre
              </p>
              <p className="text-xs font-semibold text-[var(--color-md-on-surface)]">
                {goal || 'Aún no has definido una meta para este semestre.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--color-md-primary)] px-3.5 text-xs font-bold text-[var(--color-md-on-primary)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-[0.98]"
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            Editar perfil
          </button>
        </div>
      )}
    </section>
  );
};
