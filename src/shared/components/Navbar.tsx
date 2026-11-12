import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
import { StudentAvatar } from '../../features/settings/components/StudentAvatar';
import { CUSTOM_STATUS_ICON, findStatusPreset } from '../../features/settings/studentIdentity';
import type { StudentStatusMode } from '../../features/settings/types';

export type TabType = 'schedule' | 'subjects' | 'professors' | 'notes' | 'documents';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenSettings: () => void;
  subjectCount?: number;
  professorsCount?: number;
  notesCount?: number;
  documentsCount?: number;
  /** Nombre del perfil estudiantil; si existe, el título saluda al estudiante. */
  studentName?: string;
  studentAvatarUrl?: string;
  studentStatusMode?: StudentStatusMode;
  studentCustomStatus?: string;
}


export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenSettings,
  subjectCount = 0,
  professorsCount = 0,
  notesCount = 0,
  documentsCount = 0,
  studentName,
  studentAvatarUrl,
  studentStatusMode = 'network',
  studentCustomStatus,
}) => {
  const firstName = studentName?.trim().split(/\s+/)[0];
  const customStatus = studentStatusMode === 'custom' ? studentCustomStatus?.trim() : undefined;
  const StatusIcon = customStatus ? (findStatusPreset(customStatus)?.icon ?? CUSTOM_STATUS_ICON) : null;
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const tabsRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  // Píldora activa compartida que se desliza entre pestañas. Escribe estilos directamente en el DOM
  // (sin estado) y se reubica si cambia el tamaño del dock. Solo anima transform y opacity.
  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    const indicator = indicatorRef.current;
    if (!tabs || !indicator) return;

    const place = () => {
      const active = tabs.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!active || active.offsetWidth === 0) {
        indicator.style.opacity = '0';
        return;
      }
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.height = `${active.offsetHeight}px`;
      indicator.style.transform = `translate3d(${active.offsetLeft}px, ${active.offsetTop}px, 0)`;
      indicator.style.opacity = '1';
    };

    place();
    // La transición se activa después del primer posicionamiento para no "volar" desde la izquierda
    const frame = requestAnimationFrame(() => {
      indicator.dataset.ready = 'true';
    });
    const observer = new ResizeObserver(place);
    observer.observe(tabs);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeTab]);
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

  const getBadgeCount = (id: TabType): number => {
    switch (id) {
      case 'subjects':
        return subjectCount;
      case 'professors':
        return professorsCount;
      case 'notes':
        return notesCount;
      case 'documents':
        return documentsCount;
      default:
        return 0;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-md-surface-container)]/95 backdrop-blur-md border-b border-[var(--color-md-outline-variant)]/35 text-[var(--color-md-on-surface)] shadow-xs transition-colors duration-200">
      <div
        className="w-full mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center justify-between gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center h-14 sm:h-16 lg:h-[76px] xl:h-20 landscape:max-lg:h-14">
          {/* M3 Top App Bar Title & Campus Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 lg:gap-3.5 min-w-0 shrink-0">
            {/* Avatar del estudiante: abre Ajustes, donde está la credencial. El punto indica la
                conexión aunque el estado muestre una frase personalizada. */}
            <button
              type="button"
              onClick={onOpenSettings}
              title="Ver credencial y perfil"
              aria-label={`Ver credencial y perfil (${isOnline ? 'en línea' : 'sin conexión'})`}
              className="relative shrink-0 rounded-2xl transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-md-primary)] focus-visible:ring-offset-2"
            >
              <StudentAvatar
                avatarUrl={studentAvatarUrl}
                name={studentName}
                className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 xl:w-12 xl:h-12 rounded-2xl shadow-xs ring-1 ring-[var(--color-md-outline-variant)]/50 dark:ring-white/10 text-sm lg:text-base"
              />
              <span
                aria-hidden="true"
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 lg:w-4 lg:h-4 rounded-full border-2 border-[var(--color-md-surface-container)] transition-colors duration-200 ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-[15px] lg:text-lg xl:text-xl font-extrabold tracking-tight text-[var(--color-md-on-surface)] leading-tight whitespace-nowrap truncate max-w-[200px] sm:max-w-none">
                  {firstName ? `Hola, ${firstName}` : 'Agenda Universitaria'}
                </h1>
                <span className="hidden 2xl:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] shrink-0">
                  Campus Digital
                </span>
              </div>
              <div className="flex md:max-lg:hidden landscape:max-lg:hidden items-center gap-1.5 sm:gap-2 mt-0.5 text-[11px] sm:text-xs lg:text-[13px] text-[var(--color-md-on-surface-variant)] font-medium whitespace-nowrap">
                <span className="capitalize">{capitalizedDate}</span>
                <span>•</span>
                {customStatus && StatusIcon ? (
                  <span
                    className="inline-flex min-w-0 max-w-[150px] sm:max-w-[220px] items-center gap-1 rounded-full bg-[var(--color-md-primary-container)] px-2 py-px text-[11px] lg:text-xs font-semibold text-[var(--color-md-on-primary-container)]"
                    title={customStatus}
                  >
                    <StatusIcon className="w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{customStatus}</span>
                  </span>
                ) : isOnline ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] lg:text-xs font-semibold shrink-0">
                    <Wifi className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                    En línea
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] lg:text-xs font-semibold shrink-0">
                    <WifiOff className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                    Offline
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* M3 Primary Tabs (Desktop & Landscape Navigation Dock) */}
          <nav
            ref={tabsRef}
            aria-label="Pestañas de navegación de campus M3"
            className="relative hidden md:flex items-center justify-center gap-1 lg:gap-1.5 xl:gap-2 bg-[var(--color-md-surface-container-high)] p-1 lg:p-1.5 rounded-full shrink-0 shadow-inner lg:justify-self-center"
          >
            <span
              ref={indicatorRef}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 rounded-full bg-[var(--color-md-primary-container)] opacity-0 shadow-xs data-[ready=true]:transition-[transform,opacity] data-[ready=true]:duration-200 data-[ready=true]:ease-out motion-reduce:transition-none"
            />
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badgeCount = getBadgeCount(item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onTabChange(item.id)}
                  className={`group flex items-center gap-1.5 lg:gap-2 xl:gap-2.5 md:px-2.5 md:py-1.5 lg:px-3.5 lg:py-2 xl:px-4.5 xl:py-2 2xl:px-6 2xl:py-2.5 rounded-full text-xs lg:text-xs xl:text-sm 2xl:text-[15px] whitespace-nowrap relative z-10 transition-all duration-200 ease-out active:scale-95 cursor-pointer select-none ${
                    isActive
                      ? 'text-[var(--color-md-on-primary-container)] font-bold'
                      : 'text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/5 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 lg:w-4.5 lg:h-4.5 xl:w-5 xl:h-5 shrink-0 transition-all duration-200 ease-out ${
                      isActive ? 'stroke-[2.4] scale-110' : 'stroke-[1.9] group-hover:scale-105 group-active:scale-90'
                    }`}
                  />
                  <span>{item.label}</span>
                  {badgeCount > 0 && (
                    <span
                      className={`ml-0.5 px-1.5 min-w-[16px] lg:min-w-[20px] h-4 lg:h-5 rounded-full text-[10px] lg:text-xs font-bold flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-[var(--color-md-on-primary-container)] text-[var(--color-md-primary-container)]'
                          : 'bg-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface)]'
                      }`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* M3 Tonal Action Button (Ajustes) */}
          <div className="flex items-center justify-end gap-2 shrink-0 lg:justify-self-end">
            <button
              onClick={onOpenSettings}
              title="Ajustes y Personalización de la Agenda"
              aria-label="Abrir Ajustes"
              className="flex items-center justify-center gap-2 w-10 h-10 lg:w-auto lg:px-5 lg:h-11 xl:h-12 rounded-full bg-[var(--color-md-surface-container-high)] hover:bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-surface)] transition-all duration-200 active:scale-95 cursor-pointer shadow-2xs group"
            >
              <div className="w-5 h-5 flex items-center justify-center text-[var(--color-md-primary)] group-hover:rotate-90 transition-transform duration-300">
                <Settings className="w-4 h-4 lg:w-5 lg:h-5" />
              </div>
              <span className="text-xs lg:text-sm font-bold hidden lg:inline">
                Ajustes
              </span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
