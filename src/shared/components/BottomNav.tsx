import React from 'react';
import { Calendar, BookOpen, Users, FileText, FolderKanban } from 'lucide-react';
import type { TabType } from './Navbar';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  subjectCount?: number;
  professorsCount?: number;
  notesCount?: number;
  documentsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  subjectCount = 0,
  professorsCount = 0,
  notesCount = 0,
  documentsCount = 0,
}) => {
  const navItems = [
    { id: 'schedule' as TabType, label: 'Horario', icon: Calendar },
    { id: 'subjects' as TabType, label: 'Materias', icon: BookOpen },
    { id: 'professors' as TabType, label: 'Profesores', icon: Users },
    { id: 'notes' as TabType, label: 'Apuntes', icon: FileText },
    { id: 'documents' as TabType, label: 'Archivos', icon: FolderKanban },
  ];

  const getBadgeInfo = (id: TabType) => {
    switch (id) {
      case 'subjects':
        return { count: subjectCount, color: 'bg-[#BA1A1A] text-white' };
      case 'professors':
        return { count: professorsCount, color: 'bg-[#6750A4] dark:bg-[#D0BCFF] text-white dark:text-[#381E72]' };
      case 'notes':
        return { count: notesCount, color: 'bg-[#B26B00] dark:bg-[#FFB86A] text-white dark:text-[#4A2800]' };
      case 'documents':
        return { count: documentsCount, color: 'bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#001D32]' };
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
          const isActive = activeTab === item.id;
          const badge = getBadgeInfo(item.id);

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(item.id)}
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

                {/* M3 Badges */}
                {badge && badge.count > 0 && (
                  <span
                    className={`absolute -top-1 -right-0.5 z-20 px-1 min-w-[15px] h-3.5 rounded-full text-[9px] font-bold ${badge.color} flex items-center justify-center shadow-xs transition-transform duration-200 ease-out ${
                      isActive ? 'scale-105' : 'scale-100'
                    }`}
                  >
                    {badge.count}
                  </span>
                )}
              </div>

              {/* M3 Label text */}
              <span
                className={`text-[10px] sm:text-[11px] tracking-[0.1px] mt-0.5 sm:mt-1 transition-all duration-200 ease-out leading-tight truncate max-w-full px-0.5 ${
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
