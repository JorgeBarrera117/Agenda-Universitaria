import { db } from '../../../shared/db/AppDatabase';
import { comparableName } from '../../../shared/utils/comparableName';
import {
  cleanHexColor,
  cleanLine,
  cleanMultiline,
  deliverSharedFile,
  isRecord,
  parsePackageEnvelope,
  shareFileBaseName,
  sharePackageHeader,
  type SharePackageHeader,
  type SharedFileResult,
} from '../../../shared/utils/sharePackage';
import { shareText, type ShareOutcome } from '../../../shared/utils/shareText';
import { subjectRepository } from '../../subjects/repositories/subjectRepository';
import type { Subject } from '../../subjects/types';
import { PROFESSOR_ICONS } from '../components/ProfessorAvatar';
import { professorRepository } from '../repositories/professorRepository';
import type { Professor } from '../types';

/**
 * Ficha del docente en texto para WhatsApp: *negritas* y emojis (WhatsApp no admite íconos ni
 * HTML). Solo incluye los datos que existen, para no enviar líneas vacías.
 */
export function formatProfessorContact(professor: Professor, subjectNames: string[]): string {
  const clean = (value?: string) => value?.replace(/\s+/g, ' ').trim() ?? '';
  const lines = [`👨‍🏫 *${clean(professor.name) || 'Docente'}*`];

  const subjects = subjectNames.map(clean).filter(Boolean);
  if (subjects.length > 0) lines.push(`📚 *${subjects.length === 1 ? 'Materia' : 'Materias'}:* ${subjects.join(', ')}`);
  if (clean(professor.email)) lines.push(`✉️ *Correo:* ${clean(professor.email)}`);
  if (clean(professor.phone)) lines.push(`📞 *Teléfono:* ${clean(professor.phone)}`);
  if (clean(professor.office)) lines.push(`📍 *Cubículo:* ${clean(professor.office)}`);
  // Las notas pueden tener varias líneas (horarios de asesoría): se conservan los saltos
  const notes = professor.notes?.trim();
  if (notes) lines.push(`🕒 *Asesorías:* ${notes}`);

  lines.push('', '_Compartido desde Agenda Universitaria_');
  return lines.join('\n');
}

/**
 * Comparte el contacto de un docente (hoja nativa en Android, Web Share o portapapeles).
 * Devuelve 'copied' cuando se copió porque no había forma de abrir la hoja de compartir.
 */
export function shareProfessorContact(professor: Professor, subjectNames: string[]): Promise<ShareOutcome> {
  return shareText({
    title: `Contacto: ${professor.name}`,
    text: formatProfessorContact(professor, subjectNames),
  });
}

/* -------------------------------------------------------------------------------------------- */
/* Formato .agcontact                                                                            */
/* -------------------------------------------------------------------------------------------- */

/**
 * Formato .agcontact (Agenda Contact): la ficha de un docente en JSON para pasarla entre
 * estudiantes, igual que .agnote con los apuntes. Al importarlo se trata como contenido NO
 * confiable: se valida la cabecera y se limpia cada campo.
 */
export const AGCONTACT_TYPE = 'single_professor';
export const AGCONTACT_FORMAT_VERSION = 1;
export const AGCONTACT_EXTENSION = '.agcontact';
/**
 * MIME propio (no "*\/*"): WhatsApp y otras apps entregan el archivo como content:// sin nombre en
 * la ruta, así que Android solo puede abrir la agenda si el tipo identifica el formato.
 */
export const AGCONTACT_MIME_TYPE = 'application/vnd.agenda-universitaria.contact+json';

/** Límites: un archivo ajeno no debe poder llenar la base de datos ni romper la interfaz. */
const MAX_PACKAGE_CHARS = 256 * 1024;
const MAX_SUBJECTS = 20;
const MAX_SUBJECT_NAME_LENGTH = 100;

/** Datos de contacto de un docente tal como viajan en .agcontact, .agclass y .agschedule. */
export interface ProfessorShareData {
  name: string;
  email?: string;
  phone?: string;
  office?: string;
  /** Horarios de asesoría u otras notas (se conservan los saltos de línea). */
  notes?: string;
  /** Uno de PROFESSOR_ICONS. */
  icon?: string;
  /** Color #RRGGBB del avatar. */
  color?: string;
}

export interface ProfessorSharePackage extends SharePackageHeader<typeof AGCONTACT_TYPE> {
  professor: ProfessorShareData;
  /** Materias que imparte, por nombre: el receptor las empareja con las suyas. */
  subjectNames: string[];
}

/** "Prof_<nombre>.agcontact" sin tildes, rutas ni caracteres raros. */
export function agcontactFileName(name: string): string {
  return `Prof_${shareFileBaseName(name, 'docente')}${AGCONTACT_EXTENSION}`;
}

/** Solo los datos de contacto del docente: nunca ids de la base local. */
export function toProfessorShareData(professor: Professor): ProfessorShareData {
  const optional = (value?: string) => (value?.trim() ? value.trim() : undefined);
  return {
    name: professor.name.trim(),
    email: optional(professor.email),
    phone: optional(professor.phone),
    office: optional(professor.office),
    notes: optional(professor.notes),
    icon: professor.icon,
    color: professor.color,
  };
}

/**
 * Valida y limpia los datos de un docente recibido. Devuelve undefined si no tiene nombre.
 * El ícono solo se acepta si existe en la app y el color solo como #RRGGBB.
 */
