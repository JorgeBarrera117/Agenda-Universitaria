import React, { useState } from 'react';
import { CalendarRange, Download } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { SegmentedControl, type SegmentedOption } from '../../../shared/components/form/SegmentedControl';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useSchedule } from '../hooks/useSchedule';
import type { AcademicImportSummary } from '../services/academicBundle';
import {
  importSchedulePackage,
  planScheduleImport,
  type ScheduleImportMode,
  type ScheduleSharePackage,
} from '../services/scheduleShareService';
import { ImportPlanSummary } from './ImportPlanSummary';

const MODE_OPTIONS: SegmentedOption<ScheduleImportMode>[] = [
  { value: 'merge', label: 'Fusionar' },
  { value: 'replace', label: 'Reemplazar' },
];

const MODE_HELP: Record<ScheduleImportMode, string> = {
  merge: 'Agrega las materias y clases a tu agenda actual, sin quitar nada. Las clases repetidas o que chocan se omiten.',
  replace:
    'Quita las clases de tu horario actual e instala las recibidas (ideal si son del mismo grupo y semestre). Tus materias, apuntes y archivos se conservan.',
};

interface ImportScheduleModalProps {
  /** Paquete ya validado y limpio por parseAgscheduleContent. */
  sharePackage: ScheduleSharePackage;
  onClose: () => void;
  onImported: (result: { summary: AcademicImportSummary; mode: ScheduleImportMode }) => void;
}

/**
 * Vista previa de un horario completo compartido (.agschedule): materias y número de clases, y
 * elección entre fusionarlo con la agenda actual o reemplazar el horario. El resumen muestra antes
 * de guardar qué se crea, qué se quita y qué clases se omiten.
 */
export const ImportScheduleModal: React.FC<ImportScheduleModalProps> = ({ sharePackage, onClose, onImported }) => {
  const { subjects } = useSubjects();
  const { professors } = useProfessors();
  const { slots } = useSchedule();
  const { settings, updateSettings } = useAppSettings();

  const [mode, setMode] = useState<ScheduleImportMode>('merge');
  // Por defecto el nombre del semestre se adopta al reemplazar; el estudiante puede cambiarlo
  const [semesterChoice, setSemesterChoice] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incomingSemester = sharePackage.semesterName;
  const canAdoptSemester = Boolean(incomingSemester && incomingSemester !== settings.semesterName);
  const adoptSemester = canAdoptSemester && (semesterChoice ?? mode === 'replace');

  // Vista previa: cálculo en memoria y barato, se rehace con cada cambio de datos o de modo
  const plan = planScheduleImport(sharePackage, { subjects, professors, slots }, mode);

  const classesPerSubject = sharePackage.subjects.map((_, index) => sharePackage.slots.filter((s) => s.subjectIndex === index).length);
  const sharedOn = new Date(sharePackage.exportedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const summary = await importSchedulePackage(sharePackage, mode);
      if (adoptSemester && incomingSemester) updateSettings({ semesterName: incomingSemester });
      onImported({ summary, mode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar el horario.');
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Horario compartido" maxWidth="md">
      <div className="space-y-4">
        {/* Encabezado y cifras */}
        <section className="space-y-3 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
              <CalendarRange className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-[var(--color-md-on-surface)]">{incomingSemester ?? 'Horario completo'}</h3>
              <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">Compartido el {sharedOn}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              { value: sharePackage.subjects.length, label: sharePackage.subjects.length === 1 ? 'materia' : 'materias' },
              { value: sharePackage.slots.length, label: sharePackage.slots.length === 1 ? 'clase' : 'clases' },
              { value: sharePackage.professors.length, label: sharePackage.professors.length === 1 ? 'catedrático' : 'catedráticos' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-[var(--color-md-surface)] px-1 py-2">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block text-lg font-black leading-none text-[var(--color-md-on-surface)]">{stat.value}</span>
                  <span className="text-[10px] font-semibold text-[var(--color-md-on-surface-variant)]">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Materias incluidas */}
        <ul className="max-h-40 space-y-1 overflow-y-auto pr-1" aria-label="Materias del horario">
          {sharePackage.subjects.map((subject, index) => (
            <li key={index} className="flex items-center gap-2 text-xs text-[var(--color-md-on-surface)]">
              <SubjectBadge icon={subject.icon} color={subject.color} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold">{subject.name}</span>
              <span className="shrink-0 text-[11px] text-[var(--color-md-on-surface-variant)]">
                {classesPerSubject[index]} {classesPerSubject[index] === 1 ? 'clase' : 'clases'}
              </span>
            </li>
          ))}
        </ul>

        {/* Modo */}
        <section className="space-y-2 border-t border-[var(--color-md-outline-variant)] pt-3">
          <SegmentedControl value={mode} onChange={setMode} options={MODE_OPTIONS} ariaLabel="Cómo importar el horario" />
          <p className="text-[11px] leading-relaxed text-[var(--color-md-on-surface-variant)]">{MODE_HELP[mode]}</p>
          <ImportPlanSummary plan={plan} />
          {canAdoptSemester && (
            <label className="flex cursor-pointer items-start gap-2 text-xs text-[var(--color-md-on-surface)]">
              <input
                type="checkbox"
                checked={adoptSemester}
                onChange={(e) => setSemesterChoice(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-md-primary)]"
              />
              <span>
                Cambiar el nombre del semestre a «{incomingSemester}»
                <span className="block text-[11px] text-[var(--color-md-on-surface-variant)]">Ahora: {settings.semesterName}</span>
              </span>
            </label>
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--color-md-outline-variant)] pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            variant={mode === 'replace' ? 'danger' : 'primary'}
            size="sm"
            icon={<Download className="h-4 w-4" aria-hidden="true" />}
            isLoading={isSaving}
            onClick={() => void handleSave()}
          >
            Importar horario
          </Button>
        </div>
      </div>
    </Modal>
  );
};
