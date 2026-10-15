import React from 'react';
import { Calendar, BookOpen, Users, FileText } from 'lucide-react';
import type { TabType } from './Navbar';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'schedule' as TabType, label: 'Horario', icon: Calendar },
    { id: 'subjects' as TabType, label: 'Materias', icon: BookOpen },
    { id: 'professors' as TabType, label: 'Profes', icon: Users },
    { id: 'notes' as TabType, label: 'Apuntes', icon: FileText },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-cove-navy/95 backdrop-blur-md border-t border-cove-deep/40 px-3 py-2 safe-area-pb shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? 'text-white font-extrabold scale-105'
                  : 'text-slate-400 font-semibold hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cove-blue to-cove-sky text-white shadow-md shadow-cove-blue/40 ring-1 ring-cove-sky/40'
                    : 'text-slate-400'
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
