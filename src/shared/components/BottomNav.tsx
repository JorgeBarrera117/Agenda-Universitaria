import React from 'react';
import { Calendar, BookOpen, Users, FileText } from 'lucide-react';
import type { TabType } from './Navbar';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TAB_THEMES: Record<TabType, { bg: string; ring: string; shadow: string }> = {
  schedule: {
    bg: 'bg-gradient-to-r from-blue-600 to-sky-500',
    ring: 'ring-1 ring-sky-400/50',
    shadow: 'shadow-md shadow-blue-500/40',
  },
  subjects: {
    bg: 'bg-gradient-to-r from-emerald-600 to-teal-500',
    ring: 'ring-1 ring-teal-400/50',
    shadow: 'shadow-md shadow-emerald-500/40',
  },
  professors: {
    bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    ring: 'ring-1 ring-amber-400/50',
    shadow: 'shadow-md shadow-amber-500/40',
  },
  notes: {
    bg: 'bg-gradient-to-r from-indigo-500 to-violet-600',
    ring: 'ring-1 ring-violet-400/50',
    shadow: 'shadow-md shadow-indigo-500/40',
  },
};

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'schedule' as TabType, label: 'Horario', icon: Calendar },
    { id: 'subjects' as TabType, label: 'Materias', icon: BookOpen },
    { id: 'professors' as TabType, label: 'Profes', icon: Users },
    { id: 'notes' as TabType, label: 'Apuntes', icon: FileText },
  ];

  return (
    <nav className="md:hidden fixed bottom-3 inset-x-3.5 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] z-40 bg-cove-navy/90 dark:bg-slate-950/95 backdrop-blur-2xl border border-cove-sky/30 dark:border-slate-800 rounded-3xl sm:rounded-[28px] px-2.5 py-1.5 landscape:py-1 shadow-2xl shadow-cove-navy/50 dark:shadow-black/80 ring-1 ring-white/10 safe-area-pb">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const theme = TAB_THEMES[item.id];
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center py-0.5 px-3 rounded-2xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'text-white font-extrabold scale-105'
                  : 'text-slate-400 hover:text-white font-semibold'
              }`}
            >
              <div
                className={`p-1.5 sm:p-2 landscape:p-1 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? `${theme.bg} text-white ${theme.shadow} ${theme.ring}`
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 landscape:w-4 landscape:h-4" />
              </div>
              <span
                className={`text-[10px] landscape:text-[9px] mt-0.5 tracking-tight font-bold transition-colors ${
                  isActive ? 'text-white' : 'text-slate-400'
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
