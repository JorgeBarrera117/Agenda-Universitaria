import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Bell,
  BellRing,
  Clock,
  Volume2,
  Calendar,
  Layers,
  Camera,
  Database,
  Info,
  Check,
  Send,
  Heart,
  Palette,
  ShieldCheck,
  Sparkles,
  Image as ImageIcon,
  Sliders,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useAppSettings } from '../hooks/useAppSettings';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { NotificationService } from '../../../shared/services/notificationService';
import { BackupSection } from './BackupSection';
import { applyTheme, MATERIAL_COLOR_PALETTES } from '../../../shared/utils/theme';
import {
  getCustomWallpaperDataUrl,
  saveCustomWallpaperDataUrl,
  getPatternMaskDataUri,
} from '../../../shared/components/AppWallpaper';
import { APP_INFO } from '../../../shared/constants/appInfo';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import type { AppSettings, MaterialColorTheme, WallpaperStyle } from '../types';

interface SettingsViewProps {
  onBack: () => void;
  onShowToast: (message: string) => void;
}

type SettingsCategory =
  | 'appearance'
  | 'schedule'
  | 'notifications'
  | 'media'
  | 'backup'
  | 'about';

export const SettingsView: React.FC<SettingsViewProps> = ({
  onBack,
  onShowToast,
}) => {
  const { settings, updateSettings, storageEstimate, refreshStorageEstimate } = useAppSettings();
  const { subjects } = useSubjects();
  const { slots } = useSchedule();

  const [activeSubView, setActiveSubView] = useState<SettingsCategory | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [semesterInput, setSemesterInput] = useState(settings.semesterName);
  const [customWallpaperPreview, setCustomWallpaperPreview] = useState<string | null>(() =>
    getCustomWallpaperDataUrl()
  );
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  // Procesar y comprimir foto de papel tapiz seleccionada por el usuario
  const handleCustomWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const srcData = ev.target?.result as string;
      if (!srcData) return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          saveCustomWallpaperDataUrl(compressedDataUrl);
          setCustomWallpaperPreview(compressedDataUrl);
          updateSettings({
            ...settings,
            wallpaperStyle: 'custom',
            wallpaperOpacity: Math.max(25, settings.wallpaperOpacity ?? 35),
          });
          onShowToast('Foto de papel tapiz aplicada con éxito');
        }
        canvas.width = 0;
        canvas.height = 0;
      };
      img.src = srcData;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveCustomWallpaper = () => {
    saveCustomWallpaperDataUrl(null);
    setCustomWallpaperPreview(null);
    updateSettings({ ...settings, wallpaperStyle: 'campus', wallpaperOpacity: 16 });
    onShowToast('Foto eliminada. Papel tapiz universitario restaurado.');
  };

  // Sincronizar permisos y almacenamiento
  useEffect(() => {
    refreshStorageEstimate();
    NotificationService.checkPermissions().then(setHasPermission);
  }, []);

  useEffect(() => {
    setSemesterInput(settings.semesterName);
  }, [settings.semesterName]);

  // Interceptar botón "Atrás" de Android / Navegador:
  // Si estamos en una subpágina, vuelve al menú principal de ajustes; si no, sale a la agenda.
  useBackButton(() => {
    if (activeSubView !== null) {
      setActiveSubView(null);
      return true;
    }
    onBack();
    return true;
  }, BACK_PRIORITY.SETTINGS);

  // Manejador de cambio de tema instantáneo (Modo Claro / Oscuro / Sistema)
  const handleThemeChange = (newTheme: AppSettings['theme']) => {
    applyTheme(newTheme, settings.colorPalette);
    updateSettings({ ...settings, theme: newTheme });
    onShowToast(`Tema cambiado a: ${newTheme === 'dark' ? 'Oscuro' : newTheme === 'light' ? 'Claro' : 'Automático'}`);
  };

  // Manejador de cambio de paleta dinámica Material You
  const handleColorPaletteChange = (newPalette: MaterialColorTheme) => {
    applyTheme(settings.theme, newPalette);
    updateSettings({ ...settings, colorPalette: newPalette });
    onShowToast(`Paleta de color actualizada: ${MATERIAL_COLOR_PALETTES[newPalette].name}`);
  };

  // Manejador de guardado de semestre
  const handleSaveSemester = () => {
    const trimmed = semesterInput.trim() || 'Semestre Actual';
    updateSettings({ ...settings, semesterName: trimmed });
    onShowToast('Periodo académico actualizado.');
  };

  // Manejador de vista inicial de horario
  const handleViewModeChange = (defaultView: AppSettings['defaultScheduleView']) => {
    updateSettings({ ...settings, defaultScheduleView: defaultView });
    onShowToast(`Vista inicial de horario: ${defaultView === 'weekly' ? 'Semanal' : 'Por día'}`);
  };

  // Manejador de días lectivos visibles
  const handleVisibleDaysChange = (visibleDays: AppSettings['visibleDays']) => {
    updateSettings({ ...settings, visibleDays });
    onShowToast('Días de cursada actualizados.');
  };

  // Manejador de switch de notificaciones
  const handleToggleNotifications = async (enabled: boolean) => {
    const updated = { ...settings, notificationsEnabled: enabled };
    updateSettings(updated);

    if (enabled) {
      const granted = await NotificationService.checkPermissions();
      if (!granted) {
        const req = await NotificationService.requestPermissions();
        setHasPermission(req);
        if (!req) {
          onShowToast('Permisos de notificación no otorgados en el sistema.');
          return;
        }
      }
      const res = await NotificationService.syncScheduleNotifications(slots, subjects, updated);
      onShowToast(res.scheduledCount > 0 ? `${res.scheduledCount} recordatorios programados en tu celular.` : 'Recordatorios activados.');
    } else {
      await NotificationService.syncScheduleNotifications(slots, subjects, updated);
      onShowToast('Recordatorios desactivados.');
    }
  };

  // Alternar opciones específicas de notificación
  const handleToggleSpecificNotification = async (key: 'notify15MinBefore' | 'notifyAtClassStart' | 'notificationSound') => {
    const updated = { ...settings, [key]: !settings[key] };
    updateSettings(updated);
    if (updated.notificationsEnabled) {
      await NotificationService.syncScheduleNotifications(slots, subjects, updated);
    }
  };

  // Solicitar permisos de notificación
  const handleRequestPermission = async () => {
    const granted = await NotificationService.requestPermissions();
    setHasPermission(granted);
    if (granted) {
      onShowToast('¡Permisos concedidos con éxito!');
      await NotificationService.sendTestNotification();
    } else {
      onShowToast('Permiso de notificaciones denegado en el sistema.');
    }
  };

  // Probar notificación
  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    try {
      const sent = await NotificationService.sendTestNotification();
      if (sent) {
        onShowToast('Notificación de prueba enviada a tu dispositivo.');
      } else {
        onShowToast('Debes conceder permisos de notificación en tu teléfono.');
      }
    } finally {
      setIsTestingNotification(false);
    }
  };

  // Manejador de calidad de imagen
  const handleImageQualityChange = (imageQuality: AppSettings['imageQuality']) => {
    updateSettings({ ...settings, imageQuality });
    onShowToast(`Calidad de capturas: ${imageQuality === 'balanced' ? 'Equilibrada (720p)' : 'Alta nitidez (1080p)'}`);
  };

  // Etiqueta legible de tema
  const themeLabel =
    settings.theme === 'dark' ? 'Oscuro' : settings.theme === 'light' ? 'Claro' : 'Automático';

  // Etiqueta legible de horario
  const scheduleViewLabel =
    settings.defaultScheduleView === 'weekly' ? 'Semana' : 'Por día';

  const visibleDaysLabel =
    settings.visibleDays === 'mon-fri' ? 'Lun - Vie' : settings.visibleDays === 'mon-sat' ? 'Lun - Sáb' : 'Toda la semana';

  return (
    <div className="relative min-h-screen text-slate-800 dark:text-slate-100 pb-16 animate-in fade-in duration-200">
      <div className="w-full mx-auto pt-2 sm:pt-4 space-y-4">

        {/* =========================================================================
            VISTA 1: MENÚ PRINCIPAL COMPACTO DE AJUSTES (ESTILO TELEGRAM / WHATSAPP)
           ========================================================================= */}
        {activeSubView === null ? (
          <div className="space-y-4 m3-tab-enter-left">
            {/* Cabecera Principal */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onBack}
                  title="Volver a la Agenda"
                  aria-label="Volver a la Agenda"
                  className="w-10 h-10 flex items-center justify-center text-[var(--color-md-on-surface)] bg-[var(--color-md-card-bg)] border border-[var(--color-md-outline-variant)] rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 text-[var(--color-md-primary)]" />
                </button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-[var(--color-md-on-surface)] tracking-tight">
                    Ajustes
                  </h1>
                  <p className="text-xs text-[var(--color-md-on-surface-variant)] font-medium">
                    Preferencias globales de la aplicación
                  </p>
                </div>
              </div>
            </div>

            {/* Ficha de Identidad del Campus (Perfil Universitario) */}
            <div className="bg-[var(--color-md-card-bg)] rounded-2xl p-3.5 shadow-xs border border-[var(--color-md-outline-variant)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src="/app-icon-claro.svg"
                    alt="Logo Agenda Universitaria"
                    className="w-11 h-11 rounded-xl shadow-xs ring-2 ring-[var(--color-md-primary)]/40 object-contain bg-white p-0.5"
                  />
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-cove-gold border-2 border-[var(--color-md-card-bg)] flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-cove-navy" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-[var(--color-md-on-surface)] truncate">
                    {APP_INFO.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
                      {settings.semesterName || 'Ciclo Académico'}
                    </span>
                    <span className="text-[11px] text-[var(--color-md-on-surface-variant)] font-medium">
                      v{APP_INFO.version}
                    </span>
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  Offline-First
                </span>
              </div>
            </div>

            {/* GRUPO 1: PREFERENCIAS DE ESTUDIO */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 block">
                Preferencias de Estudio
              </span>
              <div className="bg-[#FDFBFF] dark:bg-[#1D2024] rounded-[28px] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 divide-y divide-[#C3C7D0]/30 dark:divide-[#43474E]/30 overflow-hidden shadow-xs">
                {/* 1.1 Apariencia y Modo Oscuro */}
                <button
                  type="button"
                  onClick={() => setActiveSubView('appearance')}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {settings.theme === 'dark' ? (
                        <Moon className="w-5 h-5" />
                      ) : settings.theme === 'light' ? (
                        <Sun className="w-5 h-5" />
                      ) : (
                        <Monitor className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                        Apariencia y Tema
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                        {themeLabel} • {(MATERIAL_COLOR_PALETTES[settings.colorPalette || 'default'] || MATERIAL_COLOR_PALETTES.default).name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: (MATERIAL_COLOR_PALETTES[settings.colorPalette || 'default'] || MATERIAL_COLOR_PALETTES.default).light.primary }}
                      />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {themeLabel}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* 1.2 Semestre y Horario Académico */}
                <button
                  type="button"
                  onClick={() => setActiveSubView('schedule')}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-cove-blue dark:text-cove-sky flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                        Semestre y Horario
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                        {settings.semesterName || 'Configurar periodo'} • {scheduleViewLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                      {visibleDaysLabel}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            </div>

            {/* GRUPO 2: NOTIFICACIONES Y MEDIOS */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 block">
                Notificaciones y Medios
              </span>
              <div className="bg-[#FDFBFF] dark:bg-[#1D2024] rounded-[28px] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 divide-y divide-[#C3C7D0]/30 dark:divide-[#43474E]/30 overflow-hidden shadow-xs">
                {/* 2.1 Notificaciones de Clases */}
                <button
                  type="button"
                  onClick={() => setActiveSubView('notifications')}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <BellRing className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                        Notificaciones y Avisos
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                        Recordatorios en móvil antes de cada clase
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                        settings.notificationsEnabled
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {settings.notificationsEnabled ? 'Activas' : 'Desactivadas'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* 2.2 Fotografías y Pizarras */}
                <button
                  type="button"
                  onClick={() => setActiveSubView('media')}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                        Fotografías y Notas de Pizarrón
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                        Compresión y nitidez de capturas de cátedra
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                      {settings.imageQuality === 'balanced' ? '720p (Equilibrada)' : '1080p (Alta)'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            </div>

            {/* GRUPO 3: ALMACENAMIENTO Y SISTEMA */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 block">
                Almacenamiento y Sistema
              </span>
              <div className="bg-[#FDFBFF] dark:bg-[#1D2024] rounded-[28px] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 divide-y divide-[#C3C7D0]/30 dark:divide-[#43474E]/30 overflow-hidden shadow-xs">
                {/* 3.1 Copias de Seguridad y Datos */}
                <button
                  type="button"
                  onClick={() => setActiveSubView('backup')}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Database className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                        Datos y Copias de Seguridad
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                        Exportar e importar respaldo JSON local-first
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                      {typeof storageEstimate.usedMB === 'number' ? `${storageEstimate.usedMB.toFixed(1)} MB` : 'Local'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* 3.2 Información de la Aplicación */}
                <button
                  type="button"
                  onClick={() => setActiveSubView('about')}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Info className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                        Acerca de la Agenda
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                        Créditos, arquitectura y versión
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                      v{APP_INFO.version}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             VISTA 2: SUB-PÁGINAS DEDICADAS (FOCALIZADAS, LIMPIAS Y COMPACTAS)
             ========================================================================= */
          <div className="space-y-4 m3-tab-enter-right">
            {/* Cabecera de la Sub-Página */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSubView(null)}
                  title="Regresar a Ajustes"
                  aria-label="Regresar a Ajustes"
                  className="w-10 h-10 flex items-center justify-center text-[var(--color-md-on-surface)] bg-[var(--color-md-card-bg)] border border-[var(--color-md-outline-variant)] rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 text-[var(--color-md-primary)]" />
                </button>
                <div>
                  <h2 className="text-xl font-black text-[var(--color-md-on-surface)] tracking-tight">
                    {activeSubView === 'appearance' && 'Apariencia y Tema'}
                    {activeSubView === 'schedule' && 'Semestre y Horario'}
                    {activeSubView === 'notifications' && 'Notificaciones y Avisos'}
                    {activeSubView === 'media' && 'Fotografías y Pizarras'}
                    {activeSubView === 'backup' && 'Datos y Copias de Seguridad'}
                    {activeSubView === 'about' && 'Acerca de la Agenda'}
                  </h2>
                  <p className="text-xs text-[var(--color-md-on-surface-variant)] font-medium">
                    Ajustes • Configuración específica
                  </p>
                </div>
              </div>
            </div>

            {/* ---------------- SUB-VISTA 1: APARIENCIA ---------------- */}
            {activeSubView === 'appearance' && (
              <div className="bg-[var(--color-md-card-bg)] rounded-[28px] p-4 sm:p-6 shadow-xs border border-[var(--color-md-outline-variant)] space-y-5">
                {/* 1. Modo de Luminosidad (Claro / Oscuro / Sistema) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-md-outline-variant)]">
                    <Sun className="w-4 h-4 text-[var(--color-md-primary)]" />
                    <span className="text-xs font-bold text-[var(--color-md-on-surface)]">
                      Modo de Luminosidad de la Interfaz
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Modo Claro */}
                    <button
                      type="button"
                      onClick={() => handleThemeChange('light')}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 relative ${
                        settings.theme === 'light'
                          ? 'bg-[var(--color-md-primary-container)] border-[var(--color-md-primary)] text-[var(--color-md-on-primary-container)] shadow-xs'
                          : 'bg-[var(--color-md-surface-container)] border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-outline)]'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform ${
                          settings.theme === 'light'
                            ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-xs scale-105'
                            : 'bg-[var(--color-md-card-bg)] text-[var(--color-md-on-surface-variant)]'
                        }`}
                      >
                        <Sun className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-xs sm:text-sm">Claro</span>
                      {settings.theme === 'light' && (
                        <div className="w-4 h-4 rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] flex items-center justify-center text-[10px]">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>

                    {/* Modo Oscuro */}
                    <button
                      type="button"
                      onClick={() => handleThemeChange('dark')}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 relative ${
                        settings.theme === 'dark'
                          ? 'bg-[var(--color-md-primary-container)] border-[var(--color-md-primary)] text-[var(--color-md-on-primary-container)] shadow-xs'
                          : 'bg-[var(--color-md-surface-container)] border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-outline)]'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform ${
                          settings.theme === 'dark'
                            ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-xs scale-105'
                            : 'bg-[var(--color-md-card-bg)] text-[var(--color-md-on-surface-variant)]'
                        }`}
                      >
                        <Moon className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-xs sm:text-sm">Oscuro</span>
                      {settings.theme === 'dark' && (
                        <div className="w-4 h-4 rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] flex items-center justify-center text-[10px]">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>

                    {/* Automático (Sistema) */}
                    <button
                      type="button"
                      onClick={() => handleThemeChange('system')}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 relative ${
                        settings.theme === 'system'
                          ? 'bg-[var(--color-md-primary-container)] border-[var(--color-md-primary)] text-[var(--color-md-on-primary-container)] shadow-xs'
                          : 'bg-[var(--color-md-surface-container)] border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:border-[var(--color-md-outline)]'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform ${
                          settings.theme === 'system'
                            ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-xs scale-105'
                            : 'bg-[var(--color-md-card-bg)] text-[var(--color-md-on-surface-variant)]'
                        }`}
                      >
                        <Monitor className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-xs sm:text-sm">Auto</span>
                      {settings.theme === 'system' && (
                        <div className="w-4 h-4 rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] flex items-center justify-center text-[10px]">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Paleta de Color Dinámica (Material You) con Radio Buttons Compactos */}
                <div className="pt-3.5 border-t border-[var(--color-md-outline-variant)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-[var(--color-md-primary)]" />
                      <span className="text-xs font-bold text-[var(--color-md-on-surface)]">
                        Color del Tema (Material You)
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-[var(--color-md-primary)]">
                      {(MATERIAL_COLOR_PALETTES[settings.colorPalette || 'default'] || MATERIAL_COLOR_PALETTES.default).name}
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--color-md-on-surface-variant)] leading-snug">
                    Selecciona una paleta cromática para adaptar toda la interfaz manteniendo textos legibles:
                  </p>

                  <div
                    role="radiogroup"
                    aria-label="Paletas de color del tema"
                    className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 pt-0.5"
                  >
                    {(Object.keys(MATERIAL_COLOR_PALETTES) as MaterialColorTheme[]).map((paletteKey) => {
                      const pal = MATERIAL_COLOR_PALETTES[paletteKey];
                      const currentPalette = settings.colorPalette || 'default';
                      const isSelected = currentPalette === paletteKey;
                      const isDark =
                        settings.theme === 'dark' ||
                        (settings.theme === 'system' &&
                          typeof window !== 'undefined' &&
                          window.matchMedia('(prefers-color-scheme: dark)').matches);
                      const tokenSet = isDark ? pal.dark : pal.light;

                      return (
                        <label
                          key={paletteKey}
                          style={{
                            backgroundColor: tokenSet.surface,
                            borderColor: isSelected ? tokenSet.primary : tokenSet.outlineVariant,
                          }}
                          className={`p-2.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-1.5 relative text-left select-none ${
                            isSelected
                              ? 'shadow-sm ring-1 ring-current/15'
                              : 'hover:opacity-95 shadow-2xs'
                          }`}
                        >
                          <input
                            type="radio"
                            name="colorPalette"
                            value={paletteKey}
                            checked={isSelected}
                            onChange={() => handleColorPaletteChange(paletteKey)}
                            className="sr-only"
                          />

                          {/* Fila Superior: Muestra Circular + Nombre + Radio Button Canónico */}
                          <div className="flex items-center justify-between gap-1.5 w-full">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-5 h-5 rounded-full shrink-0 shadow-2xs ring-1 ring-black/10 dark:ring-white/15"
                                style={{ backgroundColor: tokenSet.primary }}
                              />
                              <span
                                className="text-xs font-extrabold truncate leading-tight"
                                style={{ color: tokenSet.onSurface }}
                              >
                                {pal.name}
                              </span>
                            </div>

                            {/* Indicador Visual de Radio Button (Selección Única) */}
                            <span
                              className="w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                              style={{
                                borderColor: isSelected ? tokenSet.primary : tokenSet.outline,
                              }}
                            >
                              {isSelected && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full animate-in zoom-in-75 duration-150"
                                  style={{ backgroundColor: tokenSet.primary }}
                                />
                              )}
                            </span>
                          </div>

                          {/* Fila Inferior Ultra-Compacta: Muestras de Superficie y Botones */}
                          <div className="flex items-center gap-1 w-full pt-0.5">
                            <span
                              className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold leading-none"
                              style={{
                                backgroundColor: tokenSet.primary,
                                color: tokenSet.onPrimary,
                              }}
                            >
                              Aceptar
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none"
                              style={{
                                backgroundColor: tokenSet.primaryContainer,
                                color: tokenSet.onPrimaryContainer,
                              }}
                            >
                              Cancelar
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded-md text-[9px] font-bold leading-none border ml-auto"
                              style={{
                                backgroundColor: tokenSet.cardBg,
                                color: tokenSet.onSurface,
                                borderColor: tokenSet.outlineVariant,
                              }}
                            >
                              Tarjeta
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Estudio de Papel Tapiz Adaptativo (Wallpaper Studio) */}
                <div className="pt-4 border-t border-[var(--color-md-outline-variant)] space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[var(--color-md-primary)]" />
                      <span className="text-xs font-bold text-[var(--color-md-on-surface)]">
                        Papel Tapiz del Fondo (Adaptativo al Tema)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateSettings({
                          ...settings,
                          wallpaperStyle: 'campus',
                          wallpaperOpacity: 16,
                          wallpaperScale: 100,
                          wallpaperBlur: 0,
                          wallpaperTintWithTheme: true,
                        });
                        onShowToast('Papel tapiz restablecido a valores por defecto');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-md-primary)] hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restaurar por defecto</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-[var(--color-md-on-surface-variant)] leading-snug">
                    Elige un diseño vectorial (se tiñe automáticamente con el color del tema elegido) o sube tu propia fotografía de fondo:
                  </p>

                  {/* Input oculto para subir foto */}
                  <input
                    ref={wallpaperInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCustomWallpaperUpload}
                    className="hidden"
                  />

                  {/* Galería de Estilos de Papel Tapiz */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(
                      [
                        { id: 'campus', label: 'Campus (Por defecto)', desc: 'Doodles de estudio' },
                        { id: 'blueprint', label: 'Plano Ingeniería', desc: 'Cuadrícula técnica' },
                        { id: 'constellation', label: 'Red de Nodos', desc: 'Constelación / Grafo' },
                        { id: 'topographic', label: 'Topográfico', desc: 'Ondas orgánicas' },
                        { id: 'dots', label: 'Puntos Minimal', desc: 'Bullet Journal' },
                        { id: 'custom', label: 'Mi Fotografía', desc: customWallpaperPreview ? 'Imagen cargada' : 'Subir imagen...' },
                        { id: 'none', label: 'Fondo Liso', desc: 'Sin papel tapiz' },
                      ] as { id: WallpaperStyle; label: string; desc: string }[]
                    ).map((item) => {
                      const currentStyle = settings.wallpaperStyle || 'campus';
                      const isSelected = currentStyle === item.id;
                      const previewPattern =
                        item.id !== 'custom' && item.id !== 'none'
                          ? getPatternMaskDataUri(item.id)
                          : null;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.id === 'custom' && !customWallpaperPreview) {
                              wallpaperInputRef.current?.click();
                              return;
                            }
                            updateSettings({ ...settings, wallpaperStyle: item.id });
                          }}
                          className={`p-2.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-2 text-left relative overflow-hidden group ${
                            isSelected
                              ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)]/35 shadow-sm'
                              : 'border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] hover:border-[var(--color-md-outline)]'
                          }`}
                        >
                          {/* Miniatura del patrón o foto */}
                          <div className="w-full h-14 rounded-xl bg-[var(--color-md-surface)] border border-[var(--color-md-outline-variant)]/60 relative overflow-hidden flex items-center justify-center">
                            {item.id === 'none' && (
                              <span className="text-[10px] font-bold text-[var(--color-md-on-surface-variant)]">
                                Color Sólido
                              </span>
                            )}
                            {item.id === 'custom' && (
                              customWallpaperPreview ? (
                                <img
                                  src={customWallpaperPreview}
                                  alt="Miniatura fondo"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-[var(--color-md-primary)]">
                                  <ImageIcon className="w-5 h-5" />
                                  <span className="text-[10px] font-bold">Elegir foto</span>
                                </div>
                              )
                            )}
                            {previewPattern && (
                              <div
                                style={{
                                  backgroundColor: 'var(--color-md-primary)',
                                  WebkitMaskImage: previewPattern.dataUri,
                                  maskImage: previewPattern.dataUri,
                                  WebkitMaskRepeat: 'repeat',
                                  maskRepeat: 'repeat',
                                  WebkitMaskSize: `${Math.round(previewPattern.baseSize * 0.45)}px`,
                                  maskSize: `${Math.round(previewPattern.baseSize * 0.45)}px`,
                                  opacity: 0.55,
                                }}
                                className="w-full h-full"
                              />
                            )}
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] flex items-center justify-center shadow-xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-[var(--color-md-on-surface)] block truncate">
                              {item.label}
                            </span>
                            <span className="text-[10px] text-[var(--color-md-on-surface-variant)] block truncate">
                              {item.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Acciones de Fotografía Personalizada */}
                  {(settings.wallpaperStyle === 'custom' || customWallpaperPreview) && (
                    <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[var(--color-md-surface-container)] border border-[var(--color-md-outline-variant)] flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ImageIcon className="w-4 h-4 text-[var(--color-md-primary)] shrink-0" />
                        <span className="text-xs font-bold text-[var(--color-md-on-surface)] truncate">
                          Fotografía personalizada de fondo
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => wallpaperInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          Cambiar foto
                        </button>
                        {customWallpaperPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveCustomWallpaper}
                            className="p-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Eliminar foto personalizada"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Controles de Opacidad, Tamaño y Desenfoque (visibles si el estilo no es 'none') */}
                  {(settings.wallpaperStyle || 'campus') !== 'none' && (
                    <div
                      data-no-swipe="true"
                      className="p-3.5 sm:p-4 rounded-2xl bg-[var(--color-md-surface-container)] border border-[var(--color-md-outline-variant)] space-y-4"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-md-on-surface)]">
                        <Sliders className="w-4 h-4 text-[var(--color-md-primary)]" />
                        <span>Ajustes de Intensidad, Tamaño y Efectos</span>
                      </div>

                      {/* 1. Control de Opacidad */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--color-md-on-surface-variant)]">
                            Opacidad / Visibilidad
                          </span>
                          <span className="font-mono font-extrabold text-[var(--color-md-primary)]">
                            {settings.wallpaperOpacity ?? 16}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={4}
                          max={90}
                          step={2}
                          value={settings.wallpaperOpacity ?? 16}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              wallpaperOpacity: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--color-md-primary)] cursor-pointer h-2 rounded-lg"
                        />
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-md-on-surface-variant)]">
                          <button
                            type="button"
                            onClick={() => updateSettings({ ...settings, wallpaperOpacity: 14 })}
                            className="hover:text-[var(--color-md-primary)] font-bold cursor-pointer"
                          >
                            Sutil (14%)
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSettings({ ...settings, wallpaperOpacity: 32 })}
                            className="hover:text-[var(--color-md-primary)] font-bold cursor-pointer"
                          >
                            Medio (32%)
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSettings({ ...settings, wallpaperOpacity: 60 })}
                            className="hover:text-[var(--color-md-primary)] font-bold cursor-pointer"
                          >
                            Intenso (60%)
                          </button>
                        </div>
                      </div>

                      {/* 2. Control de Tamaño / Escala */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--color-md-on-surface-variant)]">
                            Tamaño / Escala del Tapiz
                          </span>
                          <span className="font-mono font-extrabold text-[var(--color-md-primary)]">
                            {settings.wallpaperScale ?? 100}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={200}
                          step={5}
                          value={settings.wallpaperScale ?? 100}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              wallpaperScale: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--color-md-primary)] cursor-pointer h-2 rounded-lg"
                        />
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-md-on-surface-variant)]">
                          <button
                            type="button"
                            onClick={() => updateSettings({ ...settings, wallpaperScale: 70 })}
                            className="hover:text-[var(--color-md-primary)] font-bold cursor-pointer"
                          >
                            Pequeño (70%)
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSettings({ ...settings, wallpaperScale: 100 })}
                            className="hover:text-[var(--color-md-primary)] font-bold cursor-pointer"
                          >
                            Estándar (100%)
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSettings({ ...settings, wallpaperScale: 150 })}
                            className="hover:text-[var(--color-md-primary)] font-bold cursor-pointer"
                          >
                            Grande (150%)
                          </button>
                        </div>
                      </div>

                      {/* 3. Control de Desenfoque (Blur) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--color-md-on-surface-variant)]">
                            Desenfoque Suave (Blur)
                          </span>
                          <span className="font-mono font-extrabold text-[var(--color-md-primary)]">
                            {settings.wallpaperBlur ?? 0} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={16}
                          step={1}
                          value={settings.wallpaperBlur ?? 0}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              wallpaperBlur: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--color-md-primary)] cursor-pointer h-2 rounded-lg"
                        />
                      </div>

                      {/* 4. Tinte Adaptativo (Solo para Foto Personalizada) */}
                      {settings.wallpaperStyle === 'custom' && (
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-md-outline-variant)]/60">
                          <div>
                            <span className="text-xs font-bold text-[var(--color-md-on-surface)] block">
                              Fusionar foto con el color del tema
                            </span>
                            <span className="text-[11px] text-[var(--color-md-on-surface-variant)]">
                              Aplica un matiz cromático adaptativo sobre tu imagen
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateSettings({
                                ...settings,
                                wallpaperTintWithTheme: !(settings.wallpaperTintWithTheme ?? true),
                              })
                            }
                            className={`w-12 h-7 rounded-full transition-colors p-1 cursor-pointer ${
                              (settings.wallpaperTintWithTheme ?? true)
                                ? 'bg-[var(--color-md-primary)]'
                                : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                                (settings.wallpaperTintWithTheme ?? true)
                                  ? 'translate-x-5'
                                  : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {/* 5. Ventana de Previsualización en Vivo */}
                      <div className="pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-md-on-surface-variant)] block mb-1.5">
                          Vista previa en tiempo real
                        </span>
                        <div className="relative h-28 rounded-2xl bg-[var(--color-md-surface)] border border-[var(--color-md-outline-variant)] overflow-hidden flex items-center justify-center p-3 shadow-inner">
                          {/* Fondo simulado en vivo */}
                          {settings.wallpaperStyle === 'custom' && customWallpaperPreview ? (
                            <div
                              style={{
                                backgroundImage: `url("${customWallpaperPreview}")`,
                                backgroundSize:
                                  (settings.wallpaperScale ?? 100) <= 102
                                    ? 'cover'
                                    : `${settings.wallpaperScale ?? 100}%`,
                                backgroundPosition: 'center',
                                opacity: (settings.wallpaperOpacity ?? 16) / 100,
                                filter:
                                  (settings.wallpaperBlur ?? 0) > 0
                                    ? `blur(${settings.wallpaperBlur}px)`
                                    : undefined,
                              }}
                              className="absolute inset-0"
                            />
                          ) : (
                            settings.wallpaperStyle !== 'custom' &&
                            (() => {
                              const p = getPatternMaskDataUri(
                                (settings.wallpaperStyle || 'campus') as Exclude<
                                  WallpaperStyle,
                                  'custom' | 'none'
                                >
                              );
                              const sz = Math.max(
                                16,
                                Math.round(p.baseSize * ((settings.wallpaperScale ?? 100) / 100) * 0.65)
                              );
                              return (
                                <div
                                  style={{
                                    backgroundColor: 'var(--color-md-primary)',
                                    WebkitMaskImage: p.dataUri,
                                    maskImage: p.dataUri,
                                    WebkitMaskRepeat: 'repeat',
                                    maskRepeat: 'repeat',
                                    WebkitMaskSize: `${sz}px ${sz}px`,
                                    maskSize: `${sz}px ${sz}px`,
                                    opacity: (settings.wallpaperOpacity ?? 16) / 100,
                                    filter:
                                      (settings.wallpaperBlur ?? 0) > 0
                                        ? `blur(${settings.wallpaperBlur}px)`
                                        : undefined,
                                  }}
                                  className="absolute inset-0"
                                />
                              );
                            })()
                          )}

                          {/* Mini-tarjeta de ejemplo flotando sobre el papel tapiz */}
                          <div className="relative z-10 bg-[var(--color-md-card-bg)]/92 backdrop-blur-xs border border-[var(--color-md-outline-variant)] rounded-xl px-3.5 py-2 shadow-xs flex items-center gap-3 max-w-xs w-full">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] flex items-center justify-center font-black text-xs shrink-0">
                              AU
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-extrabold text-[var(--color-md-on-surface)] block truncate">
                                Ingeniería de Software
                              </span>
                              <span className="text-[10px] text-[var(--color-md-on-surface-variant)] block truncate">
                                Así lucen tus tarjetas sobre el tapiz
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-[var(--color-md-on-surface-variant)] leading-relaxed pt-1">
                  El tema, la paleta y el papel tapiz se guardan automáticamente en tu dispositivo y se aplican en tiempo real.
                </p>
              </div>
            )}

            {/* ---------------- SUB-VISTA 2: SEMESTRE Y HORARIO ---------------- */}
            {activeSubView === 'schedule' && (
              <div className="bg-[#FDFBFF] dark:bg-[#1D2024] rounded-[28px] p-4 sm:p-6 shadow-xs border border-[#C3C7D0]/50 dark:border-[#43474E]/40 space-y-5">
                {/* Periodo Lectivo */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
                    Periodo Lectivo / Semestre Actual
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={semesterInput}
                      onChange={(e) => setSemesterInput(e.target.value)}
                      placeholder="Ej. Semestre 2026-I, Otoño 2026"
                      className="flex-1 px-3.5 py-2.5 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-2xl text-sm font-semibold text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveSemester}
                      className="px-5 py-2.5 bg-[#00639B] hover:bg-[#005282] dark:bg-[#92CCFF] dark:hover:bg-[#72BAF5] text-white dark:text-[#003353] font-bold rounded-full text-xs transition-colors cursor-pointer shrink-0 shadow-xs"
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                {/* Vista Inicial */}
                <div className="space-y-2 pt-3 border-t border-[#C3C7D0]/30 dark:border-[#43474E]/30">
                  <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
                    Vista Predeterminada al Abrir Horario
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('weekly')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                        settings.defaultScheduleView === 'weekly'
                          ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border-[#00639B] dark:border-[#92CCFF] shadow-xs'
                          : 'bg-[#F1F4FA] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0] border-[#C3C7D0]/40 dark:border-[#43474E]/40 hover:border-[#72777F]'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Semanal (Cuadrícula)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('daily')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                        settings.defaultScheduleView === 'daily'
                          ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border-[#00639B] dark:border-[#92CCFF] shadow-xs'
                          : 'bg-[#F1F4FA] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0] border-[#C3C7D0]/40 dark:border-[#43474E]/40 hover:border-[#72777F]'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Por Día (Lista)</span>
                    </button>
                  </div>
                </div>

                {/* Días Lectivos */}
                <div className="space-y-2 pt-3 border-t border-[#C3C7D0]/30 dark:border-[#43474E]/30">
                  <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
                    Días de Cursada Visibles
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'mon-fri', label: 'Lun - Vie' },
                      { id: 'mon-sat', label: 'Lun - Sáb' },
                      { id: 'all', label: 'Toda la semana' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleVisibleDaysChange(item.id as AppSettings['visibleDays'])}
                        className={`py-2.5 px-1 rounded-2xl text-xs font-bold text-center transition-all cursor-pointer border ${
                          settings.visibleDays === item.id
                            ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border-[#00639B] dark:border-[#92CCFF] shadow-2xs'
                            : 'bg-[#F1F4FA] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0] border-[#C3C7D0]/40 dark:border-[#43474E]/40 hover:border-[#72777F]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- SUB-VISTA 3: NOTIFICACIONES ---------------- */}
            {activeSubView === 'notifications' && (
              <div className="bg-[#FDFBFF] dark:bg-[#1D2024] rounded-[28px] p-4 sm:p-6 shadow-xs border border-[#C3C7D0]/50 dark:border-[#43474E]/40 space-y-5">
                {/* Interruptor Principal */}
                <div className="flex items-center justify-between pb-3 border-b border-[#C3C7D0]/30 dark:border-[#43474E]/30">
                  <div>
                    <h3 className="text-sm font-bold text-[#191C20] dark:text-[#E2E2E6]">
                      Activar Recordatorios de Clases
                    </h3>
                    <p className="text-xs text-[#72777F] dark:text-[#8C9199]">
                      Recibe alertas locales en tu teléfono antes y al iniciar cada materia
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.notificationsEnabled}
                      onChange={(e) => handleToggleNotifications(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-13 h-7 bg-[#E2E7EF] dark:bg-[#272A2F] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:bg-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-[#72777F] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00639B] dark:peer-checked:bg-[#92CCFF] peer-checked:border-[#00639B]"></div>
                  </label>
                </div>

                {/* Estado de Permisos y Test */}
                <div className="p-3.5 bg-[#F1F4FA] dark:bg-[#272A2F] rounded-2xl border border-[#C3C7D0]/40 dark:border-[#43474E]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        hasPermission ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="font-semibold text-[#191C20] dark:text-[#E2E2E6]">
                      Permiso:{' '}
                      <strong className={hasPermission ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                        {hasPermission === null ? 'Comprobando...' : hasPermission ? 'Concedido' : 'Pendiente'}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!hasPermission && (
                      <button
                        type="button"
                        onClick={handleRequestPermission}
                        className="px-3.5 py-1.5 bg-[#00639B] hover:bg-[#005282] dark:bg-[#92CCFF] dark:text-[#003353] text-white font-bold rounded-full text-xs transition-colors cursor-pointer"
                      >
                        Conceder
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleTestNotification}
                      disabled={isTestingNotification}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-[#1D2024] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 hover:bg-[#E2E7EF] text-[#191C20] dark:text-[#E2E2E6] font-bold rounded-full text-xs transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
                      <span>Probar Aviso</span>
                    </button>
                  </div>
                </div>

                {/* Opciones Específicas */}
                <div
                  className={`space-y-2 pt-1 transition-opacity ${
                    settings.notificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#72777F] dark:text-[#8C9199] block">
                    Momentos de Notificación
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {/* 15 min antes */}
                    <button
                      type="button"
                      onClick={() => handleToggleSpecificNotification('notify15MinBefore')}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1 relative ${
                        settings.notify15MinBefore
                          ? 'bg-[#D0E4FF] dark:bg-[#004B76] border-[#00639B] dark:border-[#92CCFF] text-[#001D32] dark:text-[#D0E4FF]'
                          : 'bg-[#F1F4FA] dark:bg-[#272A2F] border-[#C3C7D0]/40 dark:border-[#43474E]/40 text-[#43474E] dark:text-[#C3C7D0]'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span className="font-bold text-xs">15 min antes</span>
                      {settings.notify15MinBefore && <Check className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF] stroke-[3]" />}
                    </button>

                    {/* Al iniciar */}
                    <button
                      type="button"
                      onClick={() => handleToggleSpecificNotification('notifyAtClassStart')}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1 relative ${
                        settings.notifyAtClassStart
                          ? 'bg-[#D0E4FF] dark:bg-[#004B76] border-[#00639B] dark:border-[#92CCFF] text-[#001D32] dark:text-[#D0E4FF]'
                          : 'bg-[#F1F4FA] dark:bg-[#272A2F] border-[#C3C7D0]/40 dark:border-[#43474E]/40 text-[#43474E] dark:text-[#C3C7D0]'
                      }`}
                    >
                      <Bell className="w-4 h-4" />
                      <span className="font-bold text-xs">Al iniciar</span>
                      {settings.notifyAtClassStart && <Check className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF] stroke-[3]" />}
                    </button>

                    {/* Sonido */}
                    <button
                      type="button"
                      onClick={() => handleToggleSpecificNotification('notificationSound')}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1 relative ${
                        settings.notificationSound
                          ? 'bg-[#D0E4FF] dark:bg-[#004B76] border-[#00639B] dark:border-[#92CCFF] text-[#001D32] dark:text-[#D0E4FF]'
                          : 'bg-[#F1F4FA] dark:bg-[#272A2F] border-[#C3C7D0]/40 dark:border-[#43474E]/40 text-[#43474E] dark:text-[#C3C7D0]'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span className="font-bold text-xs">Sonido</span>
                      {settings.notificationSound && <Check className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF] stroke-[3]" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- SUB-VISTA 4: FOTOGRAFÍAS Y PIZARRAS ---------------- */}
            {activeSubView === 'media' && (
              <div className="bg-[#FDFBFF] dark:bg-[#1D2024] rounded-[28px] p-4 sm:p-6 shadow-xs border border-[#C3C7D0]/50 dark:border-[#43474E]/40 space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
                    Resolución y Compresión de Capturas
                  </label>
                  <p className="text-xs text-[#72777F] dark:text-[#8C9199]">
                    Ajusta la calidad de compresión automática de las fotos tomadas en clase.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleImageQualityChange('balanced')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-start gap-1.5 text-left ${
                      settings.imageQuality === 'balanced'
                        ? 'bg-[#D0E4FF] dark:bg-[#004B76] border-[#00639B] dark:border-[#92CCFF] text-[#001D32] dark:text-[#D0E4FF]'
                        : 'bg-[#F1F4FA] dark:bg-[#272A2F] border-[#C3C7D0]/40 dark:border-[#43474E]/40 text-[#43474E] dark:text-[#C3C7D0] hover:border-[#72777F]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs sm:text-sm">Equilibrada (720p)</span>
                      {settings.imageQuality === 'balanced' && <Check className="w-4 h-4 text-[#00639B] dark:text-[#92CCFF] stroke-[3]" />}
                    </div>
                    <span className="text-[11px] text-[#72777F] dark:text-[#8C9199] leading-tight">
                      Ahorra más del 70% de espacio manteniendo fórmulas y texto nítidos. Recomendada.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleImageQualityChange('high')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-start gap-1.5 text-left ${
                      settings.imageQuality === 'high'
                        ? 'bg-[#D0E4FF] dark:bg-[#004B76] border-[#00639B] dark:border-[#92CCFF] text-[#001D32] dark:text-[#D0E4FF]'
                        : 'bg-[#F1F4FA] dark:bg-[#272A2F] border-[#C3C7D0]/40 dark:border-[#43474E]/40 text-[#43474E] dark:text-[#C3C7D0] hover:border-[#72777F]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs sm:text-sm">Alta Nitidez (1080p)</span>
                      {settings.imageQuality === 'high' && <Check className="w-4 h-4 text-[#00639B] dark:text-[#92CCFF] stroke-[3]" />}
                    </div>
                    <span className="text-[11px] text-[#72777F] dark:text-[#8C9199] leading-tight">
                      Mayor nivel de detalle para diapositivas con letra muy pequeña.
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* ---------------- SUB-VISTA 5: DATOS Y RESPALDOS ---------------- */}
            {activeSubView === 'backup' && (
              <BackupSection
                onShowToast={onShowToast}
                storageEstimate={storageEstimate}
                refreshStorageEstimate={refreshStorageEstimate}
              />
            )}

            {/* ---------------- SUB-VISTA 6: ACERCA DE LA AGENDA ---------------- */}
            {activeSubView === 'about' && (
              <div className="bg-[#FDFBFF] dark:bg-[#1D2024] rounded-[28px] p-5 sm:p-6 shadow-xs border border-[#C3C7D0]/50 dark:border-[#43474E]/40 space-y-4">
                <div className="flex items-center gap-3.5 pb-4 border-b border-[#C3C7D0]/30 dark:border-[#43474E]/30">
                  <img
                    src="/app-icon-claro.svg"
                    alt="Logo Agenda Universitaria"
                    className="w-14 h-14 rounded-2xl shadow-xs ring-2 ring-[#00639B]/30 object-contain bg-white p-1"
                  />
                  <div>
                    <h3 className="text-base font-black text-[#191C20] dark:text-[#E2E2E6]">
                      {APP_INFO.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D0E4FF] text-[#001D32] dark:bg-[#004B76] dark:text-[#D0E4FF]">
                        Versión {APP_INFO.version}
                      </span>
                      <span className="text-[11px] font-bold text-[#72777F] dark:text-[#8C9199]">
                        "{APP_INFO.slogan}"
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-[#43474E] dark:text-[#C3C7D0] leading-relaxed">
                  <div className="flex items-center gap-2 font-bold text-[#191C20] dark:text-[#E2E2E6]">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
                    <span>Desarrollada por {APP_INFO.author}</span>
                  </div>
                  <p className="text-[11px] text-[#72777F] dark:text-[#8C9199]">
                    {APP_INFO.description}
                  </p>
                </div>

                <div className="p-3.5 bg-[#F1F4FA] dark:bg-[#272A2F] rounded-2xl border border-[#C3C7D0]/40 dark:border-[#43474E]/40 text-[11px] text-[#43474E] dark:text-[#C3C7D0] space-y-1">
                  <span className="font-bold text-[#191C20] dark:text-[#E2E2E6] block">
                    Garantía Offline-First & Privacidad
                  </span>
                  <p>
                    Tus datos se almacenan exclusivamente de forma local en tu dispositivo utilizando IndexedDB (Dexie.js). No se requiere cuenta ni conexión a internet para gestionar tus materias y apuntes.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
