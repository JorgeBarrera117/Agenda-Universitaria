import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Check,
  Tag,
  Clock,
  Database,
  Smartphone,
  FolderSync,
  Trash2,
  Link as LinkIcon,
  FileText,
  Presentation,
  Table,
  File,
  Loader2,
  Share2,
} from 'lucide-react';
import type { SubjectDocumentItem } from '../../subjects/hooks/useSubjectDocuments';
import type { Subject } from '../../subjects/types';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';

export interface DocumentDetailViewProps {
  document: SubjectDocumentItem;
  subject?: Subject;
  onBack: () => void;
  onOpen: (doc: SubjectDocumentItem) => Promise<void>;
  onShare: (doc: SubjectDocumentItem) => Promise<void>;
  onRequestReassign: (doc: SubjectDocumentItem) => void;
  onDelete: (doc: SubjectDocumentItem) => void;
  onShowToast: (msg: string) => void;
}

export const DocumentDetailView: React.FC<DocumentDetailViewProps> = ({
  document: doc,
  subject,
  onBack,
  onOpen,
  onShare,
  onRequestReassign,
  onDelete,
  onShowToast,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Interceptar botón atrás físico en Android para volver a la lista
  useBackButton(
    () => {
      onBack();
      return true;
    },
    BACK_PRIORITY.SUBVIEW,
    true
  );

  const handleCopyText = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    onShowToast('Información copiada al portapapeles');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
  };

  const handleShareClick = async () => {
    setIsSharing(true);
    try {
      await onShare(doc);
    } finally {
      setIsSharing(false);
    }
  };

  const handleOpenClick = async () => {
    setIsOpening(true);
    try {
      await onOpen(doc);
    } finally {
      setIsOpening(false);
    }
  };

  // Helper para tamaño
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Helper visual para ícono y colores M3
  const getFormatVisuals = (ext: string, isLink?: boolean) => {
    if (isLink) {
      return {
        bg: '#00639B',
        icon: <LinkIcon className="w-6 h-6 text-white stroke-[2.2]" />,
        label: 'ENLACE WEB',
      };
    }

    const clean = ext.toLowerCase();
    switch (clean) {
      case 'pdf':
        return {
          bg: '#D9381E',
          icon: <FileText className="w-6 h-6 text-white stroke-[2.2]" />,
          label: 'DOCUMENTO PDF',
        };
      case 'ppt':
      case 'pptx':
        return {
          bg: '#D04423',
          icon: <Presentation className="w-6 h-6 text-white stroke-[2.2]" />,
          label: 'PRESENTACIÓN SLIDES',
        };
      case 'doc':
      case 'docx':
        return {
          bg: '#185ABD',
          icon: <FileText className="w-6 h-6 text-white stroke-[2.2]" />,
          label: 'DOCUMENTO WORD',
        };
      case 'xls':
      case 'xlsx':
        return {
          bg: '#107C41',
          icon: <Table className="w-6 h-6 text-white stroke-[2.2]" />,
          label: 'HOJA DE CÁLCULO EXCEL',
        };
      default:
        return {
          bg: '#5E6B7A',
          icon: <File className="w-6 h-6 text-white stroke-[2.2]" />,
          label: clean ? `ARCHIVO ${clean.toUpperCase()}` : 'DOCUMENTO',
        };
    }
  };

  const visuals = getFormatVisuals(doc.fileExtension, doc.isExternalLink);
  const androidInternalPath = `/data/user/0/com.agenda.universitaria/files/documents/${doc.id}.${doc.fileExtension || 'bin'}`;
  const androidContentUri = `content://com.agenda.universitaria.fileprovider/external_files/${doc.name}`;

  return (
    <div className="w-full pb-12 space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      {/* 1. ENCABEZADO CANÓNICO M3 (Touch target 44px y alineación vertical) */}
      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-[#C2C7CE]/40 dark:border-[#42474E]/40 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76]/50 flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 shadow-2xs"
            aria-label="Volver al catálogo de documentos"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-[#191C20] dark:text-[#E2E2E6] tracking-tight truncate">
              Ficha Técnica
            </h2>
            <p className="text-xs sm:text-sm text-[#72777F] dark:text-[#8C9199] truncate mt-0.5">
              Especificaciones y rutas de almacenamiento del archivo.
            </p>
          </div>
        </div>

        {/* Acciones Rápidas del Encabezado */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRequestReassign(doc)}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-xs font-bold bg-[#E2E7EF] dark:bg-[#272A2F] text-[#00639B] dark:text-[#92CCFF] hover:bg-[#D0E4FF]/60 dark:hover:bg-[#004B76]/40 transition-colors cursor-pointer border border-[#C2C7CE]/40 dark:border-[#42474E]/40 shadow-2xs"
          >
            <FolderSync className="w-4 h-4 stroke-[2]" />
            <span className="hidden sm:inline">Cambiar Materia</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(doc)}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer border border-red-200 dark:border-red-900/40 shadow-2xs"
          >
            <Trash2 className="w-4 h-4 stroke-[2]" />
            <span className="hidden sm:inline">Eliminar</span>
          </button>
        </div>
      </div>

      {/* 2. TARJETA PRINCIPAL DE IDENTIDAD DEL ARCHIVO */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ring-1 ring-white/20 select-none"
              style={{ backgroundColor: visuals.bg }}
            >
              {visuals.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-[10px] px-2 py-0.5 rounded-md bg-[#E2E7EF] dark:bg-[#272A2F] text-[#41474D] dark:text-[#C2C7CF]">
                  {visuals.label}
                </span>
                {doc.sizeBytes && (
                  <span className="text-xs font-semibold text-[#72777F] dark:text-[#8C9199]">
                    {formatFileSize(doc.sizeBytes)}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black text-[#191C20] dark:text-[#E2E2E6] break-words mt-1 leading-snug">
                {doc.name}
              </h3>
            </div>
          </div>

          {/* Acciones: Compartir (secundario) y Abrir (principal), juntas a la derecha en PC */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleShareClick()}
            disabled={isSharing}
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-xs sm:text-sm font-extrabold border border-[var(--color-md-outline)] text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary-container)] active:scale-[0.98] transition-[transform,background-color] cursor-pointer shrink-0 disabled:opacity-60"
          >
            {isSharing ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Share2 className="w-4.5 h-4.5" />}
            <span>{doc.isExternalLink ? 'Compartir enlace' : 'Compartir archivo'}</span>
          </button>

          {/* Botón Principal: Abrir Documento (48px de altura ergonómica) */}
          <button
            type="button"
            onClick={handleOpenClick}
            disabled={isOpening}
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-full text-xs sm:text-sm font-extrabold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] shadow-xs active:scale-[0.98] transition-all cursor-pointer shrink-0"
          >
            {isOpening ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>Abriendo archivo...</span>
              </>
            ) : (
              <>
                <ArrowUpRight className="w-5 h-5 stroke-[2.4]" />
                <span>Abrir en Dispositivo</span>
              </>
            )}
          </button>
          </div>
        </div>
      </div>

      {/* 3. ESPECIFICACIONES TÉCNICAS EN GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Materia Vinculada */}
        <div className="p-4 rounded-2xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider">
              <Tag className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
              Asignatura
            </span>
            <button
              type="button"
              onClick={() => onRequestReassign(doc)}
              className="text-xs font-bold text-[#00639B] dark:text-[#92CCFF] hover:underline cursor-pointer"
            >
              Reasignar
            </button>
          </div>
          {subject ? (
            <div className="flex items-center gap-3 pt-1">
              <SubjectBadge icon={subject.icon} color={subject.color} size="md" />
              <div className="min-w-0">
                <span className="font-bold text-sm text-[#191C20] dark:text-[#E2E2E6] block truncate">
                  {subject.name}
                </span>
                {subject.code && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded font-mono text-[9px] font-black bg-black text-white dark:bg-white dark:text-black tracking-wider mt-0.5">
                    {subject.code}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">Sin asignatura asignada</span>
          )}
        </div>

        {/* Fecha de Registro */}
        <div className="p-4 rounded-2xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-2 shadow-2xs">
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
            Fecha de Registro
          </span>
          <div className="font-bold text-sm text-[#191C20] dark:text-[#E2E2E6] pt-1">
            {new Date(doc.createdAt).toLocaleString('es-ES', {
              dateStyle: 'full',
              timeStyle: 'short',
            })}
          </div>
        </div>

        {/* Tipo MIME Oficial */}
        <div className="p-4 rounded-2xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 sm:col-span-2 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider">
              <Database className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
              Tipo MIME Oficial
            </span>
            <button
              type="button"
              onClick={() => handleCopyText(doc.mimeType, 'mime')}
              className="text-xs font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#D0E4FF]/40 dark:hover:bg-[#004B76]/30 transition-colors cursor-pointer"
            >
              {copiedField === 'mime' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar MIME</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] p-2.5 rounded-xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 break-all select-all">
            {doc.mimeType}
          </div>
        </div>

        {/* Almacenamiento Local PWA & Móvil */}
        <div className="p-4 rounded-2xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 sm:col-span-2 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#00639B] dark:text-[#92CCFF]" />
            <h4 className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6]">
              Almacenamiento Local Offline-First & Android
            </h4>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Base de Datos IndexedDB */}
            <div className="p-3 rounded-xl bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#72777F] dark:text-[#8C9199] block">
                Persistencia en Base de Datos Local PWA:
              </span>
              <span className="font-mono text-xs text-[#191C20] dark:text-[#E2E2E6] break-all">
                IndexedDB → AgendaDocsCacheDB → objectStore: blobs (Clave: {doc.id})
              </span>
            </div>

            {/* Ruta Interna Sandboxed Android */}
            <div className="p-3 rounded-xl bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#72777F] dark:text-[#8C9199] block">
                  Ruta Sandboxed en Android:
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(androidInternalPath, 'path')}
                  className="text-[10px] font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-[#D0E4FF]/40 dark:hover:bg-[#004B76]/30 transition-colors cursor-pointer"
                >
                  {copiedField === 'path' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === 'path' ? 'Copiada' : 'Copiar'}</span>
                </button>
              </div>
              <div className="font-mono text-[11px] text-[#191C20] dark:text-[#E2E2E6] break-all select-all">
                {androidInternalPath}
              </div>
            </div>

            {/* URI FileProvider */}
            <div className="p-3 rounded-xl bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#72777F] dark:text-[#8C9199] block">
                  URI Segura FileProvider:
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText(androidContentUri, 'uri')}
                  className="text-[10px] font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-[#D0E4FF]/40 dark:hover:bg-[#004B76]/30 transition-colors cursor-pointer"
                >
                  {copiedField === 'uri' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === 'uri' ? 'Copiada' : 'Copiar'}</span>
                </button>
              </div>
              <div className="font-mono text-[11px] text-[#00639B] dark:text-[#92CCFF] break-all select-all">
                {androidContentUri}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
