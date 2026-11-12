import React, { useState } from 'react';
import { Clock, Download, GraduationCap, MapPin, Video } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { SegmentedControl, type SegmentedOption } from '../../../shared/components/form/SegmentedControl';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { findProfessorByName } from '../../professors/services/professorShareService';
import { ImportPlanSummary } from '../../schedule/components/ImportPlanSummary';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { findMatchingLocalSubject, type AcademicImportSummary } from '../../schedule/services/academicBundle';
import { DAY_NAMES } from '../../schedule/types';
import { describeSlotLocation, isSlotVirtual } from '../../schedule/utils/slotModality';
import { useSubjects } from '../hooks/useSubjects';
import {
  importSubjectPackage,
  planSubjectImport,
  type SubjectImportTarget,
  type SubjectSharePackage,
} from '../services/subjectShareService';
import { SubjectBadge } from './SubjectIcon';

type ImportMode = 'merge' | 'update' | 'create';

const MODE_OPTIONS: SegmentedOption<ImportMode>[] = [
  { value: 'merge', label: 'Fusionar' },
  { value: 'update', label: 'Actualizar' },
  { value: 'create', label: 'Nueva' },
];

interface ImportSubjectModalProps {
  /** Paquete ya validado y limpio por parseAgclassContent. */
  sharePackage: SubjectSharePackage;
  onClose: () => void;
  onImported: (result: { subjectName: string; summary: AcademicImportSummary }) => void;
}

/**
 * Vista previa de una materia compartida (.agclass): datos, bloques de horario y docente. Si el
 * estudiante ya tiene la materia (por código o nombre) puede fusionarla, actualizarla o agregarla
 * como nueva; el resumen muestra antes de guardar qué clases se agregan, se quitan o chocan.
 */
export const ImportSubjectModal: React.FC<ImportSubjectModalProps> = ({ sharePackage, onClose, onImported }) => {
  const { subjects } = useSubjects();
  const { professors } = useProfessors();
  const { slots } = useSchedule();
  const { subject, slots: incomingSlots } = sharePackage;

  // Las materias llegan de IndexedDB después del primer render: el emparejamiento se deriva
  const match = findMatchingLocalSubject(subjects, subject);
  const [chosenMode, setChosenMode] = useState<ImportMode | null>(null);
  const mode: ImportMode = match ? (chosenMode ?? 'merge') : 'create';
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target: SubjectImportTarget = match && mode !== 'create' ? { kind: mode, subjectId: match.id } : { kind: 'create' };
  // Vista previa: cálculo en memoria y barato (unas decenas de clases), se rehace en cada render
  let plan: ReturnType<typeof planSubjectImport> | null = null;
  try {
    plan = planSubjectImport(sharePackage, { subjects, professors, slots }, target);
  } catch {
    plan = null;
  }

  const professor = subject.professorIndex === undefined ? undefined : sharePackage.professors[subject.professorIndex];
  const professorIsKnown = professor ? Boolean(findProfessorByName(professors, professor.name)) : false;

  const sharedOn = new Date(sharePackage.exportedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  const modeHelp: Record<ImportMode, string> = {
    merge: `Se agregan a «${match?.name ?? subject.name}» las clases que te falten y los datos que tengas vacíos. No se borra nada.`,
    update: `«${match?.name ?? subject.name}» toma los datos y el horario recibidos: se quitan sus clases actuales.`,
    create: 'Se agrega como una materia aparte, con sus clases.',
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { summary } = await importSubjectPackage(sharePackage, target);
      onImported({ subjectName: target.kind === 'create' ? subject.name : (match?.name ?? subject.name), summary });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar la materia.');
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Materia compartida" maxWidth="md">
      <div className="space-y-4">
        {/* Encabezado: ícono y color de la materia */}
        <section className="flex items-center gap-3 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-3">
          <SubjectBadge icon={subject.icon} color={subject.color} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-black text-[var(--color-md-on-surface)]">{subject.name}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[var(--color-md-on-surface-variant)]">
              {subject.code && (
                <span className="rounded bg-[var(--color-md-on-surface)] px-1.5 font-mono text-[10px] font-bold text-[var(--color-md-surface)]">
                  {subject.code}
                </span>
              )}
              {subject.credits !== undefined && <span>{subject.credits} créditos</span>}
              <span>Compartida el {sharedOn}</span>
            </p>
          </div>
        </section>

        {(professor || subject.classroomDefault) && (
          <ul className="space-y-1.5 text-xs text-[var(--color-md-on-surface)]">
            {professor && (
              <li className="flex items-start gap-2">
                <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                <span>
                  <strong>{professor.name}</strong>
                  <span className="text-[var(--color-md-on-surface-variant)]">
                    {professorIsKnown ? ' · ya está en tus catedráticos' : ' · se agregará a tus catedráticos'}
                  </span>
                </span>
              </li>
            )}
            {subject.classroomDefault && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                {subject.classroomDefault}
              </li>
            )}
          </ul>
        )}

        {/* Bloques de horario incluidos */}
        <section className="space-y-1.5">
          <p className="text-xs font-bold text-[var(--color-md-on-surface)]">
            Horario ({incomingSlots.length} {incomingSlots.length === 1 ? 'clase' : 'clases'})
          </p>
          {incomingSlots.length === 0 ? (
            <p className="text-xs italic text-[var(--color-md-on-surface-variant)]">La materia no trae clases en el horario.</p>
          ) : (
            <ul className="space-y-1">
              {incomingSlots.map((slot, index) => {
                const location = describeSlotLocation(slot);
                const virtual = isSlotVirtual(slot);
                return (
                  <li
                    key={index}
                    className="flex items-center gap-2 rounded-lg bg-[var(--color-md-surface-container)] px-2.5 py-1.5 text-xs text-[var(--color-md-on-surface)]"
                  >
                    {virtual ? (
                      <Video className="h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                    )}
                    <span className="font-semibold">
                      {DAY_NAMES[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}
                    </span>
                    <span className="min-w-0 truncate text-[var(--color-md-on-surface-variant)]">
                      {virtual ? `· Virtual${location ? ` (${location})` : ''}` : location ? `· ${location}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Qué hacer si ya la tiene */}
        <section className="space-y-2 border-t border-[var(--color-md-outline-variant)] pt-3">
          {match ? (
            <>
              <p className="text-xs font-bold text-[var(--color-md-on-surface)]">Ya tienes «{match.name}»</p>
              <SegmentedControl value={mode} onChange={setChosenMode} options={MODE_OPTIONS} ariaLabel="Qué hacer con la materia" />
              <p className="text-[11px] leading-relaxed text-[var(--color-md-on-surface-variant)]">{modeHelp[mode]}</p>
            </>
          ) : (
            <p className="text-xs text-[var(--color-md-on-surface-variant)]">No tienes esta materia: se agregará como nueva.</p>
          )}
          {plan && <ImportPlanSummary plan={plan} showSubjects={false} />}
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
            variant="primary"
            size="sm"
            icon={<Download className="h-4 w-4" aria-hidden="true" />}
            isLoading={isSaving}
            onClick={() => void handleSave()}
          >
            Importar materia
          </Button>
        </div>
      </div>
    </Modal>
  );
};
