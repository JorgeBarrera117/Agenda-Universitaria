import React from 'react';
import { CalendarCheck, Clock, BookOpen, Library, Timer } from 'lucide-react';
import type { TabType } from './Navbar';
import { NAV_TAB_OF, type NavTabId } from '../navigation/sections';

interface BottomNavProps {
  activeTab: TabType;
  /** Pestaña de la barra: Horario, Materias (con Profesores) o Biblioteca (Apuntes y Archivos). */
  onNavTabChange: (tab: NavTabId) => void;
  subjectCount?: number;
  notesCount?: number;
  documentsCount?: number;
  /** Agenda: vencidas más lo de hoy. */
  agendaDueCount?: number;
  /** Hay una sesión del modo estudio en marcha (punto en la pestaña Estudio). */
  studyActive?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavTabChange,
  subjectCount = 0,
  notesCount = 0,
  documentsCount = 0,
  agendaDueCount = 0,
  studyActive = false,
}) => {
  // Cinco pestañas (el máximo que pide Material 3): botones anchos y fáciles de tocar
  const navItems: { id: NavTabId; label: string; icon: typeof BookOpen }[] = [
    { id: 'schedule', label: 'Horario', icon: Clock },
    { id: 'agenda', label: 'Agenda', icon: CalendarCheck },
    { id: 'courses', label: 'Materias', icon: BookOpen },
    { id: 'library', label: 'Biblioteca', icon: Library },
    { id: 'study', label: 'Estudio', icon: Timer },
  ];
  const activeNavTab = NAV_TAB_OF[activeTab];

  const getBadgeInfo = (id: NavTabId) => {
    switch (id) {
      case 'agenda':
        return { count: agendaDueCount, color: 'bg-[#BA1A1A] text-white' };
      case 'courses':
        return { count: subjectCount, color: 'bg-[#5B5F67] dark:bg-[#C3C7D0] text-white dark:text-[#191C20]' };
      case 'library':
        return { count: notesCount + documentsCount, color: 'bg-[#B26B00] dark:bg-[#FFB86A] text-white dark:text-[#4A2800]' };
      default:
        return null;
    }
  };

  return (
    <nav
      aria-label="Navegación principal móvil M3"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--color-md-surface-container)] border-t border-[var(--color-md-outline-variant)] px-1 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-xs transition-colors duration-200"
    >
      <div className="flex items-center justify-between max-w-lg mx-auto" role="tablist">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNavTab === item.id;
          const badge = getBadgeInfo(item.id);

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onNavTabChange(item.id)}
              className="flex-1 flex flex-col items-center justify-center min-w-0 py-0.5 rounded-2xl transition-transform duration-150 ease-out active:scale-95 cursor-pointer select-none group focus:outline-none"
            >
              {/* M3 Active Indicator Pill (Expansión horizontal elástica desde el centro) */}
              <div className="relative w-13 sm:w-15 h-7 sm:h-8 rounded-full flex items-center justify-center">
                {/* Capa de Píldora Animada (GPU transform: scaleX + opacity) */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 rounded-full bg-[var(--color-md-accent-container)] transition-[transform,opacity] duration-200 ease-out ${
                    isActive
                      ? 'scale-x-100 scale-y-100 opacity-100 shadow-2xs'
                      : 'scale-x-[0.35] scale-y-75 opacity-0 group-hover:opacity-25 group-hover:scale-x-75 group-active:opacity-45 group-active:scale-x-90'
                  }`}
                />

                <Icon
                  className={`relative z-10 w-4 h-4 sm:w-5 sm:h-5 transition-all duration-200 ease-out ${
                    isActive
                      ? 'stroke-[2.4] scale-110 -translate-y-[0.5px] text-[var(--color-md-on-accent-container)]'
                      : 'stroke-[1.8] scale-100 translate-y-0 text-[var(--color-md-on-surface-variant)] group-active:scale-90'
                  }`}
                />

                {/* Sesión de estudio en marcha: punto verde */}
                {item.id === 'study' && studyActive && (
                  <span
                    className="absolute -top-0.5 right-1 z-20 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-[var(--color-md-surface-container)] bg-[#2E7D32]"
                    aria-label="Sesión de estudio en marcha"
                  />
                )}

                {/* M3 Badges */}
                {badge && badge.count > 0 && (
                  <span
                    className={`absolute -top-1 -right-0.5 z-20 px-1 min-w-[15px] h-3.5 rounded-full text-9px font-bold ${badge.color} flex items-center justify-center shadow-xs transition-transform duration-200 ease-out ${
                      isActive ? 'scale-105' : 'scale-100'
                    }`}
                  >
                    {badge.count}
                  </span>
                )}
              </div>

              {/* M3 Label text */}
              <span
                className={`text-10px sm:text-11px tracking-[0.1px] mt-0.5 sm:mt-1 transition-all duration-200 ease-out leading-tight truncate max-w-full px-0.5 ${
                  isActive
                    ? 'font-bold text-[var(--color-md-on-surface)] translate-y-0 opacity-100'
                    : 'font-medium text-[var(--color-md-on-surface-variant)] opacity-85 group-hover:opacity-100'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
