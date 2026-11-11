import { Capacitor } from '@capacitor/core';
import { APP_INFO } from '../../../shared/constants/appInfo';
import { db } from '../../../shared/db/AppDatabase';
import { WidgetBridge } from '../../../shared/plugins/widgetBridge';
import { comparableName } from '../../../shared/utils/comparableName';
import { blobToDataUrl } from '../../../shared/utils/dataUrl';
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
export const AGCONTACT_APP_ID = 'agenda-universitaria';
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
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 160;
const MAX_PHONE_LENGTH = 40;
const MAX_OFFICE_LENGTH = 120;
const MAX_NOTES_LENGTH = 2000;
const MAX_SUBJECTS = 20;
const MAX_SUBJECT_NAME_LENGTH = 100;

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

export interface ProfessorSharePackage {
  app: typeof AGCONTACT_APP_ID;
  type: typeof AGCONTACT_TYPE;
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
  professor: ProfessorShareData;
  /** Materias que imparte, por nombre: el receptor las empareja con las suyas. */
  subjectNames: string[];
}

export interface ProfessorExportResult {
  method: 'share' | 'download';
  fileName: string;
}

/** "Prof_<nombre>.agcontact" sin tildes, rutas ni caracteres raros. */
export function agcontactFileName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return `Prof_${base || 'docente'}${AGCONTACT_EXTENSION}`;
}

/** Paquete .agcontact de un docente: solo sus datos de contacto, nunca ids de la base local. */
export function buildProfessorSharePackage(professor: Professor, subjectNames: string[]): ProfessorSharePackage {
  const optional = (value?: string) => (value?.trim() ? value.trim() : undefined);
  return {
    app: AGCONTACT_APP_ID,
    type: AGCONTACT_TYPE,
    formatVersion: AGCONTACT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_INFO.version,
    professor: {
      name: professor.name.trim(),
      email: optional(professor.email),
      phone: optional(professor.phone),
      office: optional(professor.office),
      notes: optional(professor.notes),
      icon: professor.icon,
      color: professor.color,
    },
    subjectNames: [...new Set(subjectNames.map((n) => n.trim()).filter(Boolean))],
  };
}

/**
 * Comparte la ficha de un docente como archivo .agcontact. En Android abre la hoja de compartir
 * del sistema (WhatsApp, Telegram, Drive…); en la web o en PC descarga el archivo.
 */
export async function exportProfessorToAgcontact(
  professor: Professor,
  subjectNames: string[]
): Promise<ProfessorExportResult> {
  const content = JSON.stringify(buildProfessorSharePackage(professor, subjectNames));
  const fileName = agcontactFileName(professor.name);
  const blob = new Blob([content], { type: AGCONTACT_MIME_TYPE });

  if (Capacitor.isNativePlatform()) {
    await WidgetBridge.shareFile({ base64Data: await blobToDataUrl(blob), fileName, mimeType: AGCONTACT_MIME_TYPE });
    return { method: 'share', fileName };
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Se libera después: revocar en el mismo tick puede cancelar la descarga en algunos navegadores
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { method: 'download', fileName };
}

const INVALID_AGCONTACT_MESSAGE = 'El archivo no es un contacto compartido de Agenda Universitaria.';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Una línea de texto: sin caracteres de control, espacios colapsados y con límite de largo. */
function cleanLine(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return text || undefined;
}

/** Texto de varias líneas (asesorías): conserva los saltos, quita el resto de controles. */
function cleanMultiline(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
  return text || undefined;
}

/**
 * Valida y limpia el contenido de un .agcontact. Comprueba la firma (app y tipo) y la versión del
 * formato, descarta campos desconocidos y deja cada valor dentro de sus límites. El ícono solo se
 * acepta si existe en la app y el color solo como #RRGGBB.
 */
export function parseAgcontactContent(rawJson: string): ProfessorSharePackage {
  if (rawJson.length > MAX_PACKAGE_CHARS) {
    throw new Error('El contacto compartido es demasiado grande para importarlo.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(INVALID_AGCONTACT_MESSAGE);
  }

  if (!isRecord(parsed) || parsed.app !== AGCONTACT_APP_ID || parsed.type !== AGCONTACT_TYPE) {
    throw new Error(INVALID_AGCONTACT_MESSAGE);
  }
  const formatVersion = parsed.formatVersion;
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion) || formatVersion < 1) {
    throw new Error(INVALID_AGCONTACT_MESSAGE);
  }
  if (formatVersion > AGCONTACT_FORMAT_VERSION) {
    throw new Error('Este contacto se creó con una versión más nueva de la app. Actualiza Agenda Universitaria para abrirlo.');
  }

  const raw = parsed.professor;
  const name = isRecord(raw) ? cleanLine(raw.name, MAX_NAME_LENGTH) : undefined;
  if (!isRecord(raw) || !name) {
    throw new Error(INVALID_AGCONTACT_MESSAGE);
  }

  const icon = typeof raw.icon === 'string' && PROFESSOR_ICONS.some((option) => option.id === raw.icon) ? raw.icon : undefined;
  const color = typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : undefined;

  const subjectNames: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(parsed.subjectNames)) {
    for (const value of parsed.subjectNames) {
      const subjectName = cleanLine(value, MAX_SUBJECT_NAME_LENGTH);
      if (!subjectName || seen.has(comparableName(subjectName))) continue;
      seen.add(comparableName(subjectName));
      subjectNames.push(subjectName);
      if (subjectNames.length >= MAX_SUBJECTS) break;
    }
  }

  const exportedAt =
    typeof parsed.exportedAt === 'string' && !Number.isNaN(Date.parse(parsed.exportedAt))
      ? parsed.exportedAt
      : new Date().toISOString();

  return {
    app: AGCONTACT_APP_ID,
    type: AGCONTACT_TYPE,
    formatVersion,
    exportedAt,
    appVersion: cleanLine(parsed.appVersion, 20) ?? '',
    professor: {
      name,
      email: cleanLine(raw.email, MAX_EMAIL_LENGTH),
      phone: cleanLine(raw.phone, MAX_PHONE_LENGTH),
      office: cleanLine(raw.office, MAX_OFFICE_LENGTH),
      notes: cleanMultiline(raw.notes, MAX_NOTES_LENGTH),
      icon,
      color,
    },
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

    const { professor: data } = sharePackage;
    const professor = await professorRepository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      office: data.office,
      notes: data.notes,
      icon: data.icon,
      color: data.color,
      subjectIds: [...subjectIds],
    });
    return { professor, createdSubjects };
  });
}
