import type { AcademicImportSummary } from '../services/academicBundle';

/**
 * Avisos tras importar una materia (.agclass) o un horario (.agschedule). Van aparte de los
 * servicios para que App los use sin cargar la base de datos en el arranque.
 */
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function skippedNote(summary: AcademicImportSummary): string {
  return summary.conflictSlots > 0 ? ` (${plural(summary.conflictSlots, 'clase omitida', 'clases omitidas')} por choque)` : '';
}

export function subjectImportedMessage(subjectName: string, summary: AcademicImportSummary): string {
  const classes = summary.addedSlots === 0 ? 'sin clases nuevas' : `con ${plural(summary.addedSlots, 'clase nueva', 'clases nuevas')}`;
  return `«${subjectName}» se importó ${classes}${skippedNote(summary)}.`;
}

export function scheduleImportedMessage(summary: AcademicImportSummary, mode: 'merge' | 'replace'): string {
  const subjects = summary.createdSubjects > 0 ? `, ${plural(summary.createdSubjects, 'materia nueva', 'materias nuevas')}` : '';
  if (mode === 'replace') {
    return `Horario reemplazado: ${plural(summary.addedSlots, 'clase', 'clases')}${subjects}${skippedNote(summary)}.`;
  }
  if (summary.addedSlots === 0 && summary.createdSubjects === 0) {
    return `Horario importado: no había clases nuevas${skippedNote(summary)}.`;
  }
  return `Horario importado: ${plural(summary.addedSlots, 'clase nueva', 'clases nuevas')}${subjects}${skippedNote(summary)}.`;
}
