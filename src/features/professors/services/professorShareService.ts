import { shareText, type ShareOutcome } from '../../../shared/utils/shareText';
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
