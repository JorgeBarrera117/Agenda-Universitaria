/**
 * Pedido de otra pestaña a Apuntes. «compose»: abrir el editor de un apunte nuevo con la materia ya
 * elegida (botones «Tomar apunte»). «browse»: mostrar la lista filtrada por esa materia («Ver apuntes»).
 * «resume»: reabrir en el editor el apunte `noteId` (el que quedó abierto si el sistema cerró la app).
 * El nonce hace que el mismo pedido dos veces seguidas se atienda las dos.
 */
export type NotesIntent = 'compose' | 'browse' | 'resume';

export interface NotesRequest {
  subjectId?: string;
  intent: NotesIntent;
  noteId?: string;
  nonce: number;
}
