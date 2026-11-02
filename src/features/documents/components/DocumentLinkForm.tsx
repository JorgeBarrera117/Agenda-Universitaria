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
} from 'lucide-react';
import type { Subject } from '../../subjects/types';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
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
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interceptar botón atrás físico en Android para volver a la lista
  useBackButton(
    () => {
      onCancel();
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

  // Ícono según extensión del archivo seleccionado
  const getFilePreviewIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return <FileText className="w-6 h-6 text-red-500" />;
      case 'ppt':
      case 'pptx':
        return <Presentation className="w-6 h-6 text-orange-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-6 h-6 text-blue-500" />;
      case 'xls':
      case 'xlsx':
        return <Table className="w-6 h-6 text-emerald-500" />;
      default:
        return <File className="w-6 h-6 text-slate-500" />;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

  return (
    <div className="w-full pb-10 space-y-4 animate-in fade-in duration-150">
      {/* 1. ENCABEZADO CANÓNICO M3 DEL APARTADO */}
      <div className="flex items-center gap-3 pb-3 border-b border-[#C2C7CE]/40 dark:border-[#42474E]/40">
        <button
          type="button"
          onClick={onCancel}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76]/50 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
          aria-label="Volver al catálogo de documentos"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-black text-[#191C20] dark:text-[#E2E2E6] tracking-tight truncate">
            Vincular Documento
          </h2>
          <p className="text-xs text-[#72777F] dark:text-[#8C9199] truncate">
            Asocia archivos de tu dispositivo o enlaces de nube a tus asignaturas.
          </p>
        </div>
      </div>

      {/* Alerta de Error si existe */}
      {errorMessage && (
        <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 2. PASO 1: SELECCIÓN DE ASIGNATURA DESTINO */}
        <div className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-black text-[#00639B] dark:text-[#92CCFF] uppercase tracking-wider block">
                Paso 1 de 2
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#191C20] dark:text-[#E2E2E6]">
                Asignatura Destino
              </h3>
            </div>
            {currentSubject && (
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/40 dark:border-[#42474E]/40">
                <SubjectBadge icon={currentSubject.icon} color={currentSubject.color} size="sm" />
                <span className="text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] truncate max-w-[150px]">
                  {currentSubject.name}
                </span>
              </div>
            )}
          </div>

          {/* Selector M3 con espacio vertical amplio (sin recortes ni modales) */}
          <M3Select
            value={selectedSubjectId}
            onChange={(val) => {
              setSelectedSubjectId(val);
              setErrorMessage(null);
            }}
            options={subjectOptions}
            placeholder="Selecciona la materia destino..."
            required
          />

          {/* Píldoras de Acceso Rápido para cambiar de materia en 1 toque */}
          {subjects.length > 1 && (
            <div className="pt-1">
              <span className="text-[10px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block mb-1.5">
                Acceso rápido:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
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
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-[#00639B] text-white shadow-2xs'
                          : 'bg-[#E2E7EF]/80 dark:bg-[#272A2F]/80 text-[#41474D] dark:text-[#C2C7CF] hover:bg-[#D0E4FF]/50'
                      }`}
                    >
                      <SubjectBadge icon={subj.icon} color={subj.color} size="sm" />
                      <span className="truncate max-w-[120px]">{subj.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. PASO 2: TIPO DE RECURSO Y CARGA */}
        <div className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-3.5 shadow-2xs">
          <div>
            <span className="text-[10px] font-mono font-black text-[#00639B] dark:text-[#92CCFF] uppercase tracking-wider block">
              Paso 2 de 2
            </span>
            <h3 className="text-sm sm:text-base font-bold text-[#191C20] dark:text-[#E2E2E6]">
              Origen del Documento
            </h3>
          </div>

          {/* Segmented Button M3 */}
          <div className="flex p-1 rounded-2xl bg-[#E2E7EF] dark:bg-[#272A2F]">
            <button
              type="button"
              onClick={() => {
                setAddMode('file');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                addMode === 'file'
                  ? 'bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] shadow-xs'
                  : 'text-[#41474D] dark:text-[#C2C7CF] hover:text-[#191C20] dark:hover:text-white'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Archivo Local (Dispositivo)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode('link');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                addMode === 'link'
                  ? 'bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] shadow-xs'
                  : 'text-[#41474D] dark:text-[#C2C7CF] hover:text-[#191C20] dark:hover:text-white'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
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

          {/* CONTENIDO SEGÚN EL MODO */}
          {addMode === 'file' ? (
            <div className="space-y-3">
              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 sm:p-10 rounded-2xl border-2 border-dashed border-[#00639B]/50 dark:border-[#92CCFF]/40 text-center space-y-2.5 hover:bg-[#D0E4FF]/15 dark:hover:bg-[#004B76]/15 transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] flex items-center justify-center mx-auto shadow-xs group-hover:scale-105 transition-transform">
                    <UploadCloud className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-[#191C20] dark:text-[#E2E2E6]">
                      Toca aquí para seleccionar un archivo
                    </h4>
                    <p className="text-xs text-[#72777F] dark:text-[#8C9199] max-w-sm mx-auto mt-1 leading-relaxed">
                      Soporta guías en PDF, diapositivas PPTX, documentos Word (DOCX), hojas Excel (XLSX), notas de texto o fotos.
                    </p>
                  </div>
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#E2E7EF] dark:bg-[#272A2F] text-[#00639B] dark:text-[#92CCFF] border border-[#C2C7CE]/60 dark:border-[#42474E]/60">
                      <HardDrive className="w-3.5 h-3.5" /> Explorar en este dispositivo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#00639B]/40 dark:border-[#92CCFF]/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1D2024] flex items-center justify-center shrink-0 shadow-2xs">
                      {getFilePreviewIcon(selectedFile.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] truncate">
                        {selectedFile.name}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#72777F] dark:text-[#8C9199] mt-0.5 font-medium">
                        <span className="font-mono">{formatFileSize(selectedFile.size)}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                          <FileCheck className="w-3 h-3" /> Listo para vincular
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#00639B] dark:text-[#92CCFF] bg-white dark:bg-[#1D2024] hover:bg-[#D0E4FF]/40 dark:hover:bg-[#004B76]/30 transition-colors shrink-0 border border-[#C2C7CE]/40 dark:border-[#42474E]/40"
                  >
                    Cambiar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#41474D] dark:text-[#C2C7CF] uppercase tracking-wider mb-1">
                  Nombre Descriptivo del Enlace <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ej. Carpeta de Diapositivas Unidad 1 (Google Drive)"
                  value={linkName}
                  onChange={(e) => {
                    setLinkName(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/60 dark:border-[#42474E]/60 text-xs sm:text-sm text-[#191C20] dark:text-[#E2E2E6] focus:outline-none focus:ring-2 focus:ring-[#00639B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#41474D] dark:text-[#C2C7CF] uppercase tracking-wider mb-1">
                  Dirección URL del Enlace <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... o https://notion.so/..."
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/60 dark:border-[#42474E]/60 text-xs sm:text-sm font-mono text-[#191C20] dark:text-[#E2E2E6] focus:outline-none focus:ring-2 focus:ring-[#00639B]"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. BOTONES DE ACCIÓN INFERIOR */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-[#41474D] dark:text-[#C2C7CF] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSubmitting || (addMode === 'file' && !selectedFile)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-extrabold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4 stroke-[2.4]" />
                <span>{addMode === 'file' ? 'Vincular Archivo' : 'Guardar Enlace'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