export function cleanProfessorShareData(raw: unknown): ProfessorShareData | undefined {
  if (!isRecord(raw)) return undefined;
  const name = cleanLine(raw.name, 120);
  if (!name) return undefined;
  const icon = typeof raw.icon === 'string' && PROFESSOR_ICONS.some((option) => option.id === raw.icon) ? raw.icon : undefined;
  return {
    name,
    email: cleanLine(raw.email, 160),
    phone: cleanLine(raw.phone, 40),
    office: cleanLine(raw.office, 120),
    notes: cleanMultiline(raw.notes, 2000),
    icon,
    color: cleanHexColor(raw.color),
  };
}

export function buildProfessorSharePackage(professor: Professor, subjectNames: string[]): ProfessorSharePackage {
  return {
    ...sharePackageHeader(AGCONTACT_TYPE, AGCONTACT_FORMAT_VERSION),
    professor: toProfessorShareData(professor),
    subjectNames: [...new Set(subjectNames.map((n) => n.trim()).filter(Boolean))],
  };
}

/**
 * Comparte la ficha de un docente como archivo .agcontact. En Android abre la hoja de compartir
 * del sistema (WhatsApp, Telegram, Drive…); en la web o en PC descarga el archivo.
 */
export function exportProfessorToAgcontact(professor: Professor, subjectNames: string[]): Promise<SharedFileResult> {
  return deliverSharedFile(
    JSON.stringify(buildProfessorSharePackage(professor, subjectNames)),
    agcontactFileName(professor.name),
    AGCONTACT_MIME_TYPE
  );
}

const INVALID_AGCONTACT_MESSAGE = 'El archivo no es un contacto compartido de Agenda Universitaria.';

/**
 * Valida y limpia el contenido de un .agcontact. Comprueba la firma (app y tipo) y la versión del
 * formato, descarta campos desconocidos y deja cada valor dentro de sus límites.
 */
export function parseAgcontactContent(rawJson: string): ProfessorSharePackage {
  const { body, formatVersion, exportedAt, appVersion } = parsePackageEnvelope(rawJson, {
    type: AGCONTACT_TYPE,
    currentVersion: AGCONTACT_FORMAT_VERSION,
    maxChars: MAX_PACKAGE_CHARS,
    invalidMessage: INVALID_AGCONTACT_MESSAGE,
    tooLargeMessage: 'El contacto compartido es demasiado grande para importarlo.',
    newerVersionMessage: 'Este contacto se creó con una versión más nueva de la app. Actualiza Agenda Universitaria para abrirlo.',
  });

  const professor = cleanProfessorShareData(body.professor);
  if (!professor) throw new Error(INVALID_AGCONTACT_MESSAGE);

  const subjectNames: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(body.subjectNames)) {
    for (const value of body.subjectNames) {
      const subjectName = cleanLine(value, MAX_SUBJECT_NAME_LENGTH);
      if (!subjectName || seen.has(comparableName(subjectName))) continue;
      seen.add(comparableName(subjectName));
      subjectNames.push(subjectName);
      if (subjectNames.length >= MAX_SUBJECTS) break;
    }
  }

  return {
    app: 'agenda-universitaria',
    type: AGCONTACT_TYPE,
    formatVersion,
    exportedAt,
    appVersion,
    professor,
    subjectNames,
  };
}

/** Materia local con el mismo nombre (sin distinguir tildes, mayúsculas ni espacios). */
export function findSubjectByName<T extends Pick<Subject, 'name'>>(subjects: readonly T[], name: string): T | undefined {
  const target = comparableName(name);
  return subjects.find((subject) => comparableName(subject.name) === target);
}

/** Docente local con el mismo nombre, para avisar antes de guardar un duplicado. */
export function findProfessorByName<T extends Pick<Professor, 'name'>>(professors: readonly T[], name: string): T | undefined {
  const target = comparableName(name);
  return professors.find((professor) => comparableName(professor.name) === target);
}

/** Qué hacer con cada materia: vincular una local o crear una nueva con ese nombre. */
export type AgcontactSubjectLink =
  | { kind: 'existing'; subjectId: string }
  | { kind: 'create'; name: string; color: string };

/**
 * Guarda el docente compartido: crea las materias que falten y el docente vinculado a todas, en una
 * sola transacción (si algo falla no queda nada a medias). El paquete ya viene validado por
 * parseAgcontactContent.
 */
export async function importProfessorPackage(
  sharePackage: ProfessorSharePackage,
  links: AgcontactSubjectLink[]
): Promise<{ professor: Professor; createdSubjects: number }> {
  // subjects y professors: las transacciones anidadas de los repositorios usan ambas tablas
  return db.transaction('rw', [db.subjects, db.professors], async () => {
    const subjectIds = new Set<string>();
    let createdSubjects = 0;

    for (const link of links) {
      if (link.kind === 'existing') {
        if (!(await subjectRepository.getById(link.subjectId))) {
          throw new Error('Una de las materias elegidas ya no existe.');
        }
        subjectIds.add(link.subjectId);
      } else {
        const subject = await subjectRepository.create({
          name: link.name.trim().slice(0, MAX_SUBJECT_NAME_LENGTH) || 'Materia compartida',
          color: link.color,
        });
        subjectIds.add(subject.id);
        createdSubjects += 1;
      }
    }

    const professor = await professorRepository.create({ ...sharePackage.professor, subjectIds: [...subjectIds] });
    return { professor, createdSubjects };
  });
}
