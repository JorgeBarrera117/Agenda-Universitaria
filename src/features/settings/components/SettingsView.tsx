import React, { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  BellRing,
  LockKeyhole,
  Clock,
  Calendar,
  Camera,
  Database,
  Info,
  Check,
  Save,
  Sparkles,
  Snowflake,
  Image as ImageIcon,
  Sliders,
  Trash2,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { useAppSettings } from '../hooks/useAppSettings';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { NotificationService } from '../../../shared/services/notificationService';
import { BackupSection } from './BackupSection';
import { BackupScheduleSettings } from './BackupScheduleSettings';
import { DeviceTransferCard } from '../../transfer/components/DeviceTransferCard';
import { GeneralSettings } from './GeneralSettings';
import { SecuritySettings } from '../../security/components/SecuritySettings';
import { isLockEnabled } from '../../security/services/appLockService';
import { applyTheme, paletteDisplayName } from '../../../shared/utils/theme';
import {
  getCustomWallpaperDataUrl,
  saveCustomWallpaperDataUrl,
} from '../../../shared/components/AppWallpaper';
import { getPatternMask, isPatternWallpaper, patternMaskSize } from '../../../shared/wallpapers/wallpaperPatterns';
import { WallpaperPicker } from './WallpaperPicker';
import { APP_INFO } from '../../../shared/constants/appInfo';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import { useExitTransition, MOTION_EXIT_MS } from '../../../shared/hooks/useExitTransition';
import { SettingsGroup, SettingsRow, M3Switch } from './SettingsPrimitives';
import { ScheduleSettings } from './ScheduleSettings';
import { NotificationSettings } from './NotificationSettings';
import { MediaSettings } from './MediaSettings';
import { AboutSettings } from './AboutSettings';
import { ChangelogList, ChangelogPreview } from './ChangelogSettings';
import { UpdateSettings } from './UpdateSettings';
import { getLastUpdateCheck, UPDATE_CHECK_EVENT, type UpdateCheckResult } from '../../../shared/services/updateService';
import { PageHeader, PAGE_HEADER_PRIMARY_BUTTON } from '../../../shared/components/PageHeader';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { IMAGE_ACCEPT, SUPPORTED_IMAGE_FORMATS_LABEL, toBrowserReadableImage } from '../../../shared/utils/imageFormats';
import { StudentCredential } from './StudentCredential';
import { CardStyleSection, ThemeColorSection } from './ThemeStudio';
import { StudentProfileForm, type ProfileFields } from './StudentProfileForm';
import type { AppSettings, CardSurfaceStyle, CustomPaletteSettings, MaterialColorTheme } from '../types';

export type SettingsCategory =
  | 'appearance'
  | 'schedule'
  | 'notifications'
  | 'media'
  | 'backup'
  | 'about'
  | 'changelog'
  | 'profile'
  | 'general'
  | 'security';

interface SettingsViewProps {
  onBack: () => void;
  onShowToast: (message: string) => void;
  /** Sub-página con la que abrir Ajustes (p. ej. las novedades desde el aviso "Lo nuevo"). */
  initialSubView?: SettingsCategory;
}

const SUBVIEW_TITLES: Record<SettingsCategory, string> = {
  appearance: 'Apariencia y tema',
  schedule: 'Semestre y horario',
  notifications: 'Notificaciones y avisos',
  media: 'Fotografías y pizarras',
  backup: 'Datos y copias de seguridad',
  about: 'Acerca de la agenda',
  changelog: 'Novedades de la versión',
  profile: 'Mi perfil',
  general: 'General',
  security: 'Bloqueo de la app',
};

const CARD_SURFACE_OPTIONS: { id: CardSurfaceStyle; label: string; description: string }[] = [
  { id: 'solid', label: 'Elevada', description: 'Sin borde, con sombra suave' },
  { id: 'glass', label: 'Cristal', description: 'Translúcido sobre el papel tapiz' },
  { id: 'bordered', label: 'Con borde', description: 'Plana, con contorno marcado' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  onBack,
  onShowToast,
  initialSubView,
}) => {
  const { settings, updateSettings, storageEstimate, refreshStorageEstimate } = useAppSettings();
  const { subjects } = useSubjects();
  const { slots } = useSchedule();

  const [activeSubView, setActiveSubView] = useState<SettingsCategory | null>(initialSubView ?? null);
  // Último resultado de la comprobación de versiones (la del arranque o la manual de la subvista)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(() => getLastUpdateCheck());
  useEffect(() => {
    const onChecked = (event: Event) => setUpdateResult((event as CustomEvent<UpdateCheckResult>).detail);
    window.addEventListener(UPDATE_CHECK_EVENT, onChecked);
    return () => window.removeEventListener(UPDATE_CHECK_EVENT, onChecked);
  }, []);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  // Sincronización de estado durante render sin efectos en cascada
  const [prevSemesterName, setPrevSemesterName] = useState(settings.semesterName);
  const [semesterInput, setSemesterInput] = useState(settings.semesterName);
  // Controles finos del papel tapiz (opacidad, escala, desenfoque): plegados al entrar
  const [wallpaperTuneOpen, setWallpaperTuneOpen] = useState(false);
  if (settings.semesterName !== prevSemesterName) {
    setPrevSemesterName(settings.semesterName);
    setSemesterInput(settings.semesterName);
  }

  const [customWallpaperPreview, setCustomWallpaperPreview] = useState<string | null>(() =>
    getCustomWallpaperDataUrl()
  );
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  // Procesar y comprimir foto de papel tapiz seleccionada por el usuario
  const handleCustomWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const original = e.target.files?.[0];
    e.target.value = '';
    if (!original) return;

    // Las fotos HEIC (iPhone, Samsung) se pasan antes a JPEG: el navegador no las abre
    let file: File;
    try {
      file = await toBrowserReadableImage(original);
    } catch {
      onShowToast(`No se pudo abrir esa foto. Prueba con otra (${SUPPORTED_IMAGE_FORMATS_LABEL}).`);
      return;
    }

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
  };

  const handleRemoveCustomWallpaper = () => {
    saveCustomWallpaperDataUrl(null);
    setCustomWallpaperPreview(null);
    updateSettings({ ...settings, wallpaperStyle: 'campus', wallpaperOpacity: 16 });
    onShowToast('Foto eliminada. Papel tapiz universitario restaurado.');
  };

  // Sincronizar permisos y almacenamiento de forma asíncrona y segura
  useEffect(() => {
    void refreshStorageEstimate();
    void NotificationService.checkPermissions().then(setHasPermission);
  }, [refreshStorageEstimate]);

  // Volver de una subvista al menú con animación de salida (sin corte a 0 ms)
  const subViewExit = useExitTransition(MOTION_EXIT_MS.sheet);
  const closeSubView = () => subViewExit.runExit(() => setActiveSubView(null));
  // Mi perfil: cambios sin guardar y el aviso antes de salir
  const [profileDirty, setProfileDirty] = useState(false);
  const [confirmLeaveProfile, setConfirmLeaveProfile] = useState(false);
  /**
   * Salir de la subpágina:
   * - Las novedades cuelgan de "Acerca de la agenda": volver lleva ahí.
   * - Si Ajustes se abrió directo en esta subpágina (la foto de la barra superior o el aviso de
   *   respaldo), volver regresa a donde estaba el estudiante, no al menú de Ajustes.
   */
  const leaveSubView = () => {
    if (activeSubView === 'changelog') setActiveSubView('about');
    else if (initialSubView && activeSubView === initialSubView) onBack();
    else closeSubView();
  };
  const backFromSubView = () => {
    if (activeSubView === 'profile' && profileDirty) {
      setConfirmLeaveProfile(true);
      return;
    }
    leaveSubView();
  };

  // Interceptar botón "Atrás" de Android / Navegador
  useBackButton(() => {
    if (activeSubView !== null) {
      backFromSubView();
      return true;
    }
    onBack();
    return true;
  }, BACK_PRIORITY.SETTINGS);

  // Manejador de cambio de tema instantáneo (Modo Claro / Oscuro / Sistema)
  const handleThemeChange = (newTheme: AppSettings['theme']) => {
    applyTheme(newTheme, settings.colorPalette, settings.customPalette);
    updateSettings({ ...settings, theme: newTheme });
    onShowToast(`Tema cambiado a: ${newTheme === 'dark' ? 'Oscuro' : newTheme === 'light' ? 'Claro' : 'Automático'}`);
  };

  // Manejador de cambio de paleta dinámica Material You
  const handleColorPaletteChange = (newPalette: MaterialColorTheme) => {
    applyTheme(settings.theme, newPalette, settings.customPalette);
    updateSettings({ ...settings, colorPalette: newPalette });
    onShowToast(`Paleta de color actualizada: ${paletteDisplayName(newPalette)}`);
  };

  // Paleta propia creada en Temas: se guarda ya calculada y queda seleccionada
  const handleCustomPaletteApply = (customPalette: CustomPaletteSettings) => {
    applyTheme(settings.theme, 'custom', customPalette);
    updateSettings({ colorPalette: 'custom', customPalette });
    onShowToast('Tu paleta está aplicada.');
  };

  const handlePerformanceModeChange = (performanceMode: boolean) => {
    updateSettings({ ...settings, performanceMode, performanceModeChosen: true });
    onShowToast(performanceMode ? 'Modo Ultra Fluidez activado.' : 'Modo Ultra Fluidez desactivado.');
  };

  const handleCardSurfaceChange = (cardSurfaceStyle: CardSurfaceStyle) => {
    updateSettings({ ...settings, cardSurfaceStyle });
    const option = CARD_SURFACE_OPTIONS.find((o) => o.id === cardSurfaceStyle);
    onShowToast(`Acabado de tarjetas: ${option?.label ?? cardSurfaceStyle}`);
  };

  const handleSaveProfile = (profile: ProfileFields) => {
    updateSettings({ ...settings, ...profile });
    setProfileDirty(false);
    setConfirmLeaveProfile(false);
    leaveSubView();
    onShowToast(profile.studentName ? `Perfil guardado. ¡Hola, ${profile.studentName.split(/\s+/)[0]}!` : 'Perfil guardado.');
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
      onShowToast(res.scheduledCount > 0 ? `${res.scheduledCount} recordatorios programados en este dispositivo.` : 'Recordatorios activados.');
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
      await NotificationService.sendTestNotification(settings);
    } else {
      onShowToast('Permiso de notificaciones denegado en el sistema.');
    }
  };

  // Probar notificación
  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    try {
      const sent = await NotificationService.sendTestNotification(settings);
      if (sent) {
        onShowToast('Notificación de prueba enviada a tu dispositivo.');
      } else {
        onShowToast('Debes conceder permisos de notificación en este dispositivo.');
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
    settings.defaultScheduleView === 'auto' ? 'Vista automática' : settings.defaultScheduleView === 'weekly' ? 'Semana' : 'Por día';

  // El estado del bloqueo vive aparte de los ajustes: se relee al volver al menú principal
  const lockActive = activeSubView === null && isLockEnabled();

  const visibleDaysLabel =
    settings.visibleDays === 'mon-fri' ? 'Lun - Vie' : settings.visibleDays === 'mon-sat' ? 'Lun - Sáb' : 'Toda la semana';

  return (
    <div className="glass-legible relative min-h-screen text-[var(--color-md-on-surface)] pb-16 m3-view-enter">
      {/* En PC, columna de 768 px centrada (como fichas y formularios): las filas no se estiran */}
      <div className="w-full max-w-3xl mx-auto pt-1 sm:pt-3 space-y-3">

        {/* =========================================================================
            VISTA 1: MENÚ PRINCIPAL COMPACTO DE AJUSTES (ESTILO TELEGRAM / WHATSAPP)
           ========================================================================= */}
        {activeSubView === null ? (
          <div className="space-y-3 m3-tab-enter-left">
            {/* Cabecera fija al hacer scroll */}
            <PageHeader
              titleAs="h1"
              title="Ajustes"
              subtitle="Preferencias globales de la aplicación"
              onBack={onBack}
              backLabel="Volver a la Agenda"
            />

            {/* Tarjeta "Mi perfil": abre el perfil (foto, nombre, carrera, meta y estado) */}
            <StudentCredential
              settings={settings}
              appVersion={APP_INFO.version}
              onEdit={() => setActiveSubView('profile')}
            />

            <SettingsGroup title="Preferencias de estudio">
              <SettingsRow
                icon={settings.theme === 'dark' ? <Moon className="h-4 w-4" /> : settings.theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                title="Apariencia y tema"
                subtitle={`${themeLabel} · ${paletteDisplayName(settings.colorPalette || 'default')}`}
                onClick={() => setActiveSubView('appearance')}
              />
              <SettingsRow
                icon={<Calendar className="h-4 w-4" />}
                title="Semestre y horario"
                subtitle={`${settings.semesterName || 'Configurar periodo'} · ${scheduleViewLabel}`}
                value={visibleDaysLabel}
                onClick={() => setActiveSubView('schedule')}
              />
            </SettingsGroup>

            <SettingsGroup title="Notificaciones y medios">
              <SettingsRow
                icon={<BellRing className="h-4 w-4" />}
                title="Notificaciones y avisos"
                subtitle="Recordatorios antes de cada clase"
                value={settings.notificationsEnabled ? 'Activas' : 'Desactivadas'}
                valueTone={settings.notificationsEnabled ? 'active' : 'neutral'}
                onClick={() => setActiveSubView('notifications')}
              />
              <SettingsRow
                icon={<Camera className="h-4 w-4" />}
                title="Fotografías y pizarras"
                subtitle="Compresión y nitidez de las capturas"
                value={settings.imageQuality === 'balanced' ? '720p' : '1080p'}
                onClick={() => setActiveSubView('media')}
              />
            </SettingsGroup>

            <SettingsGroup title="Sistema">
              <SettingsRow
                icon={<Clock className="h-4 w-4" />}
                title="General"
                subtitle={
                  window.electronAPI?.getLaunchAtLogin
                    ? 'Tamaño del texto, formato de hora e inicio con Windows'
                    : 'Tamaño del texto y formato de hora'
                }
                value={settings.timeFormat === '12h' ? '12 h' : '24 h'}
                onClick={() => setActiveSubView('general')}
              />
              <SettingsRow
                icon={<LockKeyhole className="h-4 w-4" />}
                title="Bloqueo de la app"
                subtitle="PIN o huella al abrir la agenda"
                value={lockActive ? 'Activo' : 'Apagado'}
                valueTone={lockActive ? 'active' : 'neutral'}
                onClick={() => setActiveSubView('security')}
              />
            </SettingsGroup>

            <SettingsGroup title="Datos y app">
              <SettingsRow
                icon={<Database className="h-4 w-4" />}
                title="Datos y copias de seguridad"
                subtitle="Exportar e importar el respaldo JSON"
                value={typeof storageEstimate.usedMB === 'number' ? `${storageEstimate.usedMB.toFixed(1)} MB` : 'Local'}
                onClick={() => setActiveSubView('backup')}
              />
              {/* Las actualizaciones viven dentro de "Acerca de": si hay una versión nueva (p. ej.
                  porque se pospuso el aviso), la fila lo indica con la insignia */}
              <SettingsRow
                icon={updateResult?.status === 'available' ? <Sparkles className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                title="Acerca de la agenda"
                subtitle={
                  updateResult?.status === 'available'
                    ? `Nueva versión ${updateResult.info.latestVersion} disponible`
                    : 'Versión, actualizaciones y créditos'
                }
                value={updateResult?.status === 'available' ? 'Nueva' : `v${APP_INFO.version}`}
                valueTone={updateResult?.status === 'available' ? 'active' : 'neutral'}
                onClick={() => setActiveSubView('about')}
              />
            </SettingsGroup>
          </div>
        ) : (
          /* =========================================================================
             VISTA 2: SUB-PÁGINAS DEDICADAS (FOCALIZADAS, LIMPIAS Y COMPACTAS)
             ========================================================================= */
          <div className={`space-y-3 ${subViewExit.isClosing ? 'm3-sheet-exit' : 'm3-tab-enter-right'}`}>
            {/* Cabecera de la sub-página, fija al hacer scroll */}
            <PageHeader
              title={SUBVIEW_TITLES[activeSubView]}
              subtitle={activeSubView === 'changelog' ? 'Acerca de la agenda' : 'Ajustes'}
              onBack={backFromSubView}
              backLabel={activeSubView === 'changelog' ? 'Regresar a Acerca de la agenda' : 'Regresar a Ajustes'}
              actions={
                activeSubView === 'profile' ? (
                  <button type="submit" form="student-profile-form" disabled={!profileDirty} className={PAGE_HEADER_PRIMARY_BUTTON}>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Guardar
                  </button>
                ) : undefined
              }
            />

            {/* ---------------- SUB-VISTA 1: APARIENCIA ---------------- */}
            {activeSubView === 'appearance' && (
              <div className="space-y-4">
                {/* 1. Color: modo de luminosidad y paleta */}
                <SettingsGroup title="Color">
                  <div className="p-3.5 sm:p-5">
                    <ThemeColorSection
                      settings={settings}
                      onThemeChange={handleThemeChange}
                      onPaletteChange={handleColorPaletteChange}
                      onCustomPaletteApply={handleCustomPaletteApply}
                    />
                  </div>
                </SettingsGroup>

                {/* 2. Fondo: papel tapiz adaptativo */}
                <SettingsGroup title="Fondo">
                <div className="p-3.5 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--color-md-primary)]" />
                      <span className="text-xs font-bold text-[var(--color-md-on-surface)]">
                        Papel Tapiz Adaptativo
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
                      className="inline-flex items-center gap-1 text-11px font-bold text-[var(--color-md-primary)] hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Por defecto</span>
                    </button>
                  </div>

                  {/* Input oculto para subir foto */}
                  <input
                    ref={wallpaperInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    onChange={(e) => void handleCustomWallpaperUpload(e)}
                    className="hidden"
                  />

                  {/* Galería por categorías (ver WallpaperPicker y wallpaperPatterns.ts) */}
                  <WallpaperPicker
                    value={settings.wallpaperStyle || 'campus'}
                    onChange={(wallpaperStyle) => updateSettings({ ...settings, wallpaperStyle })}
                    customPreview={customWallpaperPreview}
                    onRequestUpload={() => wallpaperInputRef.current?.click()}
                  />

                  {/* Decoración de temporada: Navidad (1–30 dic) y Año Nuevo (31 dic–31 ene), ver shared/seasons */}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Snowflake className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">Decoración de temporada</span>
                        <span className="block text-xs leading-snug text-[var(--color-md-on-surface-variant)]">
                          Navidad (1–30 dic) con nieve, y Año Nuevo (31 dic–31 ene) con fuegos artificiales y el año viejo.
                        </span>
                      </span>
                    </span>
                    <M3Switch
                      checked={settings.seasonalDecorations !== false}
                      onChange={(seasonalDecorations) => updateSettings({ ...settings, seasonalDecorations })}
                      label="Decoración de temporada"
                    />
                  </div>

                  {/* Acciones de Fotografía Personalizada */}
                  {(settings.wallpaperStyle === 'custom' || customWallpaperPreview) && (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--color-md-surface-container)] border border-[var(--color-md-outline-variant)] flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <ImageIcon className="w-3.5 h-3.5 text-[var(--color-md-primary)] shrink-0" />
                        <span className="text-xs font-bold text-[var(--color-md-on-surface)] truncate">
                          Foto personalizada de fondo
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => wallpaperInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          Cambiar
                        </button>
                        {customWallpaperPreview && (
                          <button
                            type="button"
                            onClick={handleRemoveCustomWallpaper}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-md-on-surface-variant)] transition-all duration-150 ease-out hover:bg-[var(--color-md-surface-container-high)] hover:text-[var(--color-md-on-surface)] active:scale-95"
                            aria-label="Eliminar foto personalizada"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Controles de Opacidad, Tamaño y Desenfoque */}
                  {(settings.wallpaperStyle || 'campus') !== 'none' && (
                    <div className="rounded-xl sm:rounded-2xl bg-[var(--color-md-surface-container)] border border-[var(--color-md-outline-variant)]">
                    <button
                      type="button"
                      onClick={() => setWallpaperTuneOpen((open) => !open)}
                      aria-expanded={wallpaperTuneOpen}
                      aria-controls="wallpaper-tune-panel"
                      className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-xs font-bold text-[var(--color-md-on-surface)]">Ajustar fondo</span>
                      <span className="text-11px font-semibold text-[var(--color-md-on-surface-variant)]">
                        Intensidad {settings.wallpaperOpacity ?? 16}%
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)] transition-transform duration-200 ${wallpaperTuneOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    {wallpaperTuneOpen && (
                    <div
                      id="wallpaper-tune-panel"
                      data-no-swipe="true"
                      className="space-y-3 border-t border-[var(--color-md-outline-variant)] p-3"
                    >

                      {/* 1. Intensidad del fondo: de casi invisible (4 %) a máxima (100 %). Para nada
                          de dibujo está "Fondo liso" en la galería. */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <label htmlFor="wallpaper-intensity" className="font-semibold text-[var(--color-md-on-surface-variant)] text-xs">
                            Intensidad del fondo
                          </label>
                          <span className="font-mono font-extrabold text-[var(--color-md-primary)] text-xs">
                            {settings.wallpaperOpacity ?? 16}%
                          </span>
                        </div>
                        <input
                          id="wallpaper-intensity"
                          type="range"
                          min={4}
                          max={100}
                          step={2}
                          value={settings.wallpaperOpacity ?? 16}
                          onChange={(e) =>
                            updateSettings({
                              ...settings,
                              wallpaperOpacity: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--color-md-primary)] cursor-pointer h-1.5 rounded-lg"
                        />
                        <div className="flex justify-between text-10px text-[var(--color-md-on-surface-variant)]" aria-hidden="true">
                          <span>4%</span>
                          <span>100%</span>
                        </div>
                        {/* Atajos (chips M3): se marcan cuando coinciden con el valor actual */}
                        <div role="group" aria-label="Atajos de intensidad" className="flex flex-wrap gap-1.5">
                          {[
                            { label: 'Sutil', value: 14 },
                            { label: 'Medio', value: 32 },
                            { label: 'Intenso', value: 60 },
                            { label: 'Máximo', value: 100 },
                          ].map((preset) => {
                            const selected = (settings.wallpaperOpacity ?? 16) === preset.value;
                            return (
                              <button
                                key={preset.value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => updateSettings({ ...settings, wallpaperOpacity: preset.value })}
                                className={`inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.98] ${
                                  selected
                                    ? 'border-transparent bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]'
                                    : 'border-[var(--color-md-outline-variant)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-on-surface)]/[0.06]'
                                }`}
                              >
                                {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                {preset.label} · {preset.value}%
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Control de Tamaño / Escala */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--color-md-on-surface-variant)] text-11px">
                            Escala del Patrón
                          </span>
                          <span className="font-mono font-extrabold text-[var(--color-md-primary)] text-xs">
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
                          className="w-full accent-[var(--color-md-primary)] cursor-pointer h-1.5 rounded-lg"
                        />
                      </div>

                      {/* 3. Control de Desenfoque (Blur) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--color-md-on-surface-variant)] text-11px">
                            Desenfoque Suave (Blur)
                          </span>
                          <span className="font-mono font-extrabold text-[var(--color-md-primary)] text-xs">
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
                          className="w-full accent-[var(--color-md-primary)] cursor-pointer h-1.5 rounded-lg"
                        />
                      </div>

                      {/* 4. Tinte Adaptativo */}
                      {settings.wallpaperStyle === 'custom' && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-[var(--color-md-outline-variant)]/60">
                          <div>
                            <span className="text-xs font-bold text-[var(--color-md-on-surface)] block">
                              Fusionar foto con tema
                            </span>
                            <span className="text-10px text-[var(--color-md-on-surface-variant)]">
                              Aplica matiz armónico sobre tu imagen
                            </span>
                          </div>
                          <M3Switch
                            checked={settings.wallpaperTintWithTheme ?? true}
                            onChange={(checked) => updateSettings({ ...settings, wallpaperTintWithTheme: checked })}
                            label="Fusionar foto con el tema"
                          />
                        </div>
                      )}

                      {/* 5. Ventana de Previsualización en Vivo */}
                      <div className="pt-1">
                        <span className="text-xs font-semibold text-[var(--color-md-on-surface-variant)] block mb-1">
                          Vista previa en tiempo real
                        </span>
                        <div className="relative h-20 sm:h-22 rounded-xl bg-[var(--color-md-surface)] border border-[var(--color-md-outline-variant)] overflow-hidden flex items-center justify-center p-2.5 shadow-inner">
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
                              const style = settings.wallpaperStyle || 'campus';
                              if (!isPatternWallpaper(style)) return null;
                              const p = getPatternMask(style);
                              const sz = patternMaskSize(p, ((settings.wallpaperScale ?? 100) / 100) * 0.55);
                              return (
                                <div
                                  style={{
                                    backgroundColor: 'var(--color-md-primary)',
                                    WebkitMaskImage: p.dataUri,
                                    maskImage: p.dataUri,
                                    WebkitMaskRepeat: 'repeat',
                                    maskRepeat: 'repeat',
                                    WebkitMaskSize: sz,
                                    maskSize: sz,
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

                          {/* Mini-tarjeta de ejemplo */}
                          <div className="relative z-10 bg-[var(--color-md-card-bg)]/92 backdrop-blur-xs border border-[var(--color-md-outline-variant)] rounded-lg px-2.5 py-1.5 shadow-xs flex items-center gap-2 max-w-xs w-full">
                            <div className="w-6 h-6 rounded-md bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] flex items-center justify-center font-black text-10px shrink-0">
                              AU
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-extrabold text-[var(--color-md-on-surface)] block truncate">
                                Ingeniería de Software
                              </span>
                              <span className="text-9px text-[var(--color-md-on-surface-variant)] block truncate">
                                Tarjeta sobre el tapiz
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                    </div>
                  )}
                </div>
                </SettingsGroup>

                {/* 3. Tarjetas y rendimiento */}
                <SettingsGroup title="Tarjetas y rendimiento">
                  <div className="p-3.5 sm:p-5">
                    <CardStyleSection
                      settings={settings}
                      onCardSurfaceChange={handleCardSurfaceChange}
                      onPerformanceModeChange={handlePerformanceModeChange}
                    />
                  </div>
                </SettingsGroup>

                <p className="px-1 text-11px text-[var(--color-md-on-surface-variant)] leading-snug">
                  Todo se guarda en este dispositivo y se aplica al instante.
                </p>
              </div>
            )}

            {/* ---------------- SUB-VISTA 2: SEMESTRE Y HORARIO ---------------- */}
            {activeSubView === 'profile' && (
              <StudentProfileForm
                initialValues={{
                  studentName: settings.studentName,
                  careerName: settings.careerName,
                  semesterGoal: settings.semesterGoal,
                  studentAvatarUrl: settings.studentAvatarUrl,
                  studentStatusMode: settings.studentStatusMode,
                  studentCustomStatus: settings.studentCustomStatus,
                }}
                onSave={handleSaveProfile}
                formId="student-profile-form"
                onDirtyChange={setProfileDirty}
              />
            )}

            {activeSubView === 'schedule' && (
              <ScheduleSettings
                settings={settings}
                semesterInput={semesterInput}
                onSemesterInputChange={setSemesterInput}
                onSaveSemester={handleSaveSemester}
                onViewModeChange={handleViewModeChange}
                onVisibleDaysChange={handleVisibleDaysChange}
                onShowToast={onShowToast}
              />
            )}

            {/* ---------------- SUB-VISTA 3: NOTIFICACIONES ---------------- */}
            {activeSubView === 'notifications' && (
              <NotificationSettings
                settings={settings}
                hasPermission={hasPermission}
                isTesting={isTestingNotification}
                onToggleNotifications={(enabled) => void handleToggleNotifications(enabled)}
                onToggleSpecific={(key) => void handleToggleSpecificNotification(key)}
                onRequestPermission={() => void handleRequestPermission()}
                onTestNotification={() => void handleTestNotification()}
                onUpdate={(partial) => updateSettings(partial)}
              />
            )}

            {/* ---------------- SUB-VISTA 4: FOTOGRAFÍAS Y PIZARRAS ---------------- */}
            {activeSubView === 'media' && (
              <MediaSettings imageQuality={settings.imageQuality} onImageQualityChange={handleImageQualityChange} />
            )}

            {/* ---------------- SUB-VISTA 5: DATOS Y RESPALDOS ---------------- */}
            {activeSubView === 'general' && <GeneralSettings />}

            {activeSubView === 'security' && <SecuritySettings onShowToast={onShowToast} />}

            {activeSubView === 'backup' && <DeviceTransferCard onShowToast={onShowToast} />}
            {activeSubView === 'backup' && <BackupScheduleSettings />}
            {activeSubView === 'backup' && (
              <BackupSection
                onShowToast={onShowToast}
                storageEstimate={storageEstimate}
                refreshStorageEstimate={refreshStorageEstimate}
              />
            )}

            {/* ---------------- SUB-VISTA 6: ACERCA DE LA AGENDA (con actualizaciones) ---------------- */}
            {activeSubView === 'about' && (
              <>
                <AboutSettings />
                <ChangelogPreview onOpenAll={() => setActiveSubView('changelog')} />
                <UpdateSettings initialResult={updateResult} onResult={setUpdateResult} onShowToast={onShowToast} />
              </>
            )}

            {/* ---------------- SUB-VISTA 7: NOVEDADES DE LA VERSIÓN ---------------- */}
            {activeSubView === 'changelog' && <ChangelogList />}
          </div>
        )}
      </div>

      {/* Mi perfil: salir con cambios sin guardar */}
      <Modal isOpen={confirmLeaveProfile} onClose={() => setConfirmLeaveProfile(false)} title="¿Salir sin guardar?" maxWidth="sm">
        <p className="text-sm text-[var(--color-md-on-surface-variant)]">
          Cambiaste tu perfil y aún no lo guardaste. Si sales ahora, se perderán esos cambios.
        </p>
        <ModalActions>
          <Button variant="ghost" size="sm" onClick={() => setConfirmLeaveProfile(false)}>
            Seguir editando
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setConfirmLeaveProfile(false);
              setProfileDirty(false);
              leaveSubView();
            }}
          >
            Salir sin guardar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Save className="h-4 w-4" aria-hidden="true" />}
            onClick={() => {
              const form = document.getElementById('student-profile-form');
              if (form instanceof HTMLFormElement) form.requestSubmit();
            }}
          >
            Guardar y salir
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
};
