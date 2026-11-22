import React, { useState } from 'react';
import { ArrowRight, Check, FileText, Link as LinkIcon } from 'lucide-react';
import type { SubjectDocumentItem } from '../../subjects/hooks/useSubjectDocuments';
import type { Subject } from '../../subjects/types';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { FormSheet } from '../../../shared/components/form/FormSheet';
import { FormSection } from '../../../shared/components/form/FormSection';
import { DetailChip, DetailHero, DetailIconTile } from '../../../shared/components/detail/DetailKit';
import { BACK_PRIORITY } from '../../../shared/hooks/useBackButton';

export interface DocumentReassignViewProps {
  document: SubjectDocumentItem;
  currentSubject?: Subject;
  subjects: Subject[];
  onConfirmReassign: (docId: string, newSubjectId: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Mover un archivo a otra materia, con la misma hoja que los formularios: arriba la vista previa
 * (el archivo con el color de la materia elegida) y debajo las materias para tocar una.
 */
export const DocumentReassignView: React.FC<DocumentReassignViewProps> = ({
  document: doc,
  currentSubject,
  subjects,
  onConfirmReassign,
  onCancel,
}) => {
  const [targetSubjectId, setTargetSubjectId] = useState<string>(doc.subjectId || subjects[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedSubject = subjects.find((s) => s.id === targetSubjectId);
  const unchanged = targetSubjectId === doc.subjectId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSubjectId) {
      setErrorMessage('Elige una materia.');
      return;
    }
    if (unchanged) {
      onCancel();
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirmReassign(doc.id, targetSubjectId);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo cambiar la materia.');
      setIsSubmitting(false);
    }
  };

  const tileColor = selectedSubject?.color ?? '#5E6B7A';

  return (
    <FormSheet
      title="Cambiar de materia"
      subtitle={doc.isExternalLink ? 'Enlace' : 'Archivo'}
      onBack={onCancel}
      backLabel="Volver a la ficha"
      onSubmit={(e) => void handleSubmit(e)}
      submitLabel="Mover"
      isSubmitting={isSubmitting}
      submitDisabled={!selectedSubject || unchanged}
      error={errorMessage}
      onDismissError={() => setErrorMessage(null)}
      backPriority={BACK_PRIORITY.SUBVIEW}
      preview={
        <DetailHero
          compact
          color={selectedSubject?.color}
          leading={
            <DetailIconTile color={tileColor} size="md">
              {doc.isExternalLink ? <LinkIcon className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            </DetailIconTile>
          }
          kicker={
            <span className="inline-flex items-center gap-1">
              {currentSubject?.name ?? 'Sin materia'}
              {!unchanged && selectedSubject && (
                <>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  {selectedSubject.name}
                </>
              )}
            </span>
          }
          title={doc.name}
          chips={unchanged ? <DetailChip>Elige la nueva materia</DetailChip> : <DetailChip tone="tonal">Se moverá al tocar «Mover»</DetailChip>}
        />
      }
    >
      <FormSection title="Materias" description="Toca la materia a la que quieres moverlo.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Materia">
          {subjects.map((subj) => {
            const isSelected = subj.id === targetSubjectId;
            const isCurrent = subj.id === doc.subjectId;
            return (
              <button
                key={subj.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  setTargetSubjectId(subj.id);
                  setErrorMessage(null);
                }}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border p-3 text-left transition-[background-color,border-color,transform] active:scale-[0.99] ${
                  isSelected
                    ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                    : 'border-[var(--color-md-outline-variant)] hover:bg-[var(--color-md-surface-container)]'
                }`}
              >
                <SubjectBadge icon={subj.icon} color={subj.color} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{subj.name}</span>
                  <span className="block truncate text-xs opacity-75">
                    {isCurrent ? 'Materia actual' : subj.code || ' '}
                  </span>
                </span>
                {isSelected && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]">
                    <Check className="h-4 w-4 stroke-[2.8]" aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </FormSection>
    </FormSheet>
  );
};
