import React, { useState } from 'react';
import { Save } from 'lucide-react';
import type { AppSettings } from '../types';

type ProfileFields = Pick<AppSettings, 'studentName' | 'careerName' | 'semesterGoal'>;

interface StudentProfileFormProps {
  initialValues: ProfileFields;
  onSave: (values: ProfileFields) => void;
}

const FIELD_LIMITS = { studentName: 60, careerName: 80, semesterGoal: 140 } as const;

const inputClassName =
  'w-full rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] px-3 py-2 text-sm text-[var(--color-md-on-surface)] placeholder:text-[var(--color-md-on-surface-variant)] transition-colors duration-150 focus:border-[var(--color-md-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-md-primary)]/30';

/** Formulario del perfil estudiantil. Los datos solo se guardan en este dispositivo. */
export const StudentProfileForm: React.FC<StudentProfileFormProps> = ({ initialValues, onSave }) => {
  const [studentName, setStudentName] = useState(initialValues.studentName ?? '');
  const [careerName, setCareerName] = useState(initialValues.careerName ?? '');
  const [semesterGoal, setSemesterGoal] = useState(initialValues.semesterGoal ?? '');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Un campo vacío se guarda como undefined para volver al texto por defecto
    onSave({
      studentName: studentName.trim() || undefined,
      careerName: careerName.trim() || undefined,
      semesterGoal: semesterGoal.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] p-3 shadow-2xs sm:p-4"
    >
      <div className="space-y-1">
        <label htmlFor="profile-student-name" className="text-xs font-bold text-[var(--color-md-on-surface)]">
          Nombre
        </label>
        <input
          id="profile-student-name"
          type="text"
          autoComplete="name"
          maxLength={FIELD_LIMITS.studentName}
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="ej. Ana Martínez"
          className={inputClassName}
        />
        <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">
          Aparece en el saludo de la barra superior.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="profile-career" className="text-xs font-bold text-[var(--color-md-on-surface)]">
          Carrera o facultad
        </label>
        <input
          id="profile-career"
          type="text"
          maxLength={FIELD_LIMITS.careerName}
          value={careerName}
          onChange={(e) => setCareerName(e.target.value)}
          placeholder="ej. Ingeniería de Sistemas"
          className={inputClassName}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="profile-goal" className="text-xs font-bold text-[var(--color-md-on-surface)]">
          Meta del semestre
        </label>
        <textarea
          id="profile-goal"
          rows={2}
          maxLength={FIELD_LIMITS.semesterGoal}
          value={semesterGoal}
          onChange={(e) => setSemesterGoal(e.target.value)}
          placeholder="ej. Aprobar Cálculo con más de 4.0"
          className={`${inputClassName} resize-none`}
        />
        <p className="text-right text-[11px] text-[var(--color-md-on-surface-variant)]">
          {semesterGoal.length}/{FIELD_LIMITS.semesterGoal}
        </p>
      </div>

      <button
        type="submit"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-md-primary)] px-4 text-xs font-bold text-[var(--color-md-on-primary)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-[0.98]"
      >
        <Save className="h-3.5 w-3.5" aria-hidden="true" />
        Guardar perfil
      </button>
    </form>
  );
};
