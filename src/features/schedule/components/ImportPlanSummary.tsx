import React from 'react';
import { AlertTriangle, BookPlus, CalendarMinus, CalendarPlus, CopyCheck, RefreshCw, UserPlus } from 'lucide-react';
import { describeSlotTime, summarizeImportPlan, type AcademicImportPlan } from '../services/academicBundle';

interface ImportPlanSummaryProps {
  plan: AcademicImportPlan;
  /** Mostrar las líneas de materias (en .agclass la materia ya se describe aparte). */
  showSubjects?: boolean;
}

interface LineProps {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: 'default' | 'warning';
}

const Line: React.FC<LineProps> = ({ icon, children, tone = 'default' }) => (
  <li
    className={`flex items-start gap-2 text-xs leading-relaxed ${
      tone === 'warning' ? 'font-semibold text-amber-900 dark:text-amber-200' : 'text-[var(--color-md-on-surface)]'
    }`}
  >
    <span className="mt-0.5 shrink-0" aria-hidden="true">
      {icon}
    </span>
    <span className="min-w-0">{children}</span>
  </li>
);

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Qué hará la importación, calculado con planAcademicImport antes de escribir nada: materias y
 * docentes nuevos, clases que se agregan o quitan, y clases omitidas (repetidas o que chocan).
 */
export const ImportPlanSummary: React.FC<ImportPlanSummaryProps> = ({ plan, showSubjects = true }) => {
  const summary = summarizeImportPlan(plan);
  const conflicts = plan.skipped.filter((s) => s.reason === 'conflict');
  const iconClass = 'h-3.5 w-3.5';

  return (
    <ul className="space-y-1.5 rounded-xl bg-[var(--color-md-surface-container)] p-3" aria-label="Resumen de la importación">
      {showSubjects && summary.createdSubjects > 0 && (
        <Line icon={<BookPlus className={iconClass} />}>{plural(summary.createdSubjects, 'materia nueva', 'materias nuevas')}</Line>
      )}
      {showSubjects && summary.updatedSubjects > 0 && (
        <Line icon={<RefreshCw className={iconClass} />}>
          {plural(summary.updatedSubjects, 'materia que ya tienes', 'materias que ya tienes')} (se reutiliza{summary.updatedSubjects === 1 ? '' : 'n'})
        </Line>
      )}
      {summary.createdProfessors > 0 && (
        <Line icon={<UserPlus className={iconClass} />}>
          {plural(summary.createdProfessors, 'catedrático nuevo', 'catedráticos nuevos')} en tus contactos
        </Line>
      )}
      {summary.removedSlots > 0 && (
        <Line icon={<CalendarMinus className={iconClass} />} tone="warning">
          Se quita{summary.removedSlots === 1 ? '' : 'n'} {plural(summary.removedSlots, 'clase', 'clases')} de tu horario actual
        </Line>
      )}
      <Line icon={<CalendarPlus className={iconClass} />}>
        {summary.addedSlots === 0 ? 'No se agrega ninguna clase' : `Se agrega${summary.addedSlots === 1 ? '' : 'n'} ${plural(summary.addedSlots, 'clase', 'clases')}`}
      </Line>
      {summary.duplicateSlots > 0 && (
        <Line icon={<CopyCheck className={iconClass} />}>
          {plural(summary.duplicateSlots, 'clase ya estaba', 'clases ya estaban')} en tu horario (se omite{summary.duplicateSlots === 1 ? '' : 'n'})
        </Line>
      )}
      {conflicts.length > 0 && (
        <Line icon={<AlertTriangle className={iconClass} />} tone="warning">
          {plural(conflicts.length, 'clase choca', 'clases chocan')} con tu horario y no se agrega{conflicts.length === 1 ? '' : 'n'}:
          <ul className="mt-1 space-y-0.5 font-normal">
            {conflicts.slice(0, 6).map((conflict, index) => (
              <li key={index}>
                {conflict.subjectName} · {describeSlotTime(conflict.slot)} → {conflict.conflictWith}
              </li>
            ))}
            {conflicts.length > 6 && <li>y {conflicts.length - 6} más</li>}
          </ul>
        </Line>
      )}
    </ul>
  );
};
