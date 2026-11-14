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
  AlertTriangle,
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
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { formInputClass } from '../../../shared/components/form';

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
      className={`md-card space-y-4 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-4 text-[var(--color-md-on-surface)] shadow-2xs sm:rounded-3xl sm:p-5 ${
        compact ? 'text-xs' : ''
      }`}
    >
      <header className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-secondary-container)] text-[var(--color-md-primary)]">
          <HardDrive className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">Almacenamiento y respaldos</h3>
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">
            Tus datos viven solo en este dispositivo. Expórtalos o restáuralos sin intermediarios.
          </p>
        </div>
      </header>

      <section className="space-y-2 border-t border-[var(--color-md-outline-variant)] pt-4" aria-label="Exportar respaldo">
        <h4 className="text-sm font-bold">Exportar respaldo</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ActionTile
            tone="primary"
            icon={<FolderDown className="h-4 w-4" />}
            title="Guardar en Descargas"
            subtitle="Crea un archivo .json"
            onClick={handleSaveToDownloads}
            disabled={isExporting}
          />
          <ActionTile
            tone="primary"
            icon={<Share2 className="h-4 w-4" />}
            title="Compartir respaldo"
            subtitle="WhatsApp, Drive o Gmail"
            onClick={handleShare}
            disabled={isExporting}
          />
          <ActionTile
            icon={<Download className="h-4 w-4" />}
            title="Guardar como…"
            subtitle="Elegir carpeta de destino"
            onClick={handleSaveWithPicker}
            disabled={isExporting}
          />
          <ActionTile
            icon={copiedRecently ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            title={copiedRecently ? '¡Copiado!' : 'Copiar texto JSON'}
            subtitle="Para pegarlo en tus notas"
            onClick={handleCopyClipboard}
            disabled={isExporting}
          />
        </div>
      </section>

      <section className="space-y-2 border-t border-[var(--color-md-outline-variant)] pt-4" aria-label="Restaurar respaldo">
        <div>
          <h4 className="text-sm font-bold">Restaurar copia de seguridad</h4>
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">
            Reemplaza las materias, docentes, horarios y apuntes actuales por los del respaldo.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ActionTile
            icon={isImporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            title="Restaurar desde archivo"
            subtitle="Selecciona tu archivo .json"
            onClick={handleRestoreFromFile}
            disabled={isImporting}
          />
          <ActionTile
            icon={<ClipboardPaste className="h-4 w-4" />}
            title="Restaurar pegando texto"
            subtitle="Pega el JSON directamente"
            onClick={() => setIsPasteModalOpen(true)}
            disabled={isImporting}
          />
        </div>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
      </section>

      <footer className="flex items-center justify-between gap-2 border-t border-[var(--color-md-outline-variant)] pt-3 text-xs text-[var(--color-md-on-surface-variant)]">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="h-4 w-4 text-[var(--color-md-primary)]" aria-hidden="true" />
          Memoria local utilizada
        </span>
        <span className="font-mono font-bold text-[var(--color-md-on-surface)]">
          {storageEstimate.usedMB} MB / {storageEstimate.quotaMB} MB
        </span>
      </footer>

      <Modal
        isOpen={isPasteModalOpen}
        onClose={() => {
          setIsPasteModalOpen(false);
          setPasteError(null);
        }}
        title="Restaurar pegando JSON"
        maxWidth="lg"
      >
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-xl bg-[var(--color-md-surface-container-high)] p-3 text-xs text-[var(--color-md-on-surface)]">
            <FileCode className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
            Pega el contenido completo de tu respaldo. Se reemplazarán las materias, docentes, horarios y apuntes.
          </p>

          <label htmlFor="backup-paste" className="sr-only">
            Contenido JSON del respaldo
          </label>
          <textarea
            id="backup-paste"
            value={pastedJson}
            onChange={(e) => {
              setPastedJson(e.target.value);
              if (pasteError) setPasteError(null);
            }}
            placeholder='Pega aquí el JSON que empieza con { "version": 2, … }'
            rows={6}
            aria-invalid={pasteError !== null}
            className={`${formInputClass} resize-y font-mono text-xs`}
          />

          {pasteError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[var(--color-md-outline)] bg-[var(--color-md-surface-container)] p-3 text-xs font-medium text-[var(--color-md-on-surface)]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
              {pasteError}
            </p>
          )}

          <ModalActions>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsPasteModalOpen(false);
                setPasteError(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleRestoreFromPaste} disabled={isImporting || !pastedJson.trim()}>
              {isImporting ? 'Restaurando…' : 'Restaurar datos'}
            </Button>
          </ModalActions>
        </div>
      </Modal>
    </div>
  );
};

interface ActionTileProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
  /** primary: acciones recomendadas (tono primario); neutral: alternativas. */
  tone?: 'primary' | 'neutral';
}

const ActionTile: React.FC<ActionTileProps> = ({ icon, title, subtitle, onClick, disabled = false, tone = 'neutral' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${
      tone === 'primary'
        ? 'border-transparent bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] hover:brightness-[0.97]'
        : 'border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] text-[var(--color-md-on-surface)] hover:border-[var(--color-md-outline)]'
    }`}
  >
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        tone === 'primary'
          ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
          : 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-primary)]'
      }`}
    >
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block truncate text-xs font-bold">{title}</span>
      <span className="block truncate text-[11px] opacity-80">{subtitle}</span>
    </span>
  </button>
);
