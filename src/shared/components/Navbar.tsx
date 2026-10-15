import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  BookOpen,
  Users,
  FileText,
  Download,
  Upload,
  Wifi,
  WifiOff,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { exportDatabaseBackup, importDatabaseBackup } from '../utils/backup';

export type TabType = 'schedule' | 'subjects' | 'professors' | 'notes';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
  subjectCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onShowToast,
  subjectCount = 0,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = async () => {
    try {
      await exportDatabaseBackup();
      onShowToast('Copia de seguridad del semestre exportada con éxito');
    } catch {
      onShowToast('Error al exportar la copia de seguridad');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importDatabaseBackup(file);
      onShowToast('Datos del semestre restaurados correctamente');
    } catch (err: unknown) {
      if (err instanceof Error) onShowToast(err.message);
      else onShowToast('Error al restaurar los datos');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Identidad de Campus Universitario */}
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-400/30">
                <GraduationCap className="w-6 h-6 transform -rotate-6" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-slate-900 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-slate-950" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-none">
                  Agenda Universitaria
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
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
                  <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] font-semibold">
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
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {item.id === 'subjects' && subjectCount > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                        isActive ? 'bg-indigo-900/60 text-indigo-100' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {subjectCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Acciones de Respaldo */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              title="Descargar copia de seguridad del semestre (JSON)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Restaurar copia de seguridad (JSON)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Restaurar</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
