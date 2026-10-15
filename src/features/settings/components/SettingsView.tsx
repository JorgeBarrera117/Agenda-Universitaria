import React, { useRef, useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Clock,
  Volume2,
  HardDrive,
  Calendar,
  Camera,
  ShieldCheck,
  Check,
  RefreshCw,
  Sparkles,
  Layers,
  Download,
  Upload,
  Send,
  Smartphone,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAppSettings } from '../hooks/useAppSettings';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { NotificationService } from '../../../shared/services/notificationService';
import { exportDatabaseBackup, importDatabaseBackup } from '../../../shared/utils/backup';
import { applyTheme } from '../../../shared/utils/theme';
import type { AppSettings } from '../types';


interface SettingsViewProps {
  onBack: () => void;
  onShowToast: (message: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onBack,
  onShowToast,
}) => {
  const { settings, updateSettings, storageEstimate, refreshStorageEstimate } = useAppSettings();
  const { subjects } = useSubjects();
  const { slots } = useSchedule();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  // Sincronizar borrador al cargar
  useEffect(() => {
    setDraftSettings(settings);
    refreshStorageEstimate();
    NotificationService.checkPermissions().then(setHasPermission);
  }, [settings]);

  // Manejar solicitud de permisos
  const handleRequestPermission = async () => {
    const granted = await NotificationService.requestPermissions();
    setHasPermission(granted);
    if (granted) {
      onShowToast('¡Permiso de notificaciones concedido con éxito!');
      await NotificationService.sendTestNotification();
    } else {
      onShowToast('Permiso de notificaciones denegado en el sistema.');
    }
  };

  // Enviar notificación de prueba
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

  // Guardar y aplicar ajustes
  const handleSaveAndApply = async () => {
    updateSettings(draftSettings);

    // Sincronizar notificaciones de horario inmediatamente
    if (draftSettings.notificationsEnabled) {
      const res = await NotificationService.syncScheduleNotifications(
        slots,
        subjects,
        draftSettings
      );
      if (res.scheduledCount > 0) {
        onShowToast(`Ajustes guardados. ${res.scheduledCount} recordatorios programados en tu celular.`);
      } else {
        onShowToast('Ajustes guardados y aplicados correctamente.');
      }
    } else {
      await NotificationService.syncScheduleNotifications(slots, subjects, draftSettings);
      onShowToast('Ajustes guardados. Recordatorios desactivados.');
    }

    onBack();
  };

  // Exportar respaldo JSON
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportDatabaseBackup();
      onShowToast('Copia de seguridad del semestre exportada con éxito.');
    } catch {
      onShowToast('Error al exportar la copia de seguridad.');
    } finally {
      setIsExporting(false);
    }
  };

  // Importar respaldo JSON
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await importDatabaseBackup(file);
      onShowToast('Datos del semestre restaurados correctamente.');
      await refreshStorageEstimate();
    } catch (err: unknown) {
      if (err instanceof Error) {
        onShowToast(err.message);
      } else {
        onShowToast('Error al restaurar los datos.');
      }
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative min-h-screen text-slate-800 dark:text-slate-100 pb-16 animate-in fade-in duration-200">
      {/* 1. Botón Flotante Superior Izquierdo para Volver */}
      <button
        type="button"
        onClick={onBack}
        title="Regresar"
        className="fixed top-3 left-3 sm:top-5 sm:left-6 z-40 w-11 h-11 flex items-center justify-center text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white bg-white/95 hover:bg-white dark:bg-slate-900/95 dark:hover:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer ring-1 ring-slate-900/5 dark:ring-white/10 hover:shadow-lg"
      >
        <ArrowLeft className="w-5 h-5 text-cove-blue dark:text-cove-sky" />
      </button>

      {/* 2. Contenedor Central con Espacio Amplio */}
      <div className="max-w-4xl mx-auto pt-14 sm:pt-4 px-2 sm:px-4 space-y-6">
        {/* Cabecera Principal */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
          <div className="pl-1 sm:pl-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-cove-blue/10 dark:bg-cove-sky/15 text-cove-blue dark:text-cove-sky mb-2">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Configuración Global del Campus</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Ajustes y Preferencias
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium max-w-xl">
              Configura el tema visual, las notificaciones de tus clases, vista del horario y copias de seguridad locales.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue text-white text-xs sm:text-sm font-bold shadow-lg shadow-cove-blue/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer w-full sm:w-auto"
            >
              <Check className="w-4 h-4 text-emerald-300" />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </div>

        {/* 3. SECCIÓN: APARIENCIA Y MODO OSCURO */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-5 transition-colors">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sun className="w-5 h-5 hidden dark:block" />
              <Moon className="w-5 h-5 block dark:hidden" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Apariencia y Modo Oscuro
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Elige el tema visual para una lectura cómoda de día o para tus sesiones nocturnas de estudio.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Opción 1: Modo Claro */}
            <button
              type="button"
              onClick={() => {
                setDraftSettings((prev) => ({ ...prev, theme: 'light' }));
                applyTheme('light');
              }}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-start gap-2 text-left relative overflow-hidden ${
                draftSettings.theme === 'light'
                  ? 'bg-amber-50/70 dark:bg-slate-800/90 border-amber-500 text-slate-900 dark:text-white shadow-xs'
                  : 'bg-white dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    draftSettings.theme === 'light'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Sun className="w-5 h-5" />
                </div>
                {draftSettings.theme === 'light' && (
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              <div>
                <span className="font-extrabold text-sm block text-slate-900 dark:text-white">
                  Modo Claro
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Limpio, luminoso y con alto contraste para uso durante el día.
                </p>
              </div>
            </button>

            {/* Opción 2: Modo Oscuro */}
            <button
              type="button"
              onClick={() => {
                setDraftSettings((prev) => ({ ...prev, theme: 'dark' }));
                applyTheme('dark');
              }}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-start gap-2 text-left relative overflow-hidden ${
                draftSettings.theme === 'dark'
                  ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    draftSettings.theme === 'dark'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                </div>
                {draftSettings.theme === 'dark' && (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              <div>
                <span className="font-extrabold text-sm block text-slate-900 dark:text-white">
                  Modo Oscuro
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Descanso visual y menor consumo de batería en pantallas OLED.
                </p>
              </div>
            </button>

            {/* Opción 3: Sistema */}
            <button
              type="button"
              onClick={() => {
                setDraftSettings((prev) => ({ ...prev, theme: 'system' }));
                applyTheme('system');
              }}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-start gap-2 text-left relative overflow-hidden ${
                draftSettings.theme === 'system'
                  ? 'bg-cove-blue/15 border-cove-sky text-slate-900 dark:text-white shadow-xs'
                  : 'bg-white dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    draftSettings.theme === 'system'
                      ? 'bg-cove-blue text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Monitor className="w-5 h-5" />
                </div>
                {draftSettings.theme === 'system' && (
                  <div className="w-5 h-5 rounded-full bg-cove-blue text-white flex items-center justify-center text-xs">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              <div>
                <span className="font-extrabold text-sm block text-slate-900 dark:text-white">
                  Automático (Sistema)
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Sigue automáticamente la configuración de tu celular o navegador.
                </p>
              </div>
            </button>
          </div>
        </div>


        {/* 4. SECCIÓN: NOTIFICACIONES Y RECORDATORIOS EN EL CELULAR */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-5 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Notificaciones y Avisos de Clases en el Celular
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recibe recordatorios automáticos en tu móvil antes y durante tus clases.
                </p>
              </div>
            </div>

            {/* Switch Maestro */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={draftSettings.notificationsEnabled}
                onChange={(e) =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    notificationsEnabled: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cove-blue"></div>
            </label>
          </div>

          {/* Estado de Permisos del Sistema */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  hasPermission ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Permisos del Dispositivo:{' '}
                <strong className={hasPermission ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                  {hasPermission === null
                    ? 'Comprobando...'
                    : hasPermission
                    ? 'Concedidos (Notificaciones activas)'
                    : 'Pendientes de aprobación'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!hasPermission && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Conceder Permisos
                </button>
              )}
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={isTestingNotification}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-cove-blue dark:text-cove-sky" />
                <span>Probar Notificación</span>
              </button>
            </div>
          </div>

          {/* Opciones Específicas de Notificación */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-3.5 transition-opacity ${
              draftSettings.notificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}
          >
            {/* Opción A: 15 minutos antes */}
            <div
              onClick={() =>
                setDraftSettings((prev) => ({
                  ...prev,
                  notify15MinBefore: !prev.notify15MinBefore,
                }))
              }
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                draftSettings.notify15MinBefore
                  ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-400 dark:border-sky-500 shadow-2xs'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  draftSettings.notify15MinBefore
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                }`}
              >
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Aviso 15 minutos antes
                  </span>
                  <input
                    type="checkbox"
                    checked={draftSettings.notify15MinBefore}
                    onChange={() => {}}
                    className="rounded text-cove-blue focus:ring-cove-sky cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Te avisa con antelación para que puedas dirigirte al aula o conectarte a la videollamada.
                </p>
              </div>
            </div>

            {/* Opción B: Al momento de iniciar */}
            <div
              onClick={() =>
                setDraftSettings((prev) => ({
                  ...prev,
                  notifyAtClassStart: !prev.notifyAtClassStart,
                }))
              }
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                draftSettings.notifyAtClassStart
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500 shadow-2xs'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  draftSettings.notifyAtClassStart
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Al momento de empezar la clase
                  </span>
                  <input
                    type="checkbox"
                    checked={draftSettings.notifyAtClassStart}
                    onChange={() => {}}
                    className="rounded text-cove-blue focus:ring-cove-sky cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Alarma en la hora exacta de inicio con el aula o enlace del profesor asignado.
                </p>
              </div>
            </div>

            {/* Opción C: Sonido y Vibración */}
            <div
              onClick={() =>
                setDraftSettings((prev) => ({
                  ...prev,
                  notificationSound: !prev.notificationSound,
                }))
              }
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 md:col-span-2 ${
                draftSettings.notificationSound
                  ? 'bg-slate-50 dark:bg-slate-800/90 border-slate-300 dark:border-slate-600'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  draftSettings.notificationSound
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                }`}
              >
                <Volume2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    Sonido y Vibración
                  </span>
                  <input
                    type="checkbox"
                    checked={draftSettings.notificationSound}
                    onChange={() => {}}
                    className="rounded text-cove-blue focus:ring-cove-sky cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Emite el timbre predeterminado del sistema y vibración al llegar cada notificación.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 5. SECCIÓN: SEMESTRE Y HORARIO ACADÉMICO */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-5 transition-colors">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-cove-blue dark:text-cove-sky flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Semestre y Horario Semanal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personaliza la estructura y vista de tu cronograma universitario.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nombre del Periodo */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Periodo Lectivo / Semestre Actual
              </label>
              <input
                type="text"
                value={draftSettings.semesterName}
                onChange={(e) =>
                  setDraftSettings((prev) => ({ ...prev, semesterName: e.target.value }))
                }
                placeholder="Ej. Semestre 2026-I, Otoño 2026"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cove-sky"
              />
            </div>

            {/* Vista Inicial */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Vista Predeterminada al Abrir Horario
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraftSettings((prev) => ({ ...prev, defaultScheduleView: 'weekly' }))
                  }
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                    draftSettings.defaultScheduleView === 'weekly'
                      ? 'bg-cove-navy text-white border-cove-navy shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Semana (Cuadrícula)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraftSettings((prev) => ({ ...prev, defaultScheduleView: 'daily' }))
                  }
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                    draftSettings.defaultScheduleView === 'daily'
                      ? 'bg-cove-navy text-white border-cove-navy shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Por Día (Pases)</span>
                </button>
              </div>
            </div>

            {/* Días Lectivos Visibles */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
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
                    onClick={() =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        visibleDays: item.id as AppSettings['visibleDays'],
                      }))
                    }
                    className={`py-2.5 px-2 rounded-2xl text-[11px] font-bold text-center transition-all cursor-pointer border ${
                      draftSettings.visibleDays === item.id
                        ? 'bg-cove-blue text-white border-cove-blue shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>


        {/* 6. SECCIÓN: FOTOGRAFÍA Y APUNTES */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4 transition-colors">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Fotografías y Notas de Pizarrón
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Optimización del espacio de almacenamiento para capturas de clases.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Calidad de Compresión al Insertar Fotos
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setDraftSettings((prev) => ({ ...prev, imageQuality: 'balanced' }))
                }
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                  draftSettings.imageQuality === 'balanced'
                    ? 'bg-cove-blue text-white border-cove-blue shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Equilibrada (720p - Recomendada)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraftSettings((prev) => ({ ...prev, imageQuality: 'high' }))
                }
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                  draftSettings.imageQuality === 'high'
                    ? 'bg-cove-blue text-white border-cove-blue shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Alta Nitidez (1080p)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
              La calidad equilibrada reduce el tamaño en más de un 70% asegurando nitidez total en fórmulas y pizarras sin saturar la memoria del teléfono.
            </p>
          </div>
        </div>

        {/* 7. SECCIÓN: DATOS Y RESPALDOS (OFFLINE-FIRST) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4 transition-colors">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Almacenamiento Local y Copias de Seguridad
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tus datos residen 100% en tu dispositivo con IndexedDB (Dexie.js).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-cove-blue/10 dark:bg-cove-blue/20 hover:bg-cove-blue/20 dark:hover:bg-cove-blue/30 text-cove-blue dark:text-cove-sky font-bold text-xs rounded-2xl border border-cove-sky/30 dark:border-cove-sky/40 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-cove-blue dark:text-cove-sky" />
              ) : (
                <Download className="w-4 h-4 text-cove-blue dark:text-cove-sky" />
              )}
              <span>Exportar Copia de Seguridad (JSON)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-cove-sand/50 dark:bg-slate-800 hover:bg-cove-sand dark:hover:bg-slate-750 border border-cove-gold/70 dark:border-slate-700 text-cove-navy dark:text-cove-sand font-bold text-xs rounded-2xl transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isImporting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-cove-navy dark:text-cove-sand" />
              ) : (
                <Upload className="w-4 h-4 text-cove-navy dark:text-cove-sand" />
              )}
              <span>Restaurar Copia de Seguridad</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Espacio ocupado en memoria local:</span>
            </div>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {storageEstimate.usedMB} MB / {storageEstimate.quotaMB} MB disponibles
            </span>
          </div>
        </div>

        {/* 8. INFORMACIÓN DE LA APLICACIÓN */}
        <div className="p-4 bg-cove-sand/30 dark:bg-slate-900/60 border border-cove-gold/50 dark:border-slate-800 rounded-3xl flex items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
          <img
            src="/app-icon-claro.svg"
            alt="Logo Agenda Universitaria"
            className="w-14 h-14 rounded-2xl shadow-xs ring-1 ring-cove-gold/60 shrink-0 bg-white p-1 object-contain"
          />
          <div className="space-y-1">
            <span className="font-black text-slate-900 dark:text-white block text-sm">
              Agenda Universitaria PWA • v1.5.3
            </span>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Desarrollada para estudiantes con Clean Architecture, Dexie.js (IndexedDB local-first) y Capacitor para Android. Funciona 100% sin conexión a internet y tus apuntes son privados.
            </p>
          </div>
        </div>


        {/* Botón Inferior para Guardar */}
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={handleSaveAndApply}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue text-white text-sm font-bold shadow-lg shadow-cove-blue/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer w-full sm:w-auto"
          >
            <Check className="w-5 h-5 text-emerald-300" />
            <span>Guardar y Aplicar Todos los Ajustes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
