import React, { useState } from 'react';
import { Archive, CalendarX2, Check, CheckCircle2, Download, GraduationCap, Loader2, ShieldCheck, Users } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { formInputClass } from '../../../shared/components/form';
import { saveBackupToDownloads } from '../../../shared/utils/backup';
import { useNotes } from '../../notes/hooks/useNotes';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { startNewAcademicCycle, type NewCycleResult } from '../../subjects/services/academicCycleService';
import { useAppSettings } from '../hooks/useAppSettings';
import { M3Switch } from './SettingsPrimitives';

interface NewSemesterWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (result: NewCycleResult & { newSemesterName: string }) => void;
}

type WizardStep = 0 | 1 | 2;
const STEP_LABELS = ['Respaldo', 'Nombre', 'Opciones'] as const;

type BackupState = { status: 'idle' } | { status: 'saving' } | { status: 'done'; fileName: string } | { status: 'error'; message: string };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Fila de opción con interruptor M3: título, explicación y switch a la derecha. */
const OptionRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  locked?: boolean;
}> = ({ icon, title, description, checked, onChange, locked }) => (
  <div className="flex items-start gap-3 rounded-2xl bg-[var(--color-md-surface-container)] p-3">
    <span className="mt-0.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-bold text-[var(--color-md-on-surface)]">{title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-md-on-surface-variant)]">{description}</p>
    </div>
    <M3Switch checked={checked} onChange={(value) => onChange?.(value)} label={title} disabled={locked} />
  </div>
);

/**
 * Asistente de fin de semestre: 1) respaldo del semestre que termina, 2) nombre del nuevo,
 * 3) qué hacer con el horario y las materias. Apuntes, fotos, archivos y catedráticos nunca se
 * borran. Si no se descargó el respaldo en el paso 1, se descarga solo antes de aplicar nada.
 */
