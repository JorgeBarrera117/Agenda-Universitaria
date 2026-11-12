import {
  deliverSharedFile,
  parsePackageEnvelope,
  shareFileBaseName,
  sharePackageHeader,
  type SharePackageHeader,
  type SharedFileResult,
} from '../../../shared/utils/sharePackage';
import type { ProfessorShareData } from '../../professors/services/professorShareService';
import type { Professor } from '../../professors/types';
import {
  applyAcademicImport,
  buildAcademicBundle,
  parseAcademicBundle,
  planAcademicImport,
  type AcademicBundle,
  type AcademicImportOptions,
  type AcademicImportPlan,
  type AcademicImportSummary,
  type LocalAcademicState,
  type SharedSlotData,
  type SharedSubjectData,
} from '../../schedule/services/academicBundle';
import type { ScheduleSlot } from '../../schedule/types';
import type { Subject } from '../types';

/**
 * Formato .agclass (Agenda Class): una materia con sus bloques de horario y su docente, para que
 * un compañero la agregue a su agenda con un toque. Al importarlo se trata como contenido NO
 * confiable (ver parseAcademicBundle).
 */
export const AGCLASS_TYPE = 'single_subject';
export const AGCLASS_FORMAT_VERSION = 1;
export const AGCLASS_EXTENSION = '.agclass';
/** MIME propio: Android abre la agenda al tocar el archivo en WhatsApp (ver AndroidManifest). */
export const AGCLASS_MIME_TYPE = 'application/vnd.agenda-universitaria.class+json';

const MAX_PACKAGE_CHARS = 256 * 1024;
const LIMITS = { maxSubjects: 1, maxProfessors: 10, maxSlots: 40 } as const;

/** Lo que va en el archivo: la materia, sus clases y los docentes que estas mencionan. */
export interface SubjectSharePackage extends SharePackageHeader<typeof AGCLASS_TYPE> {
  subject: SharedSubjectData;
  professors: ProfessorShareData[];
  /** Clases de la materia (subjectIndex siempre 0). */
  slots: SharedSlotData[];
}

/** "<nombre_materia>.agclass" sin tildes, rutas ni caracteres raros. */
export function agclassFileName(subjectName: string): string {
  return `${shareFileBaseName(subjectName, 'materia')}${AGCLASS_EXTENSION}`;
}

export function buildSubjectSharePackage(
  subject: Subject,
  slots: readonly ScheduleSlot[],
  professors: readonly Professor[]
): SubjectSharePackage {
  const bundle = buildAcademicBundle([subject], slots, professors);
  return {
    ...sharePackageHeader(AGCLASS_TYPE, AGCLASS_FORMAT_VERSION),
    subject: bundle.subjects[0],
    professors: bundle.professors,
    slots: bundle.slots,
  };
}

/**
 * Comparte una materia como archivo .agclass. Recibe todas las clases y docentes locales: el
 * paquete toma solo los de esta materia. En Android abre la hoja de compartir; en la web descarga.
 */
export function exportSubjectToAgclass(
  subject: Subject,
  slots: readonly ScheduleSlot[],
  professors: readonly Professor[]
): Promise<SharedFileResult> {
  return deliverSharedFile(
    JSON.stringify(buildSubjectSharePackage(subject, slots, professors)),
    agclassFileName(subject.name),
    AGCLASS_MIME_TYPE
  );
}

const INVALID_AGCLASS_MESSAGE = 'El archivo no es una materia compartida de Agenda Universitaria.';

/** Valida y limpia el contenido de un .agclass (firma, versión, materia, docentes y clases). */
export function parseAgclassContent(rawJson: string): SubjectSharePackage {
  const { body, formatVersion, exportedAt, appVersion } = parsePackageEnvelope(rawJson, {
    type: AGCLASS_TYPE,
    currentVersion: AGCLASS_FORMAT_VERSION,
    maxChars: MAX_PACKAGE_CHARS,
    invalidMessage: INVALID_AGCLASS_MESSAGE,
    tooLargeMessage: 'La materia compartida es demasiado grande para importarla.',
    newerVersionMessage: 'Esta materia se creó con una versión más nueva de la app. Actualiza Agenda Universitaria para abrirla.',
  });

  // En el archivo la materia va sola; el validador común trabaja con listas
  const rawSlots = Array.isArray(body.slots)
    ? body.slots.map((slot: unknown) => (typeof slot === 'object' && slot !== null ? { ...slot, subjectIndex: 0 } : slot))
    : [];
  const bundle = parseAcademicBundle({ subjects: [body.subject], professors: body.professors, slots: rawSlots }, LIMITS);
  if (bundle.subjects.length !== 1) throw new Error(INVALID_AGCLASS_MESSAGE);

  return {
    app: 'agenda-universitaria',
    type: AGCLASS_TYPE,
    formatVersion,
    exportedAt,
    appVersion,
    subject: bundle.subjects[0],
    professors: bundle.professors,
    slots: bundle.slots,
  };
}

/**
 * Qué hacer con la materia recibida:
 * - create: agregarla como materia nueva.
 * - merge: fusionarla con una local: se agregan las clases que falten y se rellenan los datos vacíos.
 * - update: actualizar una local: toma los datos y las clases recibidos (se quitan sus clases anteriores).
 */
export type SubjectImportTarget = { kind: 'create' } | { kind: 'merge'; subjectId: string } | { kind: 'update'; subjectId: string };

function toBundle(sharePackage: SubjectSharePackage): AcademicBundle {
  return { subjects: [sharePackage.subject], professors: sharePackage.professors, slots: sharePackage.slots };
}

function toOptions(target: SubjectImportTarget): AcademicImportOptions {
  if (target.kind === 'create') return { subjectMode: 'merge', clearSlots: 'none', subjectTargets: [{ kind: 'create' }] };
  return {
    subjectMode: target.kind === 'update' ? 'replace' : 'merge',
    clearSlots: target.kind === 'update' ? 'target-subjects' : 'none',
    subjectTargets: [{ kind: 'existing', subjectId: target.subjectId }],
  };
}

/** Vista previa: qué se creará o cambiará y qué clases se omitirán (repetidas o que chocan). */
export function planSubjectImport(
  sharePackage: SubjectSharePackage,
  local: LocalAcademicState,
  target: SubjectImportTarget
): AcademicImportPlan {
  return planAcademicImport(toBundle(sharePackage), local, toOptions(target));
}

/** Importa la materia en una sola transacción. Devuelve el id de la materia resultante. */
export async function importSubjectPackage(
  sharePackage: SubjectSharePackage,
  target: SubjectImportTarget
): Promise<{ subjectId: string; summary: AcademicImportSummary }> {
  const { summary, subjectIds } = await applyAcademicImport(toBundle(sharePackage), toOptions(target));
  return { subjectId: subjectIds[0], summary };
}
