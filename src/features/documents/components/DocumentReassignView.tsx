import React, { useState } from 'react';
import {
  ArrowLeft,
  FolderSync,
  Tag,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { SubjectDocumentItem } from '../../subjects/hooks/useSubjectDocuments';
import type { Subject } from '../../subjects/types';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';

export interface DocumentReassignViewProps {
  document: SubjectDocumentItem;
  currentSubject?: Subject;
  subjects: Subject[];
  onConfirmReassign: (docId: string, newSubjectId: string) => Promise<void>;
  onCancel: () => void;
}

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

  // Interceptar botón atrás físico en Android para volver
  useBackButton(
    () => {
      onCancel();
      return true;
    },
    BACK_PRIORITY.SUBVIEW,
    true
  );

  const subjectOptions: M3SelectOption[] = subjects.map((s) => ({
    value: s.id,
    label: s.name,
    sublabel: s.code || undefined,
    color: s.color,
  }));

  const selectedSubject = subjects.find((s) => s.id === targetSubjectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSubjectId) {
      setErrorMessage('Selecciona una materia.');
      return;
    }
    if (targetSubjectId === doc.subjectId) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirmReassign(doc.id, targetSubjectId);
    } catch (err: unknown) {
      if (err instanceof Error) setErrorMessage(err.message);
      else setErrorMessage('Error al reasignar la materia.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full pb-12 space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      {/* 1. ENCABEZADO CANÓNICO M3 (Touch target 44px) */}
      <div className="flex items-center gap-3.5 pb-3.5 border-b border-[#C2C7CE]/40 dark:border-[#42474E]/40">
        <button
          type="button"
          onClick={onCancel}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76]/50 flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 shadow-2xs"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-black text-[#191C20] dark:text-[#E2E2E6] tracking-tight truncate">
            Reasignar Asignatura
          </h2>
          <p className="text-xs sm:text-sm text-[#72777F] dark:text-[#8C9199] truncate mt-0.5">
            Modifica la materia asociada al archivo seleccionado.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-xs sm:text-sm text-red-700 dark:text-red-300 shadow-2xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span className="font-semibold flex-1">{errorMessage}</span>
        </div>
      )}

      {/* 2. TARJETA RESUMEN DEL ARCHIVO */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-2.5 shadow-2xs">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-[#00639B]/10 dark:bg-[#92CCFF]/15 text-[#00639B] dark:text-[#92CCFF] border border-[#00639B]/20 uppercase tracking-wider">
          Documento a reasignar
        </span>
        <div className="flex items-center gap-3.5 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-[#E2E7EF] dark:bg-[#272A2F] text-[#00639B] dark:text-[#92CCFF] flex items-center justify-center shrink-0 shadow-2xs">
            <Tag className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm sm:text-base font-bold text-[#191C20] dark:text-[#E2E2E6] truncate">
              {doc.name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-[#72777F] dark:text-[#8C9199] mt-0.5">
              <span>Materia actual:</span>
              <span className="font-bold text-[#191C20] dark:text-[#E2E2E6]">
                {currentSubject?.name || 'Sin asignar'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SELECCIÓN DE NUEVA MATERIA */}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-3.5 shadow-2xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-[#00639B]/10 dark:bg-[#92CCFF]/15 text-[#00639B] dark:text-[#92CCFF] border border-[#00639B]/20 uppercase tracking-wider">
            Nueva Materia
          </span>

          <M3Select
            value={targetSubjectId}
            onChange={(val) => {
              setTargetSubjectId(val);
              setErrorMessage(null);
            }}
            options={subjectOptions}
            placeholder="Selecciona la nueva materia..."
            required
          />

          {/* Tarjetas Visuales de Materias Disponibles */}
          <div className="pt-2 space-y-2">
            <span className="text-[10px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block">
              O toca directamente una materia:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {subjects.map((subj) => {
                const isSelected = subj.id === targetSubjectId;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => {
                      setTargetSubjectId(subj.id);
                      setErrorMessage(null);
                    }}
                    className={`min-h-[48px] p-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer select-none active:scale-[0.99] ${
                      isSelected
                        ? 'bg-[#D0E4FF] dark:bg-[#004B76]/50 border-[#00639B] dark:border-[#92CCFF] shadow-xs'
                        : 'bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border-[#C2C7CE]/50 dark:border-[#42474E]/50 hover:bg-[#D0E4FF]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <SubjectBadge icon={subj.icon} color={subj.color} size="sm" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] truncate block">
                          {subj.name}
                        </span>
                        {subj.code && (
                          <span className="text-[10px] font-mono text-[#72777F] dark:text-[#8C9199] truncate block">
                            {subj.code}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] flex items-center justify-center shrink-0 shadow-2xs">
                        <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. BOTONES DE ACCIÓN (Ergonomía Thumb Zone) */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-11 sm:h-12 px-6 rounded-full text-xs sm:text-sm font-bold text-[#41474D] dark:text-[#C2C7CF] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSubmitting || !selectedSubject}
            className="w-full sm:w-auto h-11 sm:h-12 px-8 rounded-full text-xs sm:text-sm font-extrabold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <FolderSync className="w-4.5 h-4.5 stroke-[2.4]" />
                <span>Confirmar Reasignación</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
