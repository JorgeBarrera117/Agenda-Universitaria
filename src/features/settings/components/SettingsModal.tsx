import React, { useRef, useState, useEffect } from 'react';
import {
  Download,
  Upload,
  HardDrive,
  Calendar,
  Camera,
  ShieldCheck,
  Check,
  RefreshCw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { useAppSettings } from '../hooks/useAppSettings';
import type { AppSettings } from '../types';
import { exportDatabaseBackup, importDatabaseBackup } from '../../../shared/utils/backup';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const { settings, updateSettings, storageEstimate, refreshStorageEstimate } =
    useAppSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);

  // Sincronizar el borrador de configuración cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setDraftSettings(settings);
      refreshStorageEstimate();
    }
  }, [isOpen, settings]);

  const handleCancel = () => {
    setDraftSettings(settings); // Descartar cambios no confirmados
    onClose();
  };

  const handleSaveAndApply = () => {
    updateSettings(draftSettings);
    onShowToast('Ajustes guardados y aplicados correctamente.');
    onClose();
  };

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
    <Modal isOpen={isOpen} onClose={handleCancel} title="Configuración de la Agenda" maxWidth="md">
      <div className="space-y-6 text-slate-800">
        {/* 1. SECCIÓN: GESTIÓN DE DATOS Y RESPALDOS (OFFLINE-FIRST) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cove-navy">
            <HardDrive className="w-4 h-4 text-cove-blue" />
            <span>Datos y Copias de Seguridad (Local-First)</span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Respaldo Completo del Semestre
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exporta todas tus asignaturas, profesores, horarios, apuntes y fotos de pizarra en un único archivo JSON seguro.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cove-blue/10 hover:bg-cove-blue/20 text-cove-blue font-bold text-xs rounded-xl border border-cove-sky/30 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-cove-blue" />
                ) : (
                  <Download className="w-4 h-4 text-cove-blue" />
                )}
                <span>Exportar Copia (JSON)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cove-sand/50 hover:bg-cove-sand border border-cove-gold/70 text-cove-navy font-bold text-xs rounded-xl transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isImporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-cove-navy" />
                ) : (
                  <Upload className="w-4 h-4 text-cove-navy" />
                )}
                <span>Restaurar Copia</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>

            {/* Métrica de almacenamiento local en el dispositivo */}
            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Almacenamiento ocupado en el dispositivo:</span>
              </div>
              <span className="font-mono font-bold text-slate-800">
                {storageEstimate.usedMB} MB
              </span>
            </div>
          </div>
        </div>

        {/* 2. SECCIÓN: PREFERENCIAS DEL SEMESTRE Y HORARIO */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cove-navy">
            <Calendar className="w-4 h-4 text-cove-blue" />
            <span>Semestre y Horario Académico</span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-4">
            {/* Nombre del Periodo / Semestre */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Periodo Lectivo / Semestre Actual
              </label>
              <input
                type="text"
                value={draftSettings.semesterName}
                onChange={(e) =>
                  setDraftSettings((prev) => ({ ...prev, semesterName: e.target.value }))
                }
                placeholder="Ej. Semestre 2026-I, Otoño 2026"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cove-sky"
              />
            </div>

            {/* Vista Inicial Predeterminada del Horario */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Vista Predeterminada al Abrir el Horario
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraftSettings((prev) => ({ ...prev, defaultScheduleView: 'weekly' }))
                  }
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    draftSettings.defaultScheduleView === 'weekly'
                      ? 'bg-cove-navy text-white border-cove-navy shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Semana (Cuadrícula)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraftSettings((prev) => ({ ...prev, defaultScheduleView: 'daily' }))
                  }
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    draftSettings.defaultScheduleView === 'daily'
                      ? 'bg-cove-navy text-white border-cove-navy shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Por Día (Pases de Aula)</span>
                </button>
              </div>
            </div>

            {/* Días Lectivos Visibles */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer border ${
                      draftSettings.visibleDays === item.id
                        ? 'bg-cove-blue text-white border-cove-blue shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3. SECCIÓN: CÁMARA Y FOTOS DEL PIZARRÓN */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cove-navy">
            <Camera className="w-4 h-4 text-cove-blue" />
            <span>Optimización de Fotografías de Pizarrón</span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Calidad de Compresión al Capturar
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraftSettings((prev) => ({ ...prev, imageQuality: 'balanced' }))
                }
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  draftSettings.imageQuality === 'balanced'
                    ? 'bg-cove-blue text-white border-cove-blue shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Equilibrada (720p - Recomendada)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraftSettings((prev) => ({ ...prev, imageQuality: 'high' }))
                }
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  draftSettings.imageQuality === 'high'
                    ? 'bg-cove-blue text-white border-cove-blue shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Alta Nitidez (1080p)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              La calidad equilibrada reduce el peso en más del 70% asegurando que las fórmulas y apuntes sean 100% legibles.
            </p>
          </div>
        </div>

        {/* 4. INFORMACIÓN DEL SISTEMA Y ARQUITECTURA */}
        <div className="p-3.5 bg-cove-sand/30 border border-cove-gold/50 rounded-2xl flex items-center gap-3.5 text-xs text-slate-700">
          <img
            src="/app-icon-claro.svg"
            alt="Logo Agenda Universitaria"
            className="w-12 h-12 rounded-2xl shadow-xs ring-1 ring-cove-gold/60 shrink-0 bg-white p-0.5 object-contain"
          />
          <div className="space-y-0.5">
            <span className="font-black text-slate-900 block text-sm">
              Agenda Universitaria PWA • v2.0
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Arquitectura Offline-First con persistencia local en IndexedDB (Dexie.js). Sin rastreo ni servidores intermedios: tus notas de cátedra pertenecen exclusivamente a tu dispositivo.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200/80">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveAndApply}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cove-navy hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-cove-navy/20 active:scale-95"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Listo, guardar y aplicar cambios</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
