import React, { useState, useRef } from 'react';
import {
  HardDrive,
  Link as LinkIcon,
  UploadCloud,
  FileCheck,
  FileText,
  Table,
  Presentation,
  Image as ImageIcon,
  File,
  X,
  Globe,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import type { Subject } from '../../subjects/types';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
import { Modal } from '../../../shared/components/Modal';
import { BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import {
  FormSheet,
  FormSection,
  FormField,
  SegmentedControl,
  formInputClass,
  type SegmentedOption,
} from '../../../shared/components/form';

export interface DocumentLinkFormProps {
  subjects: Subject[];
  initialSubjectId?: string;
  onSubmitLocalFile: (subjectId: string, file: File) => Promise<void>;
  onSubmitExternalLink: (subjectId: string, name: string, url: string) => Promise<void>;
  onCancel: () => void;
}

type AddMode = 'file' | 'link';

const MODE_OPTIONS: SegmentedOption<AddMode>[] = [
  { value: 'file', label: 'Archivo local', icon: <HardDrive className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  { value: 'link', label: 'Enlace web', icon: <LinkIcon className="h-4 w-4 shrink-0" aria-hidden="true" /> },
];

const ACCEPTED_FILES = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*';
const ACCEPTED_LABELS = ['PDF', 'Word', 'PowerPoint', 'Excel', 'TXT', 'Fotos'];

const CLOUD_PRESETS = [
  { label: 'Google Drive', urlPrefix: 'https://drive.google.com/' },
  { label: 'OneDrive', urlPrefix: 'https://onedrive.live.com/' },
  { label: 'Notion', urlPrefix: 'https://notion.so/' },
  { label: 'Dropbox', urlPrefix: 'https://dropbox.com/' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Ícono y etiqueta legible según la extensión del archivo. */
function describeFileType(fileName: string): { Icon: React.ComponentType<{ className?: string }>; label: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return { Icon: FileText, label: 'PDF' };
  if (ext === 'ppt' || ext === 'pptx') return { Icon: Presentation, label: 'Presentación' };
  if (ext === 'doc' || ext === 'docx') return { Icon: FileText, label: 'Documento Word' };
  if (ext === 'xls' || ext === 'xlsx') return { Icon: Table, label: 'Hoja de cálculo' };
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'bmp'].includes(ext)) return { Icon: ImageIcon, label: 'Imagen' };
  return { Icon: File, label: ext ? ext.toUpperCase() : 'Archivo' };
}

export const DocumentLinkForm: React.FC<DocumentLinkFormProps> = ({
  subjects,
  initialSubjectId,
  onSubmitLocalFile,
  onSubmitExternalLink,
  onCancel,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || subjects[0]?.id || '');
  const [addMode, setAddMode] = useState<AddMode>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasUnsavedInput = selectedFile !== null || linkName.trim() !== '' || linkUrl.trim() !== '';

  // Solo se pide confirmación si hay algo que perder; un formulario vacío se cierra directamente
  const handleBack = () => {
    if (showDiscardModal) {
      setShowDiscardModal(false);
    } else if (hasUnsavedInput) {
      setShowDiscardModal(true);
    } else {
      onCancel();
    }
  };

  const subjectOptions: M3SelectOption[] = subjects.map((s) => ({
    value: s.id,
    label: s.name,
    sublabel: s.code || undefined,
    color: s.color,
    icon: <SubjectBadge icon={s.icon} color={s.color} size="select" />,
  }));

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      setErrorMessage('Selecciona la asignatura de destino.');
      return;
    }
    if (addMode === 'file' && !selectedFile) {
      setErrorMessage('Selecciona un archivo de tu dispositivo.');
      return;
    }
    if (addMode === 'link' && (!linkName.trim() || !linkUrl.trim())) {
      setErrorMessage('Completa el nombre y la dirección del enlace.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (addMode === 'file' && selectedFile) {
        await onSubmitLocalFile(selectedSubjectId, selectedFile);
      } else {
        await onSubmitExternalLink(selectedSubjectId, linkName.trim(), linkUrl.trim());
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo vincular el documento.');
      setIsSubmitting(false);
    }
  };

  const fileType = selectedFile ? describeFileType(selectedFile.name) : null;

  return (
    <>
      <FormSheet
        title="Vincular documento"
        subtitle={currentSubject ? `Para ${currentSubject.name}` : 'Guías, diapositivas y enlaces por materia'}
        onBack={handleBack}
        backLabel="Volver al catálogo de documentos"
        backPriority={BACK_PRIORITY.SUBVIEW}
        onSubmit={handleSubmit}
        submitLabel={addMode === 'file' ? 'Vincular' : 'Guardar enlace'}
        isSubmitting={isSubmitting}
        submitDisabled={addMode === 'file' && !selectedFile}
        error={errorMessage}
        onDismissError={() => setErrorMessage(null)}
      >
        <FormSection title="Asignatura">
          <M3Select
            value={selectedSubjectId}
            onChange={(val) => {
              setSelectedSubjectId(val);
              setErrorMessage(null);
            }}
            options={subjectOptions}
            placeholder="Selecciona una materia"
            required
          />
        </FormSection>

        <FormSection title="Origen del documento">
          <SegmentedControl
            value={addMode}
            onChange={(mode) => {
              setAddMode(mode);
              setErrorMessage(null);
            }}
            options={MODE_OPTIONS}
            ariaLabel="Origen del documento"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILES}
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {addMode === 'file' ? (
            selectedFile && fileType ? (
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] p-3 text-[var(--color-md-on-primary-container)] animate-in zoom-in-95 duration-150">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]">
                  <fileType.Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{selectedFile.name}</p>
                  <p className="text-xs font-medium opacity-80">
                    {fileType.label} · {formatFileSize(selectedFile.size)}
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold">
                    <FileCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Listo para vincular{currentSubject ? ` a ${currentSubject.name}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 rounded-full px-3 text-xs font-bold transition-all duration-150 ease-out hover:bg-[var(--color-md-card-bg)] active:scale-95"
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    aria-label="Quitar archivo seleccionado"
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 ease-out hover:bg-[var(--color-md-card-bg)] active:scale-95"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-150 ease-out active:scale-[0.99] sm:p-8 ${
                  isDraggingOver
                    ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)]'
                    : 'border-[var(--color-md-outline)] hover:border-[var(--color-md-primary)] hover:bg-[var(--color-md-surface-container)]'
                }`}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
                  <UploadCloud className="h-7 w-7" aria-hidden="true" />
                </span>
                <span className="text-sm font-bold text-[var(--color-md-on-surface)]">
                  {isDraggingOver ? 'Suelta el archivo aquí' : 'Toca para elegir un archivo o arrástralo aquí'}
                </span>
                <span className="flex flex-wrap justify-center gap-1.5">
                  {ACCEPTED_LABELS.map((label) => (
                    <span
                      key={label}
                      className="rounded-md bg-[var(--color-md-surface-container-high)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]"
                    >
                      {label}
                    </span>
                  ))}
                </span>
              </button>
            )
          ) : (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--color-md-on-surface-variant)]">Atajos:</span>
                {CLOUD_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      if (!linkUrl) setLinkUrl(preset.urlPrefix);
                      if (!linkName) setLinkName(`Carpeta en ${preset.label}`);
                    }}
                    className="h-8 rounded-full border border-[var(--color-md-outline-variant)] px-3 text-xs font-bold text-[var(--color-md-on-surface-variant)] transition-all duration-150 ease-out hover:border-[var(--color-md-outline)] hover:text-[var(--color-md-on-surface)] active:scale-95"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>

              <FormField htmlFor="doc-link-name" label="Nombre del recurso" required>
                <div className="relative">
                  <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
                  <input
                    id="doc-link-name"
                    type="text"
                    value={linkName}
                    onChange={(e) => {
                      setLinkName(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="ej. Diapositivas unidad 3"
                    className={`${formInputClass} pl-9`}
                  />
                </div>
              </FormField>

              <FormField htmlFor="doc-link-url" label="Dirección del enlace" required>
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
                  <input
                    id="doc-link-url"
                    type="url"
                    inputMode="url"
                    value={linkUrl}
                    onChange={(e) => {
                      setLinkUrl(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="https://drive.google.com/…"
                    className={`${formInputClass} pl-9 font-mono text-xs`}
                  />
                </div>
              </FormField>
            </div>
          )}
        </FormSection>
      </FormSheet>

      {showDiscardModal && (
        <Modal isOpen={showDiscardModal} onClose={() => setShowDiscardModal(false)} title="¿Salir sin guardar?" maxWidth="sm">
          <div className="-mt-2 space-y-4">
            <div className="flex items-start gap-3 pt-1">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm text-[var(--color-md-on-surface-variant)]">
                {selectedFile
                  ? `El archivo "${selectedFile.name}" no se vinculará a la materia.`
                  : `Se perderán los datos del enlace "${linkName.trim() || 'nuevo'}".`}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-md-outline-variant)] pt-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDiscardModal(false);
                  onCancel();
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-[var(--color-md-on-surface-variant)] transition-all duration-150 ease-out hover:bg-[var(--color-md-surface-container-high)] active:scale-95"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Salir sin guardar
              </button>
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--color-md-primary)] px-5 text-sm font-bold text-[var(--color-md-on-primary)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-95"
              >
                Seguir editando
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
