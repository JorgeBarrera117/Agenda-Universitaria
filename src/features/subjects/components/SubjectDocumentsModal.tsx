import React, { useState, useRef } from 'react';
import {
  FileText,
  FileDown,
  Presentation,
  Table,
  File,
  Plus,
  Trash2,
  X,
  Link as LinkIcon,
  HardDrive,
  FolderOpen,
  ArrowUpRight,
} from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { SubjectBadge } from './SubjectIcon';
import { useSubjectDocuments, type SubjectDocumentItem } from '../hooks/useSubjectDocuments';
import type { Subject } from '../types';

interface SubjectDocumentsModalProps {
  subject: Subject | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SubjectDocumentsModal: React.FC<SubjectDocumentsModalProps> = ({
  subject,
  isOpen,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    documents,
    addLocalDocument,
    addExternalLink,
    openDocument,
    deleteDocument,
  } = useSubjectDocuments(subject?.id);

  const [isAddingLink, setIsAddingLink] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isOpeningId, setIsOpeningId] = useState<string | null>(null);

  if (!subject) return null;

  // Manejar selección de archivo local
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      await addLocalDocument(subject.id, file);
      // Limpiar input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Error al vincular el archivo.');
    }
  };

  // Guardar enlace externo
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkName.trim() || !linkUrl.trim()) {
      setError('Escribe un nombre y la URL del enlace.');
      return;
    }

    try {
      setError(null);
      await addExternalLink(subject.id, linkName.trim(), linkUrl.trim());
      setLinkName('');
      setLinkUrl('');
      setIsAddingLink(false);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Error al guardar el enlace.');
    }
  };

  // Abrir documento
  const handleOpenDoc = async (doc: SubjectDocumentItem) => {
    try {
      setIsOpeningId(doc.id);
      setError(null);
      await openDocument(doc);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Error al abrir el documento.');
    } finally {
      setIsOpeningId(null);
    }
  };

  // Helper para formato de peso de archivo
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper para glifo y color de formato
  const getFormatVisuals = (ext: string, isLink?: boolean) => {
    if (isLink) {
      return {
        bg: '#00639B',
        icon: <LinkIcon className="w-5 h-5 text-white" />,
        label: 'ENLACE',
      };
    }

    const clean = ext.toLowerCase();
    switch (clean) {
      case 'doc':
      case 'docx':
        return {
          bg: '#185ABD', // Microsoft Word Blue
          icon: <FileText className="w-5 h-5 text-white" />,
          label: 'WORD',
        };
      case 'pdf':
        return {
          bg: '#D9381E', // Adobe Acrobat Red
          icon: <FileDown className="w-5 h-5 text-white" />,
          label: 'PDF',
        };
      case 'ppt':
      case 'pptx':
        return {
          bg: '#D04423', // PowerPoint Orange
          icon: <Presentation className="w-5 h-5 text-white" />,
          label: 'SLIDES',
        };
      case 'xls':
      case 'xlsx':
        return {
          bg: '#107C41', // Excel Green
          icon: <Table className="w-5 h-5 text-white" />,
          label: 'EXCEL',
        };
      default:
        return {
          bg: '#5E6B7A',
          icon: <File className="w-5 h-5 text-white" />,
          label: clean.toUpperCase(),
        };
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="lg">
      <div className="space-y-4 -mt-2">
        {/* Cabecera Material Design 3 */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F1F4FA] dark:bg-[#1D2024] border border-[#C3C7D0]/40 dark:border-[#43474E]/40 shadow-xs">
          <SubjectBadge icon={subject.icon} color={subject.color} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] tracking-wider shadow-2xs">
                {subject.code || 'ASIGNATURA'}
              </span>
              <span className="text-[11px] font-bold text-[#72777F] dark:text-[#8C9199]">
                Acceso Directo a Documentos
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-[#191C20] dark:text-[#E2E2E6] truncate leading-tight mt-0.5">
              {subject.name}
            </h3>
          </div>
        </div>

        {/* Input Oculto de Archivos Locales */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Barra de Acciones para Vincular */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-bold text-[#43474E] dark:text-[#C3C7D0]">
            Archivos Vinculados ({documents.length})
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Vincular Archivo Local */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] transition-all active:scale-95 shadow-xs cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Vincular Archivo</span>
            </button>

            {/* Botón Vincular Enlace (Drive / Web) */}
            <button
              type="button"
              onClick={() => setIsAddingLink(!isAddingLink)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-[#E2E7EF] dark:bg-[#272A2F] text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] transition-all active:scale-95 cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Enlace</span>
            </button>
          </div>
        </div>

        {/* Formulario Inline para Enlaces Web / Drive */}
        {isAddingLink && (
          <form
            onSubmit={handleSaveLink}
            className="p-3.5 rounded-2xl bg-[#F1F4FA] dark:bg-[#272A2F] border border-[#00639B]/30 dark:border-[#92CCFF]/30 space-y-2.5 animate-in fade-in duration-150"
          >
            <div className="text-xs font-black text-[#191C20] dark:text-[#E2E2E6] flex items-center justify-between">
              <span>Vincular Enlace (Google Drive / OneDrive / Web)</span>
              <button
                type="button"
                onClick={() => setIsAddingLink(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nombre (ej. Diapositivas Drive)"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1D2024] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 text-[#191C20] dark:text-[#E2E2E6] focus:outline-none focus:ring-1 focus:ring-[#00639B]"
              />
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1D2024] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 text-[#191C20] dark:text-[#E2E2E6] focus:outline-none focus:ring-1 focus:ring-[#00639B]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingLink(false)}
                className="px-3 py-1.5 text-xs font-semibold text-[#43474E] dark:text-[#C3C7D0] hover:bg-slate-200 dark:hover:bg-white/10 rounded-full"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] rounded-full shadow-2xs"
              >
                Guardar Enlace
              </button>
            </div>
          </form>
        )}

        {/* Mensaje de error si ocurre */}
        {error && (
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}

        {/* Lista de Documentos Vinculados */}
        {documents.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-[24px] border-2 border-dashed border-[#C3C7D0]/50 dark:border-[#43474E]/40 space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-[#E2E7EF] dark:bg-[#272A2F] text-[#00639B] dark:text-[#92CCFF] flex items-center justify-center mx-auto shadow-xs">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[#191C20] dark:text-[#E2E2E6]">
              Sin documentos vinculados
            </h4>
            <p className="text-xs text-[#72777F] dark:text-[#8C9199] max-w-sm mx-auto leading-relaxed">
              Vincula guías en PDF, libros, informes de Word o presentaciones guardadas en tu celular para abrirlas en un toque desde la agenda.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] hover:bg-[#b9d7ff] transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Vincular mi primer archivo</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
            {documents.map((doc) => {
              const visuals = getFormatVisuals(doc.fileExtension, doc.isExternalLink);
              const isOpening = isOpeningId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="p-3 rounded-2xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/60 dark:border-[#43474E]/60 flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs hover:border-[#00639B]/40 transition-all group"
                >
                  {/* Lado Izquierdo: Ícono representativo y Metadatos */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Squircle de Formato */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ring-1 ring-white/20 select-none"
                      style={{ backgroundColor: visuals.bg }}
                    >
                      {visuals.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] truncate group-hover:text-[#00639B] dark:group-hover:text-[#92CCFF] transition-colors">
                        {doc.name}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-[#72777F] dark:text-[#8C9199] mt-0.5 flex-wrap">
                        <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-[#E2E7EF] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0]">
                          {visuals.label}
                        </span>
                        {doc.sizeBytes && (
                          <>
                            <span>•</span>
                            <span>{formatFileSize(doc.sizeBytes)}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>
                          {new Date(doc.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lado Derecho: Botón de Abrir y Eliminar */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isOpening}
                      onClick={() => handleOpenDoc(doc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] hover:bg-[#b9d7ff] dark:hover:bg-[#005d92] active:scale-95 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                      title="Abrir en la aplicación correspondiente"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {isOpening ? 'Abriendo...' : 'Abrir'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteDocument(doc.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-colors cursor-pointer"
                      title="Quitar acceso directo"
                      aria-label="Quitar acceso directo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
