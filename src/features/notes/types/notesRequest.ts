/**
 * Pedido de otra pestaña a Apuntes. «compose»: abrir el editor de un apunte nuevo con la materia ya
 * elegida (botones «Tomar apunte»). «browse»: mostrar la lista filtrada por esa materia («Ver apuntes»).
 * El nonce hace que el mismo pedido dos veces seguidas se atienda las dos.
 */
export type NotesIntent = 'compose' | 'browse';

export interface NotesRequest {
  subjectId?: string;
  intent: NotesIntent;
  nonce: number;
}
