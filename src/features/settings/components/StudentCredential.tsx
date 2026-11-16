import React from 'react';
import { ChevronRight, GraduationCap, Pencil, Target } from 'lucide-react';
import type { AppSettings } from '../types';
import { StudentAvatar } from './StudentAvatar';

interface StudentCredentialProps {
  settings: AppSettings;
  /** Se conserva por compatibilidad; la versión se ve en "Acerca de la agenda". */
  appVersion?: string;
  onEdit: () => void;
}

/**
 * Tarjeta "Mi perfil" en la portada de Ajustes. Antes era una credencial plegable que muchos no
 * reconocían como editable: ahora es una tarjeta tonal M3 con la foto (y un lápiz encima), el nombre
 * y una invitación clara; tocarla abre el perfil directamente.
 */
export const StudentCredential: React.FC<StudentCredentialProps> = ({ settings, onEdit }) => {
  const name = settings.studentName?.trim();
  const career = settings.careerName?.trim();
  const goal = settings.semesterGoal?.trim();
  const hasProfile = Boolean(name || career || settings.studentAvatarUrl);

  return (
    <section aria-label="Mi perfil">
      <button
        type="button"
        onClick={onEdit}
        className="group flex w-full items-center gap-4 rounded-3xl bg-[var(--color-md-primary-container)] p-4 text-left text-[var(--color-md-on-primary-container)] shadow-2xs transition-[transform,box-shadow] duration-150 ease-out hover:shadow-xs active:scale-[0.98]"
      >
        <span className="relative shrink-0">
          <StudentAvatar
            avatarUrl={settings.studentAvatarUrl}
            name={name}
            className="h-16 w-16 rounded-2xl text-xl ring-2 ring-[var(--color-md-card-bg)]"
            fallback={
              <span className="flex h-full w-full items-center justify-center bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]">
                <GraduationCap className="h-7 w-7" />
              </span>
            }
          />
          {/* Lápiz sobre la foto: deja claro que se puede personalizar */}
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-xs ring-2 ring-[var(--color-md-primary-container)] transition-transform duration-150 group-hover:scale-110"
          >
            <Pencil className="h-3.5 w-3.5" />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-11px font-bold uppercase tracking-wider opacity-80">Mi perfil</span>
          <span className="block truncate text-base font-black">{name || 'Personaliza tu perfil'}</span>
          <span className="block truncate text-xs font-medium opacity-90">
            {career || (hasProfile ? 'Añade tu carrera o facultad' : 'Agrega tu foto, nombre y carrera')}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-[var(--color-md-card-bg)]/70 px-2 py-0.5 text-10px font-bold">
              {settings.semesterName || 'Ciclo académico'}
            </span>
            {goal && (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-10px font-semibold opacity-90">
                <Target className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{goal}</span>
              </span>
            )}
          </span>
        </span>

        <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 opacity-70 transition-transform duration-150 group-hover:translate-x-0.5" />
      </button>
    </section>
  );
};
