import React, { useState } from 'react';
import { BookOpen, FileText, FolderKanban, Info, Users } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from './form/SegmentedControl';
import { FloatingSectionSwitcher } from './FloatingSectionSwitcher';
import { NAV_TAB_OF, NAV_TAB_SECTIONS, type NavTabId, type SectionId } from '../navigation/sections';

interface SectionSwitcherProps {
  activeSection: SectionId;
  onChange: (section: SectionId) => void;
  counts: Partial<Record<SectionId, number>>;
}

const SECTION_LABEL: Record<SectionId, string> = {
  schedule: 'Horario',
  agenda: 'Agenda',
  subjects: 'Materias',
  professors: 'Profesores',
  notes: 'Apuntes',
  documents: 'Archivos',
};

const SECTION_ICON: Partial<Record<SectionId, React.ComponentType<{ className?: string }>>> = {
  subjects: BookOpen,
  professors: Users,
  notes: FileText,
  documents: FolderKanban,
};

/** Aviso de una sola vez para quien buscaba la pestaña de antes (texto del teléfono y de PC). */
const MOVED_HINT: Partial<Record<NavTabId, { phone: string; wide: string }>> = {
  courses: {
    phone: 'Profesores ahora vive aquí, junto a sus materias. Cambia con los botones bajo el botón de agregar.',
    wide: 'Profesores ahora vive aquí, junto a sus materias. Cambia con el selector de arriba.',
  },
  library: {
    phone: 'Apuntes y Archivos ahora están juntos en Biblioteca. Cambia con los botones bajo el botón de agregar.',
    wide: 'Apuntes y Archivos ahora están juntos en Biblioteca. No se perdió nada.',
  },
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
 * - Teléfono: botones flotantes bajo el botón de agregar (FloatingSectionSwitcher).
 * - Tableta y PC: el botón segmentado M3 arriba, como el resto de la app.
 * No se muestra en Horario ni en Agenda.
 */
export const SectionSwitcher: React.FC<SectionSwitcherProps> = ({ activeSection, onChange, counts }) => {
  const tab = NAV_TAB_OF[activeSection];
  const sections = NAV_TAB_SECTIONS[tab];
  const [dismissed, setDismissed] = useState<Partial<Record<NavTabId, boolean>>>({});

  if (sections.length < 2) return null;

  const labelOf = (section: SectionId) => {
    const count = counts[section];
    return typeof count === 'number' ? `${SECTION_LABEL[section]} (${count})` : SECTION_LABEL[section];
  };
  const iconOf = (section: SectionId, className: string) => {
    const Icon = SECTION_ICON[section];
    return Icon ? <Icon className={className} aria-hidden="true" /> : null;
  };
  const ariaLabel = tab === 'courses' ? 'Ver materias o profesores' : 'Ver apuntes o archivos';

  const options: SegmentedOption<SectionId>[] = sections.map((section) => ({
    value: section,
    label: labelOf(section),
    icon: iconOf(section, 'h-4 w-4 shrink-0'),
  }));

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
    <>
      <FloatingSectionSwitcher
        value={activeSection}
        onChange={onChange}
        ariaLabel={ariaLabel}
        options={sections.map((section) => ({
          value: section,
          label: SECTION_LABEL[section],
          icon: iconOf(section, 'h-5 w-5 shrink-0'),
        }))}
      />
      <div className="flex flex-col gap-2.5 md:mb-3">
        <div className="hidden md:block">
          <SegmentedControl value={activeSection} onChange={onChange} options={options} ariaLabel={ariaLabel} className="md-card w-full max-w-md" />
        </div>
        {showHint && hint && (
          <div
            role="status"
            className="mb-3 flex items-start gap-2.5 rounded-2xl bg-[var(--color-md-primary-container)] py-2.5 pl-3.5 pr-2 text-[var(--color-md-on-primary-container)] md:mb-0 md:max-w-md"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-13px leading-snug">
              <span className="md:hidden">{hint.phone}</span>
              <span className="hidden md:inline">{hint.wide}</span>
            </span>
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
    </>
  );
};