export const NewSemesterWizardModal: React.FC<NewSemesterWizardModalProps> = ({ isOpen, onClose, onCompleted }) => {
  const { settings, updateSettings } = useAppSettings();
  const { subjects } = useSubjects();
  const { slots } = useSchedule();
  const { notes } = useNotes();
  const { professors } = useProfessors();

  const [step, setStep] = useState<WizardStep>(0);
  const [backup, setBackup] = useState<BackupState>({ status: 'idle' });
  const [newName, setNewName] = useState('');
  const [clearSchedule, setClearSchedule] = useState(true);
  const [archiveSubjects, setArchiveSubjects] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentName = settings.semesterName;
  const trimmedName = newName.trim();
  const nameError = trimmedName && trimmedName === currentName ? 'Es el mismo nombre del semestre actual.' : null;
  const activeSubjects = subjects.filter((s) => !s.isArchived);

  const runBackup = async (): Promise<boolean> => {
    setBackup({ status: 'saving' });
    try {
      const { fileName } = await saveBackupToDownloads();
      setBackup({ status: 'done', fileName });
      return true;
    } catch (err) {
      setBackup({ status: 'error', message: err instanceof Error ? err.message : 'No se pudo guardar el respaldo.' });
      return false;
    }
  };

  const handleClose = () => {
    if (isApplying) return;
    onClose();
  };

  const handleStart = async () => {
    setIsApplying(true);
    setError(null);
    // Respaldo preventivo: sin copia guardada no se toca nada
    if (backup.status !== 'done' && !(await runBackup())) {
      setError('No se pudo guardar el respaldo, así que no se cambió nada. Inténtalo de nuevo.');
      setIsApplying(false);
      return;
    }
    try {
      const result = await startNewAcademicCycle({ finishedSemesterName: currentName, clearSchedule, archiveSubjects });
      updateSettings({ semesterName: trimmedName });
      onCompleted({ ...result, newSemesterName: trimmedName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el nuevo semestre. No se cambió nada.');
      setIsApplying(false);
    }
  };

  const canGoNext = step === 0 ? backup.status !== 'saving' : step === 1 ? trimmedName !== '' && !nameError : true;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Finalizar semestre" maxWidth="md">
      <div className="space-y-4">
        {/* Indicador de pasos */}
        <ol className="flex items-center gap-2" aria-label="Pasos del asistente">
          {STEP_LABELS.map((label, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5" aria-current={current ? 'step' : undefined}>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    done || current
                      ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                      : 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)]'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={`truncate text-[11px] font-semibold ${
                    current ? 'text-[var(--color-md-on-surface)]' : 'text-[var(--color-md-on-surface-variant)]'
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Paso 1: respaldo */}
        {step === 0 && (
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-[var(--color-md-on-surface)]">
                Antes de cerrar <strong>{currentName}</strong>, guarda una copia de seguridad con tus materias, horario,
                catedráticos, apuntes y fotos. Si no la descargas ahora, se descargará sola al final.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runBackup()}
              disabled={backup.status === 'saving'}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-md-primary-container)] px-4 text-sm font-bold text-[var(--color-md-on-primary-container)] transition-all duration-150 active:scale-[0.98] disabled:opacity-60"
            >
              {backup.status === 'saving' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {backup.status === 'done' ? 'Descargar otra copia' : 'Descargar copia de seguridad'}
            </button>
            <div aria-live="polite">
              {backup.status === 'done' && (
                <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">Respaldo guardado: {backup.fileName}</span>
                </p>
              )}
              {backup.status === 'error' && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {backup.message}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Paso 2: nombre del nuevo semestre */}
        {step === 1 && (
          <section className="space-y-2">
            <label htmlFor="new-semester-name" className="text-xs font-bold text-[var(--color-md-on-surface)]">
              Nombre del nuevo semestre
            </label>
            <input
              id="new-semester-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              placeholder="ej. Semestre 2026-II o Sexto Semestre"
              className={formInputClass}
              autoFocus
            />
            <p className={`text-[11px] ${nameError ? 'font-semibold text-red-700 dark:text-red-300' : 'text-[var(--color-md-on-surface-variant)]'}`}>
              {nameError ?? `Termina: ${currentName}. Aparecerá en tu credencial y en el horario.`}
            </p>
          </section>
        )}

        {/* Paso 3: opciones y resumen */}
        {step === 2 && (
          <section className="space-y-2.5">
            <OptionRow
              icon={<CalendarX2 className="h-4 w-4" />}
              title="Limpiar el horario semanal"
              description={`Quita ${plural(slots.length, 'clase', 'clases')} para inscribir las nuevas.`}
              checked={clearSchedule}
              onChange={setClearSchedule}
            />
            <OptionRow
              icon={<Archive className="h-4 w-4" />}
              title="Archivar las materias actuales"
              description={`${plural(activeSubjects.length, 'materia pasa', 'materias pasan')} al historial con todos sus apuntes y archivos.`}
              checked={archiveSubjects}
              onChange={setArchiveSubjects}
            />
            <OptionRow
              icon={<Users className="h-4 w-4" />}
              title="Conservar los catedráticos"
              description={`Tus ${plural(professors.length, 'contacto docente se queda', 'contactos docentes se quedan')} siempre en el directorio.`}
              checked
              locked
            />
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[var(--color-md-on-surface-variant)]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
              {plural(notes.length, 'apunte', 'apuntes')}, sus fotos y tus archivos no se borran.
              {backup.status !== 'done' && ' Antes de aplicar se descargará la copia de seguridad.'}
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        <ModalActions layout="between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step === 0 ? handleClose() : setStep((step - 1) as WizardStep))}
            disabled={isApplying}
          >
            {step === 0 ? 'Cancelar' : 'Atrás'}
          </Button>
          {step < 2 ? (
            <Button variant="primary" size="sm" onClick={() => setStep((step + 1) as WizardStep)} disabled={!canGoNext}>
              Siguiente
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<GraduationCap className="h-4 w-4" aria-hidden="true" />}
              isLoading={isApplying}
              onClick={() => void handleStart()}
            >
              Iniciar nuevo ciclo lectivo
            </Button>
          )}
        </ModalActions>
      </div>
    </Modal>
  );
};
