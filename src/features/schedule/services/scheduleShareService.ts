import {
  cleanLine,
  deliverSharedFile,
  parsePackageEnvelope,
  shareFileBaseName,
  sharePackageHeader,
  type SharePackageHeader,
  type SharedFileResult,
} from '../../../shared/utils/sharePackage';
import type { Professor } from '../../professors/types';
import type { Subject } from '../../subjects/types';
import type { ScheduleSlot } from '../types';
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
} from './academicBundle';
import { AGSCHEDULE_EXTENSION, AGSCHEDULE_FORMAT_VERSION, AGSCHEDULE_MIME_TYPE, AGSCHEDULE_TYPE } from './agscheduleFormat';

/**
 * Formato .agschedule (Agenda Schedule): el horario completo de un semestre (materias, docentes y
 * todos los bloques de clase) para pasarlo a compañeros del mismo grupo. Al importarlo se trata
 * como contenido NO confiable (ver parseAcademicBundle). Las constantes viven en agscheduleFormat.
 */
export { AGSCHEDULE_EXTENSION, AGSCHEDULE_FORMAT_VERSION, AGSCHEDULE_MIME_TYPE, AGSCHEDULE_TYPE };

const MAX_PACKAGE_CHARS = 1024 * 1024;
const LIMITS = { maxSubjects: 60, maxProfessors: 60, maxSlots: 300 } as const;

export interface ScheduleSharePackage extends SharePackageHeader<typeof AGSCHEDULE_TYPE>, AcademicBundle {
  semesterName?: string;
}

/** "Horario_<semestre>.agschedule" sin tildes, rutas ni caracteres raros. */
export function agscheduleFileName(semesterName: string): string {
  return `Horario_${shareFileBaseName(semesterName, 'semestre')}${AGSCHEDULE_EXTENSION}`;
}

/** Todas las materias con sus clases y todos los docentes (también los que no tienen materia). */
export function buildScheduleSharePackage(
  semesterName: string,
  subjects: readonly Subject[],
  slots: readonly ScheduleSlot[],
  professors: readonly Professor[]
): ScheduleSharePackage {
  return {
    ...sharePackageHeader(AGSCHEDULE_TYPE, AGSCHEDULE_FORMAT_VERSION),
    semesterName: semesterName.trim() || undefined,
    ...buildAcademicBundle(subjects, slots, professors, { includeAllProfessors: true }),
  };
}

/** Comparte el horario completo como .agschedule (hoja de compartir en Android, descarga en la web). */
export function exportScheduleToAgschedule(
  semesterName: string,
  subjects: readonly Subject[],
  slots: readonly ScheduleSlot[],
  professors: readonly Professor[]
): Promise<SharedFileResult> {
  return deliverSharedFile(
    JSON.stringify(buildScheduleSharePackage(semesterName, subjects, slots, professors)),
    agscheduleFileName(semesterName),
    AGSCHEDULE_MIME_TYPE
  );
}

const INVALID_AGSCHEDULE_MESSAGE = 'El archivo no es un horario compartido de Agenda Universitaria.';

/** Valida y limpia el contenido de un .agschedule. Debe traer al menos una materia. */
export function parseAgscheduleContent(rawJson: string): ScheduleSharePackage {
  const { body, formatVersion, exportedAt, appVersion } = parsePackageEnvelope(rawJson, {
    type: AGSCHEDULE_TYPE,
    currentVersion: AGSCHEDULE_FORMAT_VERSION,
    maxChars: MAX_PACKAGE_CHARS,
    invalidMessage: INVALID_AGSCHEDULE_MESSAGE,
    tooLargeMessage: 'El horario compartido es demasiado grande para importarlo.',
    newerVersionMessage: 'Este horario se creó con una versión más nueva de la app. Actualiza Agenda Universitaria para abrirlo.',
  });

  const bundle = parseAcademicBundle(body, LIMITS);
  if (bundle.subjects.length === 0) throw new Error(INVALID_AGSCHEDULE_MESSAGE);

  return {
    app: 'agenda-universitaria',
    type: AGSCHEDULE_TYPE,
    formatVersion,
    exportedAt,
    appVersion,
    semesterName: cleanLine(body.semesterName, 60),
    ...bundle,
  };
}

/**
 * - merge (Fusionar): agrega materias y clases a la agenda actual sin quitar nada. Las materias
 *   que ya existen se reutilizan y solo se rellenan sus datos vacíos.
 * - replace (Reemplazar): quita TODAS las clases del horario actual e instala las recibidas; las
 *   materias que ya existen toman los datos recibidos. Las materias en sí no se borran, porque
 *   borrarlas eliminaría también sus apuntes y archivos.
 */
export type ScheduleImportMode = 'merge' | 'replace';

function toBundle(sharePackage: ScheduleSharePackage): AcademicBundle {
  return { subjects: sharePackage.subjects, professors: sharePackage.professors, slots: sharePackage.slots };
}

function toOptions(mode: ScheduleImportMode): AcademicImportOptions {
  return mode === 'replace' ? { subjectMode: 'replace', clearSlots: 'all' } : { subjectMode: 'merge', clearSlots: 'none' };
}

/** Vista previa: materias nuevas o existentes, clases que se agregan, quitan u omiten. */
export function planScheduleImport(
  sharePackage: ScheduleSharePackage,
  local: LocalAcademicState,
  mode: ScheduleImportMode
): AcademicImportPlan {
  return planAcademicImport(toBundle(sharePackage), local, toOptions(mode));
}

/** Importa el horario en una sola transacción (si algo falla no queda nada a medias). */
export async function importSchedulePackage(
  sharePackage: ScheduleSharePackage,
  mode: ScheduleImportMode
): Promise<AcademicImportSummary> {
  const { summary } = await applyAcademicImport(toBundle(sharePackage), toOptions(mode));
  return summary;
}
