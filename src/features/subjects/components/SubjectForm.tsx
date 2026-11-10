import React, { useState, useMemo } from 'react';
import { Plus, X, UserX } from 'lucide-react';
import type { Subject, CreateSubjectDTO } from '../types';
import { SubjectIcon, SUBJECT_ICONS, SUBJECT_PRESET_COLORS } from './SubjectIcon';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { ProfessorAvatar, PROFESSOR_PRESET_COLORS } from '../../professors/components/ProfessorAvatar';
import { M3Select } from '../../../shared/components/M3Select';
import {
  FormSheet,
  FormSection,
  FormField,
  IdentityPicker,
  formInputClass,
} from '../../../shared/components/form';

interface SubjectFormProps {
  initialData?: Subject;
  onSubmit: (data: CreateSubjectDTO) => Promise<void>;
  onCancel: () => void;
}

// Mismo color por defecto que usa el formulario de docentes
const DEFAULT_PROFESSOR_COLOR = PROFESSOR_PRESET_COLORS[0];

export const SubjectForm: React.FC<SubjectFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const { professors, addProfessor } = useProfessors();

  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [color, setColor] = useState(initialData?.color || SUBJECT_PRESET_COLORS[0]);
  const [icon, setIcon] = useState(initialData?.icon || 'book');
  const [credits, setCredits] = useState<number | undefined>(initialData?.credits);
  const [classroomDefault, setClassroomDefault] = useState(initialData?.classroomDefault || '');
  const [professorId, setProfessorId] = useState<string>(initialData?.professorId || '');

  // Alta rápida de docente sin salir del formulario
  const [isCreatingProf, setIsCreatingProf] = useState(false);
  const [newProfName, setNewProfName] = useState('');
  const [newProfOffice, setNewProfOffice] = useState('');
  const [newProfEmail, setNewProfEmail] = useState('');
  const [isSavingProf, setIsSavingProf] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const professorOptions = useMemo(
    () => [
      {
        value: '',
        label: 'Sin docente asignado',
        icon: (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--color-md-surface-container)] text-[var(--color-md-on-surface-variant)]">
            <UserX className="h-3.5 w-3.5" />
          </span>
        ),
      },
      ...professors.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: p.office || p.email,
        color: p.color,
        icon: <ProfessorAvatar name={p.name} icon={p.icon} color={p.color} size="select" shape="squircle" />,
      })),
    ],
    [professors]
  );

  const resetQuickProfessor = () => {
    setIsCreatingProf(false);
    setNewProfName('');
    setNewProfOffice('');
    setNewProfEmail('');
  };

  const handleQuickCreateProfessor = async () => {
    if (!newProfName.trim()) return;
    try {
      setIsSavingProf(true);
      const created = await addProfessor({
        name: newProfName.trim(),
        office: newProfOffice.trim() || undefined,
        email: newProfEmail.trim() || undefined,
        subjectIds: [],
        icon: 'user',
        color: DEFAULT_PROFESSOR_COLOR,
      });
      setProfessorId(created.id);
      resetQuickProfessor();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar al docente.');
    } finally {
      setIsSavingProf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre de la asignatura es obligatorio.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        code: code.trim() || undefined,
        color,
        icon,
        credits: credits !== undefined && !isNaN(Number(credits)) ? Number(credits) : undefined,
        classroomDefault: classroomDefault.trim() || undefined,
        professorId: professorId || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormSheet
      title={initialData ? 'Editar asignatura' : 'Nueva asignatura'}
      subtitle={code.trim() ? `${code.trim()} · Plan curricular` : 'Plan de estudios del semestre'}
      onBack={onCancel}
      backLabel="Volver a materias"
      onSubmit={handleSubmit}
      submitLabel={initialData ? 'Actualizar' : 'Guardar'}
      isSubmitting={isSubmitting}
      error={error}
      onDismissError={() => setError(null)}
    >
      <FormSection>
        <IdentityPicker
          preview={
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-colors duration-150 sm:h-20 sm:w-20"
              style={{ backgroundColor: color }}
            >
              <SubjectIcon icon={icon} className="h-8 w-8 text-white sm:h-9 sm:w-9" />
            </div>
          }
          previewTitle={name.trim() || 'Nombre de la asignatura'}
          previewSubtitle={[code.trim(), credits ? `${credits} créditos` : ''].filter(Boolean).join(' · ') || undefined}
          colors={SUBJECT_PRESET_COLORS}
          color={color}
          onColorChange={setColor}
          icons={SUBJECT_ICONS}
          icon={icon}
          onIconChange={setIcon}
        />
      </FormSection>

      <FormSection title="Datos curriculares">
        <FormField htmlFor="subject-name" label="Nombre de la asignatura" required>
          <input
            id="subject-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Cálculo integral, Arquitectura de software"
            className={formInputClass}
            autoFocus={!initialData}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField htmlFor="subject-code" label="Código o sigla curricular">
            <input
              id="subject-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ej. INF-301"
              className={`${formInputClass} font-mono`}
            />
          </FormField>
          <FormField htmlFor="subject-credits" label="Créditos">
            <input
              id="subject-credits"
              type="number"
              inputMode="numeric"
              min="0"
              max="40"
              value={credits ?? ''}
              onChange={(e) => setCredits(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="ej. 6"
              className={formInputClass}
            />
          </FormField>
        </div>

        <FormField
          htmlFor="subject-classroom"
          label="Aula habitual o modalidad"
          hint="Se propone automáticamente al programar clases de esta materia."
        >
          <input
            id="subject-classroom"
            type="text"
            value={classroomDefault}
            onChange={(e) => setClassroomDefault(e.target.value)}
            placeholder="ej. Aula 204, Edificio de Cómputo o Zoom"
            className={formInputClass}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Docente titular"
        description="Se vinculará automáticamente al crear clases en el horario."
        action={
          <button
            type="button"
            onClick={() => (isCreatingProf ? resetQuickProfessor() : setIsCreatingProf(true))}
            aria-expanded={isCreatingProf}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold text-[var(--color-md-primary)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-95"
          >
            {isCreatingProf ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
            {isCreatingProf ? 'Cerrar' : 'Nuevo'}
          </button>
        }
      >
        {isCreatingProf ? (
          <div className="space-y-3 border-l-2 border-[var(--color-md-primary)] pl-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField htmlFor="quick-prof-name" label="Nombre del docente" required>
                <input
                  id="quick-prof-name"
                  type="text"
                  value={newProfName}
                  onChange={(e) => setNewProfName(e.target.value)}
                  placeholder="ej. Dra. Elena García"
                  className={formInputClass}
                />
              </FormField>
              <FormField htmlFor="quick-prof-email" label="Correo">
                <input
                  id="quick-prof-email"
                  type="email"
                  value={newProfEmail}
                  onChange={(e) => setNewProfEmail(e.target.value)}
                  placeholder="docente@universidad.edu"
                  className={formInputClass}
                />
              </FormField>
            </div>
            <FormField htmlFor="quick-prof-office" label="Cubículo u oficina">
              <input
                id="quick-prof-office"
                type="text"
                value={newProfOffice}
                onChange={(e) => setNewProfOffice(e.target.value)}
                placeholder="ej. Edificio C, cubículo 12"
                className={formInputClass}
              />
            </FormField>
            <button
              type="button"
              disabled={!newProfName.trim() || isSavingProf}
              onClick={handleQuickCreateProfessor}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-md-secondary-container)] px-4 text-xs font-bold text-[var(--color-md-on-secondary-container)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              {isSavingProf ? 'Guardando…' : 'Crear y asignar'}
            </button>
          </div>
        ) : (
          <M3Select
            value={professorId}
            onChange={(val) => setProfessorId(val)}
            options={professorOptions}
            placeholder="Sin docente asignado"
          />
        )}
      </FormSection>
    </FormSheet>
  );
};
