import React from 'react';
import { Calendar, BookOpen, Users, FileText, FolderKanban } from 'lucide-react';
import type { TabType } from './Navbar';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  subjectCount?: number;
  documentsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  subjectCount = 0,
  documentsCount = 0,
}) => {
  const navItems = [
    { id: 'schedule' as TabType, label: 'Horario', icon: Calendar },
    { id: 'subjects' as TabType, label: 'Materias', icon: BookOpen },
    { id: 'professors' as TabType, label: 'Profesores', icon: Users },
    { id: 'notes' as TabType, label: 'Apuntes', icon: FileText },
    { id: 'documents' as TabType, label: 'Archivos', icon: FolderKanban },
  ];

  return (
    <nav
      aria-label="Navegación principal móvil M3"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#F1F4FA] dark:bg-[#1D2024] border-t border-[#C2C7CE]/40 dark:border-[#42474E]/40 px-1 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-xs transition-colors duration-200"
    >
      <div className="flex items-center justify-between max-w-lg mx-auto" role="tablist">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(item.id)}
              className="flex-1 flex flex-col items-center justify-center min-w-0 py-0.5 rounded-2xl transition-transform duration-150 ease-out active:scale-90 cursor-pointer select-none group focus:outline-none"
            >
              {/* M3 Active Indicator Pill (Expansión horizontal elástica desde el centro) */}
              <div className="relative w-13 sm:w-15 h-7 sm:h-8 rounded-full flex items-center justify-center">
                {/* Capa de Píldora Animada (GPU transform: scaleX + opacity) */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive
                      ? 'bg-[#D0E4FF] dark:bg-[#004B76] scale-x-100 scale-y-100 opacity-100 shadow-2xs'
                      : 'bg-[#D0E4FF] dark:bg-[#004B76] scale-x-[0.35] scale-y-75 opacity-0 group-hover:opacity-25 group-hover:scale-x-75 group-active:opacity-45 group-active:scale-x-90'
                  }`}
                />

                <Icon
                  className={`relative z-10 w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    isActive
                      ? 'stroke-[2.4] scale-110 -translate-y-[0.5px] text-[#001D32] dark:text-[#D0E4FF]'
                      : 'stroke-[1.8] scale-100 translate-y-0 text-[#41474D] dark:text-[#C2C7CF] group-active:scale-85'
                  }`}
                />

                {/* M3 Badges */}
                {item.id === 'subjects' && subjectCount > 0 && (
                  <span
                    className={`absolute -top-1 -right-0.5 z-20 px-1 min-w-[15px] h-3.5 rounded-full text-[9px] font-bold bg-[#BA1A1A] text-white flex items-center justify-center shadow-xs transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                      isActive ? 'scale-105' : 'scale-100'
                    }`}
                  >
                    {subjectCount}
                  </span>
                )}
                {item.id === 'documents' && documentsCount > 0 && (
                  <span
                    className={`absolute -top-1 -right-0.5 z-20 px-1 min-w-[15px] h-3.5 rounded-full text-[9px] font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#001D32] flex items-center justify-center shadow-xs transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                      isActive ? 'scale-105' : 'scale-100'
                    }`}
                  >
                    {documentsCount}
                  </span>
                )}
              </div>

              {/* M3 Label text */}
              <span
                className={`text-[10px] sm:text-[11px] tracking-[0.1px] mt-0.5 sm:mt-1 transition-all duration-200 leading-tight truncate max-w-full px-0.5 ${
                  isActive
                    ? 'font-bold text-[#191C20] dark:text-[#E2E2E6] translate-y-0 opacity-100'
                    : 'font-medium text-[#41474D] dark:text-[#C2C7CF] opacity-85 group-hover:opacity-100'
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
