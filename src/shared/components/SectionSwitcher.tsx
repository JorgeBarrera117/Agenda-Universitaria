import React, { useState } from 'react';
import { BookOpen, FileText, FolderKanban, Info, Users } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from './form/SegmentedControl';
import { NAV_TAB_OF, NAV_TAB_SECTIONS, type NavTabId, type SectionId } from '../navigation/sections';

interface SectionSwitcherProps {
  activeSection: SectionId;
  onChange: (section: SectionId) => void;
  counts: Partial<Record<SectionId, number>>;
}

const SECTION_LABEL: Record<SectionId, string> = {
  schedule: 'Horario',
  subjects: 'Materias',
  professors: 'Profesores',
  notes: 'Apuntes',
  documents: 'Archivos',
};

const SECTION_ICON: Partial<Record<SectionId, React.ReactNode>> = {
  subjects: <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />,
  professors: <Users className="h-4 w-4 shrink-0" aria-hidden="true" />,
  notes: <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />,
  documents: <FolderKanban className="h-4 w-4 shrink-0" aria-hidden="true" />,
};

/** Aviso de una sola vez para quien buscaba la pestaña de antes. */
const MOVED_HINT: Partial<Record<NavTabId, string>> = {
  courses: 'Profesores ahora vive aquí, junto a sus materias. Cambia con el selector de arriba.',
  library: 'Apuntes y Archivos ahora están juntos en Biblioteca. No se perdió nada.',
};

const hintKey = (tab: NavTabId) => `agenda_moved_hint_seen_${tab}`;

function hintSeen(tab: NavTabId): boolean {
  try {
    return localStorage.getItem(hintKey(tab)) === '1';
  } catch {
    return true;
  }
}

/**
 * Selector de las pestañas que agrupan dos secciones (Materias | Profesores, Apuntes | Archivos).
 * Usa el mismo botón segmentado M3 que el resto de la app. No se muestra en Horario.
 */
export const SectionSwitcher: React.FC<SectionSwitcherProps> = ({ activeSection, onChange, counts }) => {
  const tab = NAV_TAB_OF[activeSection];
  const sections = NAV_TAB_SECTIONS[tab];
  const [dismissed, setDismissed] = useState<Partial<Record<NavTabId, boolean>>>({});

  if (sections.length < 2) return null;

  const options: SegmentedOption<SectionId>[] = sections.map((section) => {
    const count = counts[section];
    const label = typeof count === 'number' ? `${SECTION_LABEL[section]} (${count})` : SECTION_LABEL[section];
    return { value: section, label, icon: SECTION_ICON[section] };
  });

  const hint = MOVED_HINT[tab];
  const showHint = Boolean(hint) && !dismissed[tab] && !hintSeen(tab);
  const closeHint = () => {
    try {
      localStorage.setItem(hintKey(tab), '1');
    } catch {
      // Sin almacenamiento: se oculta solo en esta sesión
    }
    setDismissed((prev) => ({ ...prev, [tab]: true }));
  };

  return (
    <div className="mb-3 flex flex-col gap-2.5">
      <SegmentedControl
        value={activeSection}
        onChange={onChange}
        options={options}
        ariaLabel={tab === 'courses' ? 'Ver materias o profesores' : 'Ver apuntes o archivos'}
        className="md-card w-full sm:max-w-md"
      />
      {showHint && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl bg-[var(--color-md-primary-container)] py-2.5 pl-3.5 pr-2 text-[var(--color-md-on-primary-container)] sm:max-w-md"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-13px leading-snug">{hint}</span>
          <button
            type="button"
            onClick={closeHint}
            className="h-9 shrink-0 rounded-full px-3 text-13px font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10"
          >
            Entendido
          </button>
        </div>
      )}
    </div>
  );
};
