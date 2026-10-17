import React from 'react';
import { Calendar, BookOpen, Users, FileText } from 'lucide-react';
import type { TabType } from './Navbar';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  subjectCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  subjectCount = 0,
}) => {
  const navItems = [
    { id: 'schedule' as TabType, label: 'Horario', icon: Calendar },
    { id: 'subjects' as TabType, label: 'Materias', icon: BookOpen },
    { id: 'professors' as TabType, label: 'Profesores', icon: Users },
    { id: 'notes' as TabType, label: 'Apuntes', icon: FileText },
  ];

  return (
    <nav
      aria-label="Navegación principal móvil M3"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#F1F4FA] dark:bg-[#1D2024] border-t border-[#C2C7CE]/40 dark:border-[#42474E]/40 px-2 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xs transition-colors duration-200"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="flex flex-col items-center justify-center min-w-[64px] py-0.5 rounded-2xl transition-all duration-200 cursor-pointer select-none group focus:outline-none"
            >
              {/* M3 Active Indicator Pill (md-navigation-tab indicator) */}
              <div
                className={`relative w-16 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF]'
                    : 'bg-transparent text-[#41474D] dark:text-[#C2C7CF] group-hover:bg-[#191C20]/5 dark:group-hover:bg-white/5'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />

                {/* M3 Badge */}
                {item.id === 'subjects' && subjectCount > 0 && (
                  <span className="absolute -top-1 -right-0.5 px-1.5 min-w-[16px] h-4 rounded-full text-[10px] font-bold bg-[#BA1A1A] text-white flex items-center justify-center shadow-xs">
                    {subjectCount}
                  </span>
                )}
              </div>

              {/* M3 Label text */}
              <span
                className={`text-[12px] tracking-[0.1px] mt-1 transition-colors leading-tight ${
                  isActive
                    ? 'font-bold text-[#191C20] dark:text-[#E2E2E6]'
                    : 'font-medium text-[#41474D] dark:text-[#C2C7CF]'
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
