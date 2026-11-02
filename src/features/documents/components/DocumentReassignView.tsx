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
    <div className="w-full pb-10 space-y-4 animate-in fade-in duration-150">
      {/* 1. ENCABEZADO CANÓNICO M3 */}
      <div className="flex items-center gap-3 pb-3 border-b border-[#C2C7CE]/40 dark:border-[#42474E]/40">
        <button
          type="button"
          onClick={onCancel}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76]/50 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-black text-[#191C20] dark:text-[#E2E2E6] tracking-tight truncate">
            Reasignar Asignatura
          </h2>
          <p className="text-xs text-[#72777F] dark:text-[#8C9199] truncate">
            Modifica la materia asociada al archivo seleccionado.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* 2. TARJETA RESUMEN DEL ARCHIVO */}
      <div className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-2 shadow-2xs">
        <span className="text-[10px] font-mono font-black text-[#00639B] dark:text-[#92CCFF] uppercase tracking-wider block">
          Documento Actual
        </span>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#E2E7EF] dark:bg-[#272A2F] text-[#00639B] dark:text-[#92CCFF] shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] truncate">
              {doc.name}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-[#72777F] dark:text-[#8C9199] mt-0.5">
              <span>Materia actual:</span>
              <span className="font-semibold text-[#191C20] dark:text-[#E2E2E6]">
                {currentSubject?.name || 'Sin asignar'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SELECCIÓN DE NUEVA MATERIA */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-3 shadow-2xs">
          <span className="text-[10px] font-mono font-black text-[#00639B] dark:text-[#92CCFF] uppercase tracking-wider block">
            Nueva Asignatura
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
          <div className="pt-2 space-y-1.5">
            <span className="text-[10px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block">
              O elige directamente de tu plan de estudios:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 text-left transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#D0E4FF] dark:bg-[#004B76]/50 border-[#00639B] dark:border-[#92CCFF] shadow-2xs'
                        : 'bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 border-[#C2C7CE]/50 dark:border-[#42474E]/50 hover:bg-[#D0E4FF]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <SubjectBadge icon={subj.icon} color={subj.color} size="sm" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] truncate block">
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
                      <div className="w-5 h-5 rounded-full bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. BOTONES DE ACCIÓN */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-[#41474D] dark:text-[#C2C7CF] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSubmitting || !selectedSubject}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-extrabold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <FolderSync className="w-4 h-4 stroke-[2.4]" />
                <span>Confirmar Reasignación</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
