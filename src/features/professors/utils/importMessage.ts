/**
 * Aviso tras importar un contacto .agcontact. Va aparte del servicio para que App lo use sin
 * cargar el servicio (y la base de datos de catedráticos) en el arranque.
 */
export function professorImportedMessage(result: { name: string; linkedSubjects: number; createdSubjects: number }): string {
  const { name, linkedSubjects, createdSubjects } = result;
  if (linkedSubjects === 0) return `${name} se guardó en tus catedráticos.`;
  // Sin "vinculado/vinculada": el texto no debe suponer el género del docente
  const subjects = linkedSubjects === 1 ? '1 materia vinculada' : `${linkedSubjects} materias vinculadas`;
  const created = createdSubjects === 0 ? '' : createdSubjects === 1 ? ' (1 nueva)' : ` (${createdSubjects} nuevas)`;
  return `${name} se guardó con ${subjects}${created}.`;
}
