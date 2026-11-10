import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, MessageSquareText, Save, Trash2, Wifi } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from '../../../shared/components/form';
import { STUDENT_STATUS_MAX_LENGTH, STUDENT_STATUS_PRESETS } from '../studentIdentity';
import { cropImageToSquareDataUrl } from '../utils/avatarCrop';
import { StudentAvatar } from './StudentAvatar';
import type { AppSettings, StudentStatusMode } from '../types';

export type ProfileFields = Pick<
  AppSettings,
  'studentName' | 'careerName' | 'semesterGoal' | 'studentAvatarUrl' | 'studentStatusMode' | 'studentCustomStatus'
>;

interface StudentProfileFormProps {
  initialValues: ProfileFields;
  onSave: (values: ProfileFields) => void;
}

const FIELD_LIMITS = { studentName: 60, careerName: 80, semesterGoal: 140 } as const;

const STATUS_MODE_OPTIONS: SegmentedOption<StudentStatusMode>[] = [
  { value: 'network', label: 'Conectividad', icon: <Wifi className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  { value: 'custom', label: 'Frase de estudio', icon: <MessageSquareText className="h-4 w-4 shrink-0" aria-hidden="true" /> },
];

const inputClassName =
  'w-full rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] px-3 py-2 text-sm text-[var(--color-md-on-surface)] placeholder:text-[var(--color-md-on-surface-variant)] transition-colors duration-150 focus:border-[var(--color-md-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-md-primary)]/30';

const secondaryButtonClass =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-md-outline)] px-3.5 text-xs font-bold text-[var(--color-md-primary)] transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-[0.98] disabled:opacity-50';

/**
 * Formulario del perfil estudiantil: foto, datos y estado de la barra superior. Los cambios son un
 * borrador hasta pulsar "Guardar perfil", y solo se guardan en este dispositivo.
 */
export const StudentProfileForm: React.FC<StudentProfileFormProps> = ({ initialValues, onSave }) => {
  const [studentName, setStudentName] = useState(initialValues.studentName ?? '');
  const [careerName, setCareerName] = useState(initialValues.careerName ?? '');
  const [semesterGoal, setSemesterGoal] = useState(initialValues.semesterGoal ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialValues.studentAvatarUrl);
  const [statusMode, setStatusMode] = useState<StudentStatusMode>(initialValues.studentStatusMode ?? 'network');
  const [customStatus, setCustomStatus] = useState(initialValues.studentCustomStatus ?? '');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permite volver a elegir el mismo archivo después
    event.target.value = '';
    if (!file) return;

    setPhotoError(null);
    setIsProcessingPhoto(true);
    try {
      setAvatarUrl(await cropImageToSquareDataUrl(file));
    } catch {
      setPhotoError('No se pudo leer esa imagen. Prueba con otra foto (JPG o PNG).');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Un campo vacío se guarda como undefined para volver al texto por defecto
    onSave({
      studentName: studentName.trim() || undefined,
      careerName: careerName.trim() || undefined,
      semesterGoal: semesterGoal.trim() || undefined,
      studentAvatarUrl: avatarUrl,
      studentStatusMode: statusMode,
      studentCustomStatus: customStatus.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-card-bg)] p-3 shadow-2xs sm:p-4"
    >
      {/* Foto de perfil */}
      <section aria-label="Foto de perfil" className="flex items-center gap-3">
        <div className="relative">
          <StudentAvatar
            avatarUrl={avatarUrl}
            name={studentName}
            className="h-[72px] w-[72px] rounded-2xl border border-[var(--color-md-outline-variant)] text-2xl shadow-xs"
          />
          {isProcessingPhoto && (
            <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--color-md-surface)]/70">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--color-md-primary)]" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-bold text-[var(--color-md-on-surface)]">Foto de perfil</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingPhoto}
              className={secondaryButtonClass}
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              {avatarUrl ? 'Cambiar foto' : 'Elegir foto de galería'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(undefined)}
                disabled={isProcessingPhoto}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-[var(--color-md-on-surface-variant)] transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--color-md-surface-container-high)] active:scale-[0.98]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Quitar foto
              </button>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-md-on-surface-variant)]" role={photoError ? 'alert' : undefined}>
            {photoError ?? 'Se recorta al centro y se guarda solo en este dispositivo.'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handlePhotoSelected(e)}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </section>

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

      {/* Estado junto a la fecha en la barra superior */}
      <section aria-label="Estado en la barra superior" className="space-y-2 border-t border-[var(--color-md-outline-variant)] pt-3">
        <div>
          <p className="text-xs font-bold text-[var(--color-md-on-surface)]">Estado en la barra superior</p>
          <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">
            Se muestra junto a la fecha. El punto de tu foto siempre indica si estás en línea.
          </p>
        </div>
        <SegmentedControl
          value={statusMode}
          onChange={setStatusMode}
          options={STATUS_MODE_OPTIONS}
          ariaLabel="Estado en la barra superior"
        />

        {statusMode === 'custom' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Frases rápidas">
              {STUDENT_STATUS_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = customStatus.trim().toLowerCase() === preset.text.toLowerCase();
                return (
                  <button
                    key={preset.text}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setCustomStatus(preset.text)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.98] ${
                      isSelected
                        ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                        : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-outline)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {preset.text}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1">
              <label htmlFor="profile-custom-status" className="text-xs font-bold text-[var(--color-md-on-surface)]">
                O escribe tu propia frase
              </label>
              <input
                id="profile-custom-status"
                type="text"
                maxLength={STUDENT_STATUS_MAX_LENGTH}
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="ej. Biblioteca hasta las 6"
                className={inputClassName}
              />
              <p className="flex justify-between gap-2 text-[11px] text-[var(--color-md-on-surface-variant)]">
                <span>{customStatus.trim() ? '' : 'Sin frase se mostrará la conectividad.'}</span>
                <span>
                  {customStatus.length}/{STUDENT_STATUS_MAX_LENGTH}
                </span>
              </p>
            </div>
          </div>
        )}
      </section>

      <button
        type="submit"
        disabled={isProcessingPhoto}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-md-primary)] px-4 text-xs font-bold text-[var(--color-md-on-primary)] transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-[0.98] disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" aria-hidden="true" />
        Guardar perfil
      </button>
    </form>
  );
};
