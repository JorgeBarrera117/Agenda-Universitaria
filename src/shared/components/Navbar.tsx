import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  BookOpen,
  Users,
  FileText,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react';

export type TabType = 'schedule' | 'subjects' | 'professors' | 'notes';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenSettings: () => void;
  subjectCount?: number;
}

const DESKTOP_TAB_THEMES: Record<TabType, string> = {
  schedule: 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-blue-500/30',
  subjects: 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/30',
  professors: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/30',
  notes: 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30',
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenSettings,
  subjectCount = 0,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fecha actual formateada en español
  const formattedDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const navItems = [
    { id: 'schedule' as TabType, label: 'Horario', icon: CalendarIcon },
    { id: 'subjects' as TabType, label: 'Materias', icon: BookOpen },
    { id: 'professors' as TabType, label: 'Profesores', icon: Users },
    { id: 'notes' as TabType, label: 'Apuntes', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 bg-cove-navy/70 backdrop-blur-xl border-b border-cove-deep/30 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Identidad de Campus Universitario */}
          <div className="flex items-center gap-3.5">
            <div className="relative group shrink-0">
              <img
                src="/app-icon-claro.svg"
                alt="Logo Agenda Universitaria"
                className="w-11 h-11 rounded-2xl shadow-lg shadow-cove-blue/20 ring-2 ring-cove-sky/40 object-contain bg-white"
              />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-cove-gold border-2 border-cove-navy flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-cove-navy" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-none">
                  Agenda Universitaria
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cove-sky/20 text-cove-sand border border-cove-sky/30">
                  Campus Digital
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-medium">
                <span className="capitalize">{capitalizedDate}</span>
                <span>•</span>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                    <Wifi className="w-3 h-3" />
                    En línea
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-cove-gold text-[11px] font-semibold">
                    <WifiOff className="w-3 h-3" />
                    Offline (Local-First)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navegación Desktop con estilo de pestañas de campus */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? DESKTOP_TAB_THEMES[item.id]
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {item.id === 'subjects' && subjectCount > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                        isActive ? 'bg-cove-navy/80 text-cove-sand' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {subjectCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Botón de Configuración en el Header Superior Derecho (Opción A) */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              title="Configuración de la Agenda y Respaldos"
              aria-label="Abrir configuración"
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-700/90 rounded-2xl border border-slate-700/80 hover:border-cove-sky/50 transition-all active:scale-95 cursor-pointer shadow-sm group"
            >
              <Settings className="w-4 h-4 text-cove-sky group-hover:rotate-45 transition-transform duration-300" />
              <span className="hidden sm:inline">Ajustes</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
