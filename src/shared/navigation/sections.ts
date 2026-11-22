/**
 * Secciones y pestañas de la app.
 *
 * - Sección: cada vista que existe (Horario, Materias, Profesores, Apuntes, Archivos). El resto del
 *   código (fichas, accesos directos, gestos) sigue hablando de secciones, así que no cambia.
 * - Pestaña: lo que se ve en la barra. Materias agrupa Materias y Profesores; Biblioteca agrupa
 *   Apuntes y Archivos; Estudio es el modo estudio (Pomodoro). Dentro de una pestaña con dos secciones se cambia con el selector de arriba
 *   (SectionSwitcher). Menos pestañas = botones más grandes en el teléfono (Material 3 pide 3 a 5).
 */
export type SectionId = 'schedule' | 'agenda' | 'subjects' | 'professors' | 'notes' | 'documents' | 'study';

export type NavTabId = 'schedule' | 'agenda' | 'courses' | 'library' | 'study';

/** Orden de las secciones: el deslizamiento lateral las recorre en este orden. */
export const SECTION_ORDER: readonly SectionId[] = ['schedule', 'agenda', 'subjects', 'professors', 'notes', 'documents', 'study'];

export const NAV_TAB_OF: Record<SectionId, NavTabId> = {
  schedule: 'schedule',
  agenda: 'agenda',
  subjects: 'courses',
  professors: 'courses',
  notes: 'library',
  documents: 'library',
  study: 'study',
};

/** Secciones de cada pestaña; la primera es la que se abre la primera vez. */
export const NAV_TAB_SECTIONS: Record<NavTabId, readonly SectionId[]> = {
  schedule: ['schedule'],
  agenda: ['agenda'],
  courses: ['subjects', 'professors'],
  library: ['notes', 'documents'],
  study: ['study'],
};

export type LastSections = Record<NavTabId, SectionId>;

const LAST_SECTIONS_KEY = 'agenda_last_sections_v1';

const DEFAULT_LAST_SECTIONS: LastSections = { schedule: 'schedule', agenda: 'agenda', courses: 'subjects', library: 'notes', study: 'study' };

/** Sección que se vio por última vez en cada pestaña (al volver a la pestaña se abre esa). */
export function loadLastSections(): LastSections {
  try {
    const raw = localStorage.getItem(LAST_SECTIONS_KEY);
    if (!raw) return DEFAULT_LAST_SECTIONS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LAST_SECTIONS;
    const result: LastSections = { ...DEFAULT_LAST_SECTIONS };
    for (const tab of Object.keys(NAV_TAB_SECTIONS) as NavTabId[]) {
      const value = (parsed as Record<string, unknown>)[tab];
      if (typeof value === 'string' && (NAV_TAB_SECTIONS[tab] as readonly string[]).includes(value)) {
        result[tab] = value as SectionId;
      }
    }
    return result;
  } catch {
    return DEFAULT_LAST_SECTIONS;
  }
}

export function saveLastSections(sections: LastSections): void {
  try {
    localStorage.setItem(LAST_SECTIONS_KEY, JSON.stringify(sections));
  } catch {
    // Sin almacenamiento (modo privado): solo se pierde el recuerdo entre sesiones
  }
}
