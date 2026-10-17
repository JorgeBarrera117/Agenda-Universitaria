import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  BookOpen,
  Users,
  FileText,
  FolderKanban,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react';

export type TabType = 'schedule' | 'subjects' | 'professors' | 'notes' | 'documents';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenSettings: () => void;
  subjectCount?: number;
  documentsCount?: number;
}


export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenSettings,
  subjectCount = 0,
  documentsCount = 0,
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
    month: 'short',
  });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const navItems = [
    { id: 'schedule' as TabType, label: 'Horario', icon: CalendarIcon },
    { id: 'subjects' as TabType, label: 'Materias', icon: BookOpen },
    { id: 'professors' as TabType, label: 'Profesores', icon: Users },
    { id: 'notes' as TabType, label: 'Apuntes', icon: FileText },
    { id: 'documents' as TabType, label: 'Archivos', icon: FolderKanban },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#F1F4FA]/95 dark:bg-[#1D2024]/95 backdrop-blur-md border-b border-[#C2C7CE]/35 dark:border-[#42474E]/35 text-[#191C20] dark:text-[#E2E2E6] shadow-xs transition-colors duration-200">
      <div
        className="max-w-[1750px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center justify-between h-14 sm:h-16 landscape:h-14">
          {/* M3 Top App Bar Title & Campus Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <img
                src="/app-icon-claro.svg"
                alt="Logo Agenda Universitaria"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl shadow-xs ring-1 ring-[#C2C7CE]/50 dark:ring-white/10 object-contain bg-white p-0.5"
              />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#FFB77C] border-2 border-[#F1F4FA] dark:border-[#1D2024] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#001D32]" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#191C20] dark:text-[#E2E2E6] leading-tight truncate">
                  Agenda Universitaria
                </h1>
                <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] shrink-0">
                  Campus Digital
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[11px] sm:text-xs text-[#41474D] dark:text-[#C2C7CF] font-medium truncate">
                <span className="capitalize">{capitalizedDate}</span>
                <span>•</span>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold shrink-0">
                    <Wifi className="w-3 h-3" />
                    En línea
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-semibold shrink-0">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* M3 Primary Tabs (Desktop Navigation Dock) */}
          <nav
            aria-label="Pestañas de navegación de campus M3"
            className="hidden md:flex items-center gap-1 bg-[#E2E7EF] dark:bg-[#272A2F] p-1 rounded-full shrink-0 shadow-inner"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer select-none ${
                    isActive
                      ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] font-bold shadow-xs'
                      : 'text-[#41474D] dark:text-[#C2C7CF] hover:bg-[#191C20]/5 dark:hover:bg-white/5 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                      isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.id === 'subjects' && subjectCount > 0 && (
                    <span
                      className={`ml-1 px-1.5 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-[#001D32] dark:bg-[#D0E4FF] text-white dark:text-[#001D32]'
                          : 'bg-[#C2C7CE] dark:bg-[#42474E] text-[#191C20] dark:text-[#E2E2E6]'
                      }`}
                    >
                      {subjectCount}
                    </span>
                  )}
                  {item.id === 'documents' && documentsCount > 0 && (
                    <span
                      className={`ml-1 px-1.5 min-w-[16px] h-4 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-[#001D32] dark:bg-[#D0E4FF] text-white dark:text-[#001D32]'
                          : 'bg-[#C2C7CE] dark:bg-[#42474E] text-[#191C20] dark:text-[#E2E2E6]'
                      }`}
                    >
                      {documentsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* M3 Tonal Action Button (Ajustes) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenSettings}
              title="Ajustes y Personalización de la Agenda"
              aria-label="Abrir Ajustes"
              className="flex items-center gap-2 px-3.5 h-10 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] hover:bg-[#D8E3F8] dark:hover:bg-[#3C4758] text-[#191C20] dark:text-[#E2E2E6] transition-all duration-200 active:scale-95 cursor-pointer shadow-2xs group"
            >
              <div className="w-5 h-5 flex items-center justify-center text-[#00639B] dark:text-[#96CCFF] group-hover:rotate-90 transition-transform duration-300">
                <Settings className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold hidden sm:inline">
                Ajustes
              </span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
