import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Professor, CreateProfessorDTO } from '../types';
import { PROFESSOR_ICONS, PROFESSOR_PRESET_COLORS, renderProfessorGlyph } from './ProfessorAvatar';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import {
  FormSheet,
  FormSection,
  FormField,
  IdentityPicker,
  formInputClass,
} from '../../../shared/components/form';

interface ProfessorFormProps {
  initialData?: Professor;
  onSubmit: (data: CreateProfessorDTO) => Promise<void>;
  onCancel: () => void;
}

export const ProfessorForm: React.FC<ProfessorFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const { subjects } = useSubjects();

  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [office, setOffice] = useState(initialData?.office || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(initialData?.subjectIds || []);
  const [icon, setIcon] = useState(initialData?.icon || 'user');
  const [color, setColor] = useState(initialData?.color || PROFESSOR_PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del docente es obligatorio.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        office: office.trim() || undefined,
        notes: notes.trim() || undefined,
        subjectIds: selectedSubjectIds,
        icon,
        color,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormSheet
      title={initialData ? 'Editar docente' : 'Nuevo docente'}
      subtitle={name.trim() || 'Directorio docente y asesorías'}
      onBack={onCancel}
      backLabel="Volver al directorio docente"
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
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-black text-white shadow-sm transition-colors duration-150 sm:h-20 sm:w-20"
              style={{ backgroundColor: color }}
            >
              {renderProfessorGlyph(icon, name.trim() || 'Docente', 'h-8 w-8 sm:h-9 sm:w-9')}
            </div>
          }
          previewTitle={name.trim() || 'Nombre del docente'}
          previewSubtitle={office.trim() || undefined}
          colors={PROFESSOR_PRESET_COLORS}
          color={color}
          onColorChange={setColor}
          icons={PROFESSOR_ICONS}
          icon={icon}
          onIconChange={setIcon}
        />
      </FormSection>

      <FormSection title="Datos personales y grado">
        <FormField
          htmlFor="prof-name"
          label="Nombre completo"
          required
          hint="Incluye el grado si quieres verlo en el directorio (Dra., Ing., Mtro.)."
        >
          <input
            id="prof-name"
            type="text"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Dra. María Fernández"
            className={formInputClass}
            autoFocus={!initialData}
          />
        </FormField>
      </FormSection>

      <FormSection title="Canales de contacto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField htmlFor="prof-email" label="Correo electrónico">
            <input
              id="prof-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="docente@universidad.edu"
              className={formInputClass}
            />
          </FormField>
          <FormField htmlFor="prof-phone" label="Teléfono o WhatsApp">
            <input
              id="prof-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+52 55 1234 5678"
              className={`${formInputClass} font-mono`}
            />
          </FormField>
        </div>
        <FormField htmlFor="prof-office" label="Cubículo, oficina o sala virtual">
          <input
            id="prof-office"
            type="text"
            value={office}
            onChange={(e) => setOffice(e.target.value)}
            placeholder="ej. Edificio C, cubículo 204"
            className={formInputClass}
          />
        </FormField>
      </FormSection>

      <FormSection title="Cátedras asignadas" description="Toca las materias que imparte este docente.">
        {subjects.length === 0 ? (
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">
            Primero registra asignaturas en la pestaña Materias para vincularlas aquí.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((sub) => {
              const isSelected = selectedSubjectIds.includes(sub.id);
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => toggleSubject(sub.id)}
                  aria-pressed={isSelected}
                  className={`inline-flex min-h-[36px] max-w-full items-center gap-2 rounded-full border px-3 text-xs font-bold transition-all duration-150 ease-out active:scale-95 ${
                    isSelected
                      ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                      : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-outline)]'
                  }`}
                >
                  <SubjectBadge icon={sub.icon} color={sub.color} size="sm" />
                  <span className="truncate">{sub.name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </FormSection>

      <FormSection title="Asesorías y notas">
        <FormField htmlFor="prof-notes" label="Horario de asesoría o notas">
          <textarea
            id="prof-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ej. Viernes a las 11:00, previa cita por correo."
            className={`${formInputClass} resize-none`}
          />
        </FormField>
      </FormSection>
    </FormSheet>
  );
};
