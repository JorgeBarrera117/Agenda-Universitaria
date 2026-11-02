import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Camera,
  Check,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { useAppSettings } from '../hooks/useAppSettings';
import type { AppSettings } from '../types';
import { BackupSection } from './BackupSection';

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
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);

  // Sincronizar el borrador de configuración de manera segura durante el ciclo de renderizado
  if (isOpen && !prevOpen) {
    setPrevOpen(true);
    setDraftSettings(settings);
  } else if (!isOpen && prevOpen) {
    setPrevOpen(false);
  }

  // Actualizar la estimación de almacenamiento de forma asíncrona al abrir el modal
  useEffect(() => {
    if (isOpen) {
      void refreshStorageEstimate();
    }
  }, [isOpen, refreshStorageEstimate]);

  const handleCancel = () => {
    setDraftSettings(settings); // Descartar cambios no confirmados
    onClose();
  };

  const handleSaveAndApply = () => {
    updateSettings(draftSettings);
    onShowToast('Ajustes guardados y aplicados correctamente.');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Configuración de la Agenda" maxWidth="md">
      <div className="space-y-4 text-slate-800 dark:text-slate-100">
        {/* 1. SECCIÓN: GESTIÓN DE DATOS Y RESPALDOS (OFFLINE-FIRST) */}
        <BackupSection
          onShowToast={onShowToast}
          storageEstimate={storageEstimate}
          refreshStorageEstimate={refreshStorageEstimate}
          compact
        />

        {/* 2. SECCIÓN: PREFERENCIAS DEL SEMESTRE Y HORARIO */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cove-navy dark:text-cove-sky">
            <Calendar className="w-3.5 h-3.5 text-cove-blue dark:text-cove-sky" />
            <span>Semestre y Horario Académico</span>
          </div>

          <div className="bg-slate-50/90 dark:bg-slate-900/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 space-y-3">
            {/* Nombre del Periodo / Semestre */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Periodo Lectivo / Semestre Actual
              </label>
              <input
                type="text"
                value={draftSettings.semesterName}
                onChange={(e) =>
                  setDraftSettings((prev) => ({ ...prev, semesterName: e.target.value }))
                }
                placeholder="Ej. Semestre 2026-I, Otoño 2026"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cove-sky"
              />
            </div>

            {/* Vista Inicial Predeterminada del Horario */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Vista Predeterminada al Abrir el Horario
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraftSettings((prev) => ({ ...prev, defaultScheduleView: 'weekly' }))
                  }
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    draftSettings.defaultScheduleView === 'weekly'
                      ? 'bg-cove-navy dark:bg-cove-blue text-white border-transparent shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
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
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    draftSettings.defaultScheduleView === 'daily'
                      ? 'bg-cove-navy dark:bg-cove-blue text-white border-transparent shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Por Día (Pases)</span>
                </button>
              </div>
            </div>

            {/* Días Lectivos Visibles */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
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
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer border ${
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

        {/* 3. SECCIÓN: CÁMARA Y FOTOS DEL PIZARRÓN */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cove-navy dark:text-cove-sky">
            <Camera className="w-3.5 h-3.5 text-cove-blue dark:text-cove-sky" />
            <span>Optimización de Fotografías de Pizarrón</span>
          </div>

          <div className="bg-slate-50/90 dark:bg-slate-900/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Calidad de Compresión al Capturar
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraftSettings((prev) => ({ ...prev, imageQuality: 'balanced' }))
                }
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  draftSettings.imageQuality === 'balanced'
                    ? 'bg-cove-blue text-white border-cove-blue shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Equilibrada (720p)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraftSettings((prev) => ({ ...prev, imageQuality: 'high' }))
                }
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  draftSettings.imageQuality === 'high'
                    ? 'bg-cove-blue text-white border-cove-blue shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Alta Nitidez (1080p)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              La calidad equilibrada reduce el tamaño en más de un 70% preservando fórmulas y apuntes perfectamente legibles.
            </p>
          </div>
        </div>

        {/* 4. INFORMACIÓN DEL SISTEMA Y ARQUITECTURA */}
        <div className="p-3 bg-cove-sand/30 dark:bg-slate-900/40 border border-cove-gold/40 dark:border-slate-800 rounded-2xl flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
          <img
            src="./app-icon-claro.svg"
            alt="Logo Agenda Universitaria"
            className="w-10 h-10 rounded-xl shadow-2xs ring-1 ring-cove-gold/50 shrink-0 bg-white p-0.5 object-contain"
          />
          <div className="space-y-0.5 min-w-0">
            <span className="font-black text-slate-900 dark:text-white block text-xs sm:text-sm">
              Agenda Universitaria PWA
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Arquitectura Offline-First con persistencia en IndexedDB (Dexie.js). Sin rastreo ni intermediarios.
            </p>
          </div>
        </div>

        {/* 5. BOTONES DE ACCIÓN */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3.5 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveAndApply}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-cove-navy dark:bg-cove-blue hover:bg-slate-900 dark:hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Check className="w-3.5 h-3.5 text-emerald-300" />
            <span>Guardar cambios</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
