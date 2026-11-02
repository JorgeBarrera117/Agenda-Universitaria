import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  HardDrive,
  Link as LinkIcon,
  UploadCloud,
  FileCheck,
  FileText,
  Table,
  Presentation,
  File,
  AlertCircle,
  Loader2,
  Check,
  X,
  Globe,
  Sparkles,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import type { Subject } from '../../subjects/types';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
import { Modal } from '../../../shared/components/Modal';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';

export interface DocumentLinkFormProps {
  subjects: Subject[];
  initialSubjectId?: string;
  onSubmitLocalFile: (subjectId: string, file: File) => Promise<void>;
  onSubmitExternalLink: (subjectId: string, name: string, url: string) => Promise<void>;
  onCancel: () => void;
}

export const DocumentLinkForm: React.FC<DocumentLinkFormProps> = ({
  subjects,
  initialSubjectId,
  onSubmitLocalFile,
  onSubmitExternalLink,
  onCancel,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectId || subjects[0]?.id || ''
  );
  const [addMode, setAddMode] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Solicitar confirmación antes de salir
  const handleRequestCancel = () => {
    setShowDiscardModal(true);
  };

  const handleConfirmDiscard = () => {
    setShowDiscardModal(false);
    onCancel();
  };

  // Interceptar botón atrás físico en Android para preguntar antes de salir sin guardar
  useBackButton(
    () => {
      if (showDiscardModal) {
        setShowDiscardModal(false);
        return true;
      }
      setShowDiscardModal(true);
      return true;
    },
    BACK_PRIORITY.SUBVIEW,
    true
  );

  // Opciones para M3Select
  const subjectOptions: M3SelectOption[] = subjects.map((s) => ({
    value: s.id,
    label: s.name,
    sublabel: s.code || undefined,
    color: s.color,
  }));

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);

  // Helper para tamaño de archivo
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Helper para formato visual del archivo
  const getFileVisuals = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'pdf':
        return {
          icon: <FileText className="w-6 h-6 text-white stroke-[2.2]" />,
          bg: '#D9381E',
          label: 'PDF',
        };
      case 'ppt':
      case 'pptx':
        return {
          icon: <Presentation className="w-6 h-6 text-white stroke-[2.2]" />,
          bg: '#D04423',
          label: 'PRESENTACIÓN PPTX',
        };
      case 'doc':
      case 'docx':
        return {
          icon: <FileText className="w-6 h-6 text-white stroke-[2.2]" />,
          bg: '#185ABD',
          label: 'DOCUMENTO WORD',
        };
      case 'xls':
      case 'xlsx':
        return {
          icon: <Table className="w-6 h-6 text-white stroke-[2.2]" />,
          bg: '#107C41',
          label: 'HOJA EXCEL',
        };
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
        return {
          icon: <File className="w-6 h-6 text-white stroke-[2.2]" />,
          bg: '#6E45E2',
          label: 'IMAGEN',
        };
      default:
        return {
          icon: <File className="w-6 h-6 text-white stroke-[2.2]" />,
          bg: '#5E6B7A',
          label: ext ? ext.toUpperCase() : 'ARCHIVO',
        };
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  // Manejadores de Drag & Drop para PC / Tablet
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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      setErrorMessage('Debes seleccionar una asignatura de destino.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (addMode === 'file') {
        if (!selectedFile) {
          setErrorMessage('Por favor selecciona un archivo de tu dispositivo.');
          setIsSubmitting(false);
          return;
        }
        await onSubmitLocalFile(selectedSubjectId, selectedFile);
      } else {
        if (!linkName.trim() || !linkUrl.trim()) {
          setErrorMessage('Por favor completa el nombre y la dirección URL del enlace.');
          setIsSubmitting(false);
          return;
        }
        await onSubmitExternalLink(selectedSubjectId, linkName.trim(), linkUrl.trim());
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocurrió un error al vincular el documento.');
      }
      setIsSubmitting(false);
    }
  };

  const fileVisuals = selectedFile ? getFileVisuals(selectedFile.name) : null;

  return (
    <div className="w-full pb-12 space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      {/* 1. ENCABEZADO CANÓNICO M3 (Touch target 44px y alineación vertical) */}
      <div className="flex items-center gap-3.5 pb-3.5 border-b border-[#C2C7CE]/40 dark:border-[#42474E]/40">
        <button
          type="button"
          onClick={handleRequestCancel}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76]/50 flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 shadow-2xs"
          aria-label="Volver al catálogo de documentos"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-black text-[#191C20] dark:text-[#E2E2E6] tracking-tight truncate">
            Vincular Documento
          </h2>
          <p className="text-xs sm:text-sm text-[#72777F] dark:text-[#8C9199] truncate mt-0.5">
            Organiza guías, diapositivas y enlaces web bajo tus asignaturas universitarias.
          </p>
        </div>
      </div>

      {/* Alerta de Error Accesible */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-xs sm:text-sm text-red-700 dark:text-red-300 shadow-2xs animate-in slide-in-from-top-1"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span className="font-semibold flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-red-600 dark:text-red-400"
            aria-label="Descartar error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {/* 2. PASO 1: SELECCIÓN DE ASIGNATURA DESTINO */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-[#00639B]/10 dark:bg-[#92CCFF]/15 text-[#00639B] dark:text-[#92CCFF] border border-[#00639B]/20 uppercase tracking-wider">
                Paso 1
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#191C20] dark:text-[#E2E2E6]">
                Asignatura Destino
              </h3>
            </div>

            {currentSubject && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/40 dark:border-[#42474E]/40 shadow-2xs">
                <SubjectBadge icon={currentSubject.icon} color={currentSubject.color} size="sm" />
                <span className="text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] truncate max-w-[180px]">
                  {currentSubject.name}
                </span>
                {currentSubject.code && (
                  <span className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[#41474D] dark:text-[#C2C7CF]">
                    {currentSubject.code}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Selector M3 con Flip Inteligente (espacio vertical ilimitado) */}
          <M3Select
            value={selectedSubjectId}
            onChange={(val) => {
              setSelectedSubjectId(val);
              setErrorMessage(null);
            }}
            options={subjectOptions}
            placeholder="Selecciona la materia de tu plan..."
            required
          />

          {/* Carrusel Táctil Limpio (sin scrollbar antiestética) */}
          {subjects.length > 1 && (
            <div className="pt-1">
              <span className="text-[10px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block mb-2">
                Acceso rápido por materia:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {subjects.map((subj) => {
                  const isSelected = subj.id === selectedSubjectId;
                  return (
                    <button
                      key={subj.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubjectId(subj.id);
                        setErrorMessage(null);
                      }}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 border ${
                        isSelected
                          ? 'bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] border-transparent shadow-xs'
                          : 'bg-[#E2E7EF]/70 dark:bg-[#272A2F]/70 text-[#41474D] dark:text-[#C2C7CF] border-[#C2C7CE]/40 dark:border-[#42474E]/40 hover:bg-[#D0E4FF]/40 dark:hover:bg-[#004B76]/30'
                      }`}
                    >
                      <SubjectBadge icon={subj.icon} color={subj.color} size="sm" />
                      <span className="truncate max-w-[130px]">{subj.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. PASO 2: TIPO DE RECURSO Y CARGA */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-4 shadow-2xs">
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-[#00639B]/10 dark:bg-[#92CCFF]/15 text-[#00639B] dark:text-[#92CCFF] border border-[#00639B]/20 uppercase tracking-wider mb-1">
              Paso 2
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#191C20] dark:text-[#E2E2E6]">
              Origen del Documento
            </h3>
          </div>

          {/* Segmented Button M3 (Altura 44px, feedback háptico y proporcional) */}
          <div className="flex p-1 rounded-2xl bg-[#E2E7EF] dark:bg-[#272A2F] border border-[#C2C7CE]/30 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                setAddMode('file');
                setErrorMessage(null);
              }}
              className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                addMode === 'file'
                  ? 'bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] shadow-xs scale-[1.01]'
                  : 'text-[#41474D] dark:text-[#C2C7CF] hover:text-[#191C20] dark:hover:text-white'
              }`}
            >
              <HardDrive className="w-4.5 h-4.5 stroke-[2.2]" />
              <span>Archivo Local (Dispositivo)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode('link');
                setErrorMessage(null);
              }}
              className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                addMode === 'link'
                  ? 'bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] shadow-xs scale-[1.01]'
                  : 'text-[#41474D] dark:text-[#C2C7CF] hover:text-[#191C20] dark:hover:text-white'
              }`}
            >
              <LinkIcon className="w-4.5 h-4.5 stroke-[2.2]" />
              <span>Enlace Web / Drive</span>
            </button>
          </div>

          {/* Input oculto nativo */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* CONTENIDO SEGÚN MODO: ARCHIVO LOCAL */}
          {addMode === 'file' ? (
            <div className="space-y-3">
              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-6 sm:p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer group text-center space-y-3 select-none ${
                    isDraggingOver
                      ? 'border-[#00639B] dark:border-[#92CCFF] bg-[#D0E4FF]/30 dark:bg-[#004B76]/30 scale-[1.01]'
                      : 'border-[#00639B]/40 dark:border-[#92CCFF]/40 hover:border-[#00639B] dark:hover:border-[#92CCFF] hover:bg-[#D0E4FF]/10 dark:hover:bg-[#004B76]/10'
                  }`}
                >
                  {/* Ícono de Nube Proporcionado */}
                  <div className="w-14 h-14 rounded-2xl bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] flex items-center justify-center mx-auto shadow-xs group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-7 h-7 stroke-[2.2]" />
                  </div>

                  <div>
                    <h4 className="text-sm sm:text-base font-black text-[#191C20] dark:text-[#E2E2E6] leading-snug">
                      Toca para explorar o arrastra un archivo aquí
                    </h4>
                    <p className="text-xs text-[#72777F] dark:text-[#8C9199] max-w-sm mx-auto mt-1 leading-relaxed">
                      Soporta los formatos más utilizados en el aula y estudio universitario:
                    </p>
                  </div>

                  {/* Micro-píldoras Visuales de Formatos Admitidos */}
                  <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-300/40">
                      PDF
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300/40">
                      DOCX
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-300/40">
                      PPTX
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                      XLSX
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300/40">
                      FOTOS
                    </span>
                  </div>

                  <div className="pt-1.5">
                    <span className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-full text-xs sm:text-sm font-bold bg-[#E2E7EF] dark:bg-[#272A2F] text-[#00639B] dark:text-[#92CCFF] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 shadow-2xs group-hover:bg-[#D0E4FF] dark:group-hover:bg-[#004B76]/50 transition-colors">
                      <HardDrive className="w-4 h-4 stroke-[2.2]" />
                      <span>Explorar en este dispositivo</span>
                    </span>
                  </div>
                </div>
              ) : (
                /* Tarjeta de Archivo Seleccionado con Alto Contraste y M3 Squircle */
                <div className="p-4 rounded-2xl bg-[#E2E7EF]/70 dark:bg-[#272A2F]/70 border border-[#00639B]/50 dark:border-[#92CCFF]/50 flex items-center justify-between gap-3 shadow-xs animate-in zoom-in-95 duration-150">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ring-1 ring-white/20 select-none"
                      style={{ backgroundColor: fileVisuals?.bg }}
                    >
                      {fileVisuals?.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-black px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[#41474D] dark:text-[#C2C7CF]">
                          {fileVisuals?.label}
                        </span>
                        <span className="font-mono text-xs text-[#72777F] dark:text-[#8C9199] font-medium">
                          {formatFileSize(selectedFile.size)}
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-bold text-[#191C20] dark:text-[#E2E2E6] truncate mt-0.5">
                        {selectedFile.name}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Listo para vincular a {currentSubject?.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Archivo */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold text-[#00639B] dark:text-[#92CCFF] bg-white dark:bg-[#1D2024] hover:bg-[#D0E4FF]/40 dark:hover:bg-[#004B76]/30 transition-colors border border-[#C2C7CE]/60 dark:border-[#42474E]/60 cursor-pointer shadow-2xs"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      title="Quitar archivo"
                      aria-label="Quitar archivo seleccionado"
                    >
                      <X className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* CONTENIDO SEGÚN MODO: ENLACE WEB / CLOUD */
            <div className="space-y-3.5">
              {/* Presets Rápidos de Nube */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <span className="text-[10px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF]" /> Atajo:
                </span>
                {[
                  { label: 'Google Drive', urlPrefix: 'https://drive.google.com/' },
                  { label: 'OneDrive', urlPrefix: 'https://onedrive.live.com/' },
                  { label: 'Notion', urlPrefix: 'https://notion.so/' },
                  { label: 'Dropbox', urlPrefix: 'https://dropbox.com/' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      if (!linkUrl) setLinkUrl(preset.urlPrefix);
                      if (!linkName) setLinkName(`Carpeta en ${preset.label}`);
                    }}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E2E7EF]/80 dark:bg-[#272A2F]/80 text-[#41474D] dark:text-[#C2C7CF] hover:bg-[#D0E4FF]/50 border border-[#C2C7CE]/40 dark:border-[#42474E]/40 shrink-0 cursor-pointer"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#41474D] dark:text-[#C2C7CF] uppercase tracking-wider mb-1.5">
                  Nombre Descriptivo del Recurso <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#72777F] dark:text-[#8C9199]" />
                  <input
                    type="text"
                    placeholder="ej. Diapositivas Unidad 3 - Google Drive"
                    value={linkName}
                    onChange={(e) => {
                      setLinkName(e.target.value);
                      setErrorMessage(null);
                    }}
                    className="w-full pl-10 pr-3.5 h-11 sm:h-12 rounded-2xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/60 dark:border-[#42474E]/60 text-xs sm:text-sm text-[#191C20] dark:text-[#E2E2E6] placeholder-[#72777F] dark:placeholder-[#8C9199] focus:outline-none focus:ring-2 focus:ring-[#00639B] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#41474D] dark:text-[#C2C7CF] uppercase tracking-wider mb-1.5">
                  Dirección URL del Enlace <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#72777F] dark:text-[#8C9199]" />
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... o https://notion.so/..."
                    value={linkUrl}
                    onChange={(e) => {
                      setLinkUrl(e.target.value);
                      setErrorMessage(null);
                    }}
                    className="w-full pl-10 pr-3.5 h-11 sm:h-12 rounded-2xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/60 dark:border-[#42474E]/60 text-xs sm:text-sm font-mono text-[#191C20] dark:text-[#E2E2E6] placeholder-[#72777F] dark:placeholder-[#8C9199] focus:outline-none focus:ring-2 focus:ring-[#00639B] transition-all"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. BARRA DE ACCIONES INFERIOR (Ergonomía Thumb Zone para teléfono y PC) */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={handleRequestCancel}
            disabled={isSubmitting}
            className="w-full sm:w-auto h-11 sm:h-12 px-6 rounded-full text-xs sm:text-sm font-bold text-[#41474D] dark:text-[#C2C7CF] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSubmitting || (addMode === 'file' && !selectedFile)}
            className="w-full sm:w-auto h-11 sm:h-12 px-8 rounded-full text-xs sm:text-sm font-extrabold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>Guardando documento...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-4.5 h-4.5 stroke-[2.4]" />
                <span>{addMode === 'file' ? 'Vincular Archivo Ahora' : 'Guardar Enlace Ahora'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 5. MODAL M3: CONFIRMACIÓN PARA SALIR SIN GUARDAR */}
      {showDiscardModal && (
        <Modal
          isOpen={showDiscardModal}
          onClose={() => setShowDiscardModal(false)}
          title="¿Salir sin guardar?"
          maxWidth="sm"
        >
          <div className="space-y-4 -mt-2">
            <div className="flex items-start gap-3.5 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-2xs">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h4 className="text-sm font-bold text-[#191C20] dark:text-[#E2E2E6]">
                  Se perderán los cambios no vinculados
                </h4>
                <p className="text-xs text-[#72777F] dark:text-[#8C9199] leading-relaxed">
                  {selectedFile
                    ? `Tienes seleccionado el archivo "${selectedFile.name}". Si decides salir ahora, no se vinculará a la materia y se descartará.`
                    : linkName.trim() || linkUrl.trim()
                    ? `Has ingresado datos para el enlace "${linkName.trim() || 'nuevo'}". Si decides salir ahora, la información se perderá.`
                    : 'Estás a punto de salir del formulario de vinculación. ¿Deseas descartar este proceso y volver al catálogo?'}
                </p>
              </div>
            </div>

            {/* Acciones del Diálogo Ergonómicas */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4 stroke-[2]" />
                <span>Salir sin guardar</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                Seguir editando
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
