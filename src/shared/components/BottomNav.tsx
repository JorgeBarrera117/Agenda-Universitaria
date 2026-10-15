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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-cove-navy/70 backdrop-blur-xl border-t border-cove-deep/30 px-3 py-2 safe-area-pb shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const theme = TAB_THEMES[item.id];
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? 'text-white font-extrabold scale-105'
                  : 'text-slate-300 font-semibold hover:text-white'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive
                    ? `${theme.bg} text-white ${theme.shadow} ${theme.ring}`
                    : 'text-slate-300'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
