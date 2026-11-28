/**
 * Recuerda qué apunte estaba abierto en el editor. Si Android cierra la app en segundo plano (o se
 * cierra con el editor abierto), al volver a abrirla se reabre ese apunte en vez de quedar en el
 * inicio. Es solo un id: el contenido ya está en IndexedDB gracias al autoguardado.
 */
const OPEN_NOTE_KEY = 'agenda_open_note_id';

export function rememberOpenNote(noteId: string): void {
  try {
    localStorage.setItem(OPEN_NOTE_KEY, noteId);
  } catch {
    // Sin almacenamiento: solo no se reabrirá el apunte tras un cierre forzado
  }
}

export function forgetOpenNote(): void {
  try {
    localStorage.removeItem(OPEN_NOTE_KEY);
  } catch {
    // Igual que arriba
  }
}

export function readOpenNote(): string | null {
  try {
    return localStorage.getItem(OPEN_NOTE_KEY);
  } catch {
    return null;
  }
}
