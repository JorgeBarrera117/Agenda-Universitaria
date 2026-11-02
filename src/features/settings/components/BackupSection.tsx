import React, { useState, useRef, useEffect } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Share2,
  Copy,
  ClipboardPaste,
  RefreshCw,
  FolderDown,
  ShieldCheck,
  Check,
  FileCode,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  saveBackupToDownloads,
  shareBackup,
  saveBackupWithPicker,
  copyBackupToClipboard,
  importDatabaseBackup,
  restoreFromRawJson,
  pickAndRestoreBackup,
} from '../../../shared/utils/backup';
import { Modal } from '../../../shared/components/Modal';

interface BackupSectionProps {
  onShowToast: (message: string) => void;
  storageEstimate: { usedMB: number | string; quotaMB: number | string };
  refreshStorageEstimate?: () => Promise<void>;
  compact?: boolean;
}

export const BackupSection: React.FC<BackupSectionProps> = ({
  onShowToast,
  storageEstimate,
  refreshStorageEstimate,
  compact = false,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copiedRecently, setCopiedRecently] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpieza de temporizadores al desmontar para evitar fugas en móviles
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // 1. Guardar directo en Descargas
  const handleSaveToDownloads = async () => {
    setIsExporting(true);
    try {
      const res = await saveBackupToDownloads();
      onShowToast(`Archivo guardado en Descargas: ${res.fileName}`);
    } catch {
      onShowToast('No se pudo guardar en Descargas. Intenta con "Compartir" o "Copiar Texto".');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Compartir (WhatsApp, Drive, Gmail)
  const handleShare = async () => {
    setIsExporting(true);
    try {
      const res = await shareBackup();
      if (res.canceled) return;
      onShowToast('Copia lista para compartir o enviarse por WhatsApp/Drive.');
    } catch {
      onShowToast('Error al compartir. Prueba "Copiar Texto JSON".');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Guardar Como... (Selector SAF)
  const handleSaveWithPicker = async () => {
    setIsExporting(true);
    try {
      const res = await saveBackupWithPicker();
      if (res.canceled) return;
      onShowToast('Copia de seguridad guardada con éxito.');
    } catch {
      onShowToast('Error al guardar archivo.');
    } finally {
      setIsExporting(false);
    }
  };

  // 4. Copiar texto JSON al portapapeles
  const handleCopyClipboard = async () => {
    setIsExporting(true);
    try {
      const ok = await copyBackupToClipboard();
      if (ok) {
        setCopiedRecently(true);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setCopiedRecently(false), 2500);
        onShowToast('¡Código JSON copiado al portapapeles! Pégalo en WhatsApp o un bloc de notas.');
      } else {
        onShowToast('No se pudo copiar automáticamente.');
      }
    } catch {
      onShowToast('Error al copiar al portapapeles.');
    } finally {
      setIsExporting(false);
    }
  };

  // 5. Iniciar selección y restauración de archivo (Nativo en Android / Fallback en Web)
  const handleRestoreFromFile = async () => {
    if (Capacitor.isNativePlatform()) {
      setIsImporting(true);
      try {
        const res = await pickAndRestoreBackup();
        if (res.canceled) return;
        if (res.success) {
          onShowToast('¡Datos del semestre restaurados correctamente!');
          if (refreshStorageEstimate) await refreshStorageEstimate();
          return;
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          onShowToast(err.message);
        } else {
          onShowToast('Error al restaurar los datos desde el archivo.');
        }
        return;
      } finally {
        setIsImporting(false);
      }
    }

    // Fallback para navegador web
    fileInputRef.current?.click();
  };

  // 5.1 Fallback para navegador Web mediante input HTML
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await importDatabaseBackup(file);
      onShowToast('¡Datos del semestre restaurados correctamente!');
      if (refreshStorageEstimate) await refreshStorageEstimate();
    } catch (err: unknown) {
      if (err instanceof Error) {
        onShowToast(err.message);
      } else {
        onShowToast('Error al restaurar los datos desde el archivo.');
      }
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 6. Restaurar desde texto JSON pegado
  const handleRestoreFromPaste = async () => {
    if (!pastedJson.trim()) {
      setPasteError('Por favor pega el código JSON de tu respaldo.');
      return;
    }
    setPasteError(null);
    setIsImporting(true);
    try {
      await restoreFromRawJson(pastedJson.trim());
      setIsPasteModalOpen(false);
      setPastedJson('');
      onShowToast('¡Datos del semestre restaurados con éxito desde el texto pegado!');
      if (refreshStorageEstimate) await refreshStorageEstimate();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPasteError(err.message);
      } else {
        setPasteError('El texto no corresponde a un formato JSON válido de Agenda Universitaria.');
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      className={`bg-[#FDFBFF] dark:bg-[#1D2024] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xs border border-[#C3C7D0]/50 dark:border-[#43474E]/40 space-y-3.5 transition-colors ${
        compact ? 'text-xs' : ''
      }`}
    >
      {/* Encabezado */}
      <div className="flex items-center gap-2.5 border-b border-[#C3C7D0]/30 dark:border-[#43474E]/30 pb-2.5">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <HardDrive className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
            Almacenamiento y Respaldos
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Datos 100% locales en IndexedDB. Exporta o restaura sin intermediarios.
          </p>
        </div>
      </div>

      {/* Bloque 1: Exportar Respaldo (4 Opciones en Grid Compacta) */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-black uppercase tracking-wider text-cove-navy dark:text-cove-sky">
          1. Exportar Respaldo (JSON)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Opción A: Guardar en Descargas */}
          <button
            type="button"
            onClick={handleSaveToDownloads}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 bg-cove-blue/10 dark:bg-cove-blue/20 hover:bg-cove-blue/20 dark:hover:bg-cove-blue/30 text-cove-blue dark:text-cove-sky font-bold text-xs rounded-xl sm:rounded-2xl border border-cove-sky/30 dark:border-cove-sky/40 transition-all active:scale-98 cursor-pointer disabled:opacity-50 text-left"
          >
            <FolderDown className="w-4 h-4 shrink-0 text-cove-blue dark:text-cove-sky" />
            <div className="min-w-0 truncate">
              <span className="block font-black truncate text-xs">Guardar en Descargas</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Crea .json en Descargas
              </span>
            </div>
          </button>

          {/* Opción B: Compartir por WhatsApp / Drive */}
          <button
            type="button"
            onClick={handleShare}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs rounded-xl sm:rounded-2xl border border-emerald-300/50 dark:border-emerald-800/50 transition-all active:scale-98 cursor-pointer disabled:opacity-50 text-left"
          >
            <Share2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0 truncate">
              <span className="block font-black truncate text-xs">Compartir Respaldo</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                A WhatsApp, Drive o Gmail
              </span>
            </div>
          </button>

          {/* Opción C: Guardar Como... (Selector SAF) */}
          <button
            type="button"
            onClick={handleSaveWithPicker}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl sm:rounded-2xl border border-slate-300/70 dark:border-slate-700 transition-all active:scale-98 cursor-pointer disabled:opacity-50 text-left"
          >
            <Download className="w-4 h-4 shrink-0 text-slate-600 dark:text-slate-400" />
            <div className="min-w-0 truncate">
              <span className="block font-black truncate text-xs">Guardar Como...</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Elegir carpeta en explorador
              </span>
            </div>
          </button>

          {/* Opción D: Copiar JSON al Portapapeles */}
          <button
            type="button"
            onClick={handleCopyClipboard}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold text-xs rounded-xl sm:rounded-2xl border border-amber-300/50 dark:border-amber-800/50 transition-all active:scale-98 cursor-pointer disabled:opacity-50 text-left"
          >
            {copiedRecently ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div className="min-w-0 truncate">
              <span className="block font-black truncate text-xs">
                {copiedRecently ? '¡Copiado!' : 'Copiar Texto JSON'}
              </span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Para pegarlo en notas
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Bloque 2: Restaurar Respaldo (2 Opciones) */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
        <label className="block text-[11px] font-black uppercase tracking-wider text-cove-navy dark:text-cove-sky">
          2. Restaurar Copia de Seguridad
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Opción A: Desde archivo */}
          <button
            type="button"
            onClick={handleRestoreFromFile}
            disabled={isImporting}
            className="flex items-center gap-2 px-3 py-2 bg-cove-sand/50 dark:bg-slate-800 hover:bg-cove-sand dark:hover:bg-slate-700 border border-cove-gold/70 dark:border-slate-700 text-cove-navy dark:text-cove-sand font-bold text-xs rounded-xl sm:rounded-2xl transition-all active:scale-98 cursor-pointer disabled:opacity-50 text-left"
          >
            {isImporting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-cove-navy dark:text-cove-sand shrink-0" />
            ) : (
              <Upload className="w-4 h-4 text-cove-navy dark:text-cove-sand shrink-0" />
            )}
            <div className="min-w-0 truncate">
              <span className="block font-black truncate text-xs">Restaurar de Archivo</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Selecciona tu archivo .json
              </span>
            </div>
          </button>

          {/* Opción B: Pegando texto */}
          <button
            type="button"
            onClick={() => setIsPasteModalOpen(true)}
            disabled={isImporting}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl sm:rounded-2xl transition-all active:scale-98 cursor-pointer disabled:opacity-50 text-left"
          >
            <ClipboardPaste className="w-4 h-4 text-cove-blue dark:text-cove-sky shrink-0" />
            <div className="min-w-0 truncate">
              <span className="block font-black truncate text-xs">Restaurar Pegando Texto</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Pega el código JSON directamente
              </span>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Espacio ocupado */}
      <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Memoria local utilizada:</span>
        </div>
        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
          {storageEstimate.usedMB} MB / {storageEstimate.quotaMB} MB
        </span>
      </div>

      {/* Modal para pegar texto JSON directamente */}
      <Modal
        isOpen={isPasteModalOpen}
        onClose={() => {
          setIsPasteModalOpen(false);
          setPasteError(null);
        }}
        title="Restaurar Copiando JSON"
        maxWidth="lg"
      >
        <div className="space-y-3 text-slate-800 dark:text-slate-200">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
            <FileCode className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              Pega aquí el contenido JSON completo de tu respaldo. Se actualizarán las materias, profesores, horarios y apuntes.
            </p>
          </div>

          <textarea
            value={pastedJson}
            onChange={(e) => {
              setPastedJson(e.target.value);
              if (pasteError) setPasteError(null);
            }}
            placeholder='Pega aquí el contenido JSON que empieza con { "version": 2, ... }'
            rows={6}
            className="w-full p-2.5 font-mono text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-cove-blue dark:focus:ring-cove-sky resize-y"
          />

          {pasteError && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-xl text-xs font-medium">
              {pasteError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsPasteModalOpen(false);
                setPasteError(null);
              }}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRestoreFromPaste}
              disabled={isImporting || !pastedJson.trim()}
              className="px-4 py-1.5 text-xs font-black bg-cove-blue text-white rounded-xl shadow-2xs hover:bg-cove-navy active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {isImporting ? 'Restaurando...' : 'Restaurar Datos'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
