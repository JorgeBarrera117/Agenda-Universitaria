import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  X,
  FileText,
  Table,
  Presentation,
  File,
  Link as LinkIcon,
  HardDrive,
  Trash2,
  ArrowUpRight,
  FolderOpen,
  Plus,
  Info,
  Filter,
  ArrowUpDown,
  Copy,
  Check,
  RefreshCw,
  FolderKanban,
  FolderPlus,
  Tag,
  Clock,
  Database,
  Smartphone,
} from 'lucide-react';
import { useSubjectDocuments, type SubjectDocumentItem } from '../../subjects/hooks/useSubjectDocuments';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { M3Select } from '../../../shared/components/M3Select';
import { Modal } from '../../../shared/components/Modal';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';

interface DocumentsViewProps {
  isActive?: boolean;
}

type FormatFilterType = 'all' | 'pdf' | 'slides' | 'docs' | 'sheets' | 'links' | 'other';
type SortByType = 'newest' | 'oldest' | 'largest' | 'name';

export const DocumentsView: React.FC<DocumentsViewProps> = ({ isActive = true }) => {
  const { documents, addLocalDocument, addExternalLink, openDocument, deleteDocument, reassignSubject } =
    useSubjectDocuments();
  const { subjects } = useSubjects();

  // Estados de Búsqueda, Filtros y Ordenamiento
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<FormatFilterType>('all');
  const [sortBy, setSortBy] = useState<SortByType>('newest');

  // Modales
  const [selectedDocForInfo, setSelectedDocForInfo] = useState<SubjectDocumentItem | null>(null);
  const [docToReassign, setDocToReassign] = useState<SubjectDocumentItem | null>(null);
  const [newReassignedSubjectId, setNewReassignedSubjectId] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Formulario para vincular archivo/enlace nuevo
  const [targetSubjectId, setTargetSubjectId] = useState(subjects[0]?.id || '');
  const [addMode, setAddMode] = useState<'file' | 'link'>('file');
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados interactivos
  const [isOpeningId, setIsOpeningId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Botón físico Atrás en Android
  useBackButton(
    () => {
      if (selectedDocForInfo) {
        setSelectedDocForInfo(null);
        return true;
      }
      if (docToReassign) {
        setDocToReassign(null);
        return true;
      }
      if (isAddModalOpen) {
        setIsAddModalOpen(false);
        return true;
      }
      return false;
    },
    BACK_PRIORITY.MODAL,
    isActive && (!!selectedDocForInfo || !!docToReassign || isAddModalOpen)
  );

  // Helper para mapear formato a glifo y colores M3
  const getFormatVisuals = (ext: string, isLink?: boolean) => {
    if (isLink) {
      return {
        bg: '#2563EB',
        icon: <LinkIcon className="w-5 h-5 text-white" />,
        label: 'ENLACE',
        category: 'links' as FormatFilterType,
      };
    }

    const clean = ext.toLowerCase();
    switch (clean) {
      case 'pdf':
        return {
          bg: '#D9381E',
          icon: <FileText className="w-5 h-5 text-white" />,
          label: 'PDF',
          category: 'pdf' as FormatFilterType,
        };
      case 'ppt':
      case 'pptx':
        return {
          bg: '#D04423',
          icon: <Presentation className="w-5 h-5 text-white" />,
          label: 'SLIDES',
          category: 'slides' as FormatFilterType,
        };
      case 'doc':
      case 'docx':
        return {
          bg: '#185ABD',
          icon: <FileText className="w-5 h-5 text-white" />,
          label: 'WORD',
          category: 'docs' as FormatFilterType,
        };
      case 'xls':
      case 'xlsx':
        return {
          bg: '#107C41',
          icon: <Table className="w-5 h-5 text-white" />,
          label: 'EXCEL',
          category: 'sheets' as FormatFilterType,
        };
      default:
        return {
          bg: '#5E6B7A',
          icon: <File className="w-5 h-5 text-white" />,
          label: clean.toUpperCase(),
          category: 'other' as FormatFilterType,
        };
    }
  };

  // Helper para formatear peso de bytes a legible
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Mapeo rápido de materias por ID
  const subjectsMap = useMemo(() => {
    const map = new Map<string, (typeof subjects)[0]>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  // Cálculos de estadísticas globales
  const stats = useMemo(() => {
    let totalBytes = 0;
    const subjectsWithDocs = new Set<string>();

    documents.forEach((d) => {
      if (d.sizeBytes) totalBytes += d.sizeBytes;
      if (d.subjectId) subjectsWithDocs.add(d.subjectId);
    });

    return {
      totalCount: documents.length,
      totalBytesFormatted: formatFileSize(totalBytes),
      totalBytesRaw: totalBytes,
      subjectsCount: subjectsWithDocs.size,
    };
  }, [documents]);

  // Filtrado y Ordenamiento
  const filteredAndSortedDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        // Filtro de Búsqueda
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = doc.name.toLowerCase().includes(q);
          const subj = subjectsMap.get(doc.subjectId);
          const matchSubj = subj ? subj.name.toLowerCase().includes(q) || (subj.code && subj.code.toLowerCase().includes(q)) : false;
          if (!matchName && !matchSubj) return false;
        }

        // Filtro de Materia
        if (selectedSubjectFilter !== 'all' && doc.subjectId !== selectedSubjectFilter) {
          return false;
        }

        // Filtro de Formato
        if (selectedFormatFilter !== 'all') {
          const visuals = getFormatVisuals(doc.fileExtension, doc.isExternalLink);
          if (visuals.category !== selectedFormatFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'largest') {
          return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [documents, searchQuery, selectedSubjectFilter, selectedFormatFilter, sortBy, subjectsMap]);

  // Abrir documento con manejo de estados
  const handleOpenDoc = async (doc: SubjectDocumentItem) => {
    try {
      setIsOpeningId(doc.id);
      setActionError(null);
      await openDocument(doc);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('No se pudo abrir el documento.');
      }
    } finally {
      setIsOpeningId(null);
    }
  };

  // Copiar texto al portapapeles con feedback
  const handleCopyText = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Vincular Archivo Local desde Input
  const handleSelectLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetSubjectId) return;

    try {
      setActionError(null);
      await addLocalDocument(targetSubjectId, file);
      setIsAddModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
      else setActionError('Error al vincular el archivo.');
    }
  };

  // Guardar Enlace Externo
  const handleSaveExternalLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkName.trim() || !linkUrl.trim() || !targetSubjectId) {
      setActionError('Completa todos los campos obligatorios.');
      return;
    }

    try {
      setActionError(null);
      await addExternalLink(targetSubjectId, linkName.trim(), linkUrl.trim());
      setLinkName('');
      setLinkUrl('');
      setIsAddModalOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
      else setActionError('Error al guardar el enlace.');
    }
  };

  // Confirmar Reasignación de Materia
  const handleConfirmReassign = async () => {
    if (!docToReassign || !newReassignedSubjectId) return;
    try {
      await reassignSubject(docToReassign.id, newReassignedSubjectId);
      setDocToReassign(null);
      setNewReassignedSubjectId('');
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
    }
  };

  // Opciones para M3Select de Materias
  const subjectSelectOptions = useMemo(() => {
    return subjects.map((s) => ({
      value: s.id,
      label: s.name,
      sublabel: s.code || 'ASIGNATURA',
      color: s.color,
      icon: <SubjectBadge icon={s.icon} color={s.color} size="select" />,
    }));
  }, [subjects]);

  // Abrir modal de vincular documento con validaciones
  const handleOpenAddModal = () => {
    if (subjects.length === 0) {
      setActionError('Debes registrar al menos una asignatura antes de vincular archivos.');
      return;
    }
    if (!targetSubjectId) setTargetSubjectId(subjects[0]?.id || '');
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* ======================================================== */}
      {/* 1. CABECERA PRINCIPAL MATERIAL DESIGN 3 Y RESUMEN        */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5 rounded-[28px] bg-[#F1F4FA] dark:bg-[#1D2024] border border-[#C2C7CE]/40 dark:border-[#42474E]/40 shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] flex items-center justify-center shadow-xs shrink-0">
            <FolderKanban className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#E2E7EF] dark:bg-[#272A2F] text-[#41474D] dark:text-[#C2C7CF]">
                REPOSITORIO DIGITAL
              </span>
              <span className="text-xs font-semibold text-[#72777F] dark:text-[#8C9199]">
                {stats.totalCount} {stats.totalCount === 1 ? 'archivo' : 'archivos'} • {stats.totalBytesFormatted}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#191C20] dark:text-[#E2E2E6] tracking-tight leading-tight mt-0.5 truncate">
              Archivos y Documentos
            </h2>
          </div>
        </div>

        {/* Botón Primario M3 para Escritorio (en móvil se usa el FAB flotante) */}
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="hidden sm:inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Vincular Documento</span>
        </button>
      </div>

      {/* Alerta de Error si ocurre */}
      {actionError && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-900/40">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="p-1 hover:bg-red-100 rounded-full">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. BARRA DE BÚSQUEDA Y HERRAMIENTAS DE FILTRADO M3       */}
      {/* ======================================================== */}
      <div className="space-y-3">
        {/* Barra de Búsqueda y Ordenamiento */}
        <div className="flex items-center gap-2 flex-col sm:flex-row">
          {/* M3 Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#72777F] dark:text-[#8C9199]" />
            <input
              type="text"
              placeholder="Buscar por nombre de archivo o asignatura..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-11 pr-10 rounded-full bg-[#E2E7EF]/70 dark:bg-[#272A2F]/70 text-[#191C20] dark:text-[#E2E2E6] text-xs sm:text-sm placeholder:text-[#72777F] dark:placeholder:text-[#8C9199] border border-transparent focus:border-[#00639B] dark:focus:border-[#92CCFF] focus:outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#72777F] hover:text-[#191C20] dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Orden M3 */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 px-3 h-12 rounded-full bg-[#E2E7EF]/70 dark:bg-[#272A2F]/70 border border-[#C2C7CE]/40 dark:border-[#42474E]/40 text-xs font-semibold text-[#41474D] dark:text-[#C2C7CF] w-full sm:w-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortByType)}
                className="bg-transparent border-none outline-none font-bold text-xs text-[#191C20] dark:text-[#E2E2E6] cursor-pointer w-full sm:w-auto pr-2"
              >
                <option value="newest" className="dark:bg-[#1D2024]">Más recientes</option>
                <option value="oldest" className="dark:bg-[#1D2024]">Más antiguos</option>
                <option value="largest" className="dark:bg-[#1D2024]">Mayor tamaño</option>
                <option value="name" className="dark:bg-[#1D2024]">Nombre (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chips Deslizables de Asignatura (Filtro Horizontal) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar select-none">
          <button
            type="button"
            onClick={() => setSelectedSubjectFilter('all')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedSubjectFilter === 'all'
                ? 'bg-[#00639B] text-white shadow-2xs'
                : 'bg-[#E2E7EF]/80 dark:bg-[#272A2F]/80 text-[#41474D] dark:text-[#C2C7CF] hover:bg-[#D0E4FF]/50'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5 shrink-0" />
            <span>Todas las Asignaturas</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
              {documents.length}
            </span>
          </button>

          {subjects.map((subj) => {
            const count = documents.filter((d) => d.subjectId === subj.id).length;
            const isSelected = selectedSubjectFilter === subj.id;

            return (
              <button
                key={subj.id}
                type="button"
                onClick={() => setSelectedSubjectFilter(subj.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#00639B] text-white shadow-2xs'
                    : 'bg-[#E2E7EF]/80 dark:bg-[#272A2F]/80 text-[#41474D] dark:text-[#C2C7CF] hover:bg-[#D0E4FF]/50'
                }`}
              >
                <SubjectBadge
                  icon={subj.icon}
                  color={subj.color}
                  size="sm"
                  className="w-4.5 h-4.5 rounded-md shadow-2xs ring-1 ring-white/20 shrink-0"
                />
                <span className="max-w-[130px] truncate">{subj.name}</span>
                {count > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Chips de Categoría de Formato */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar select-none text-[11px] font-bold">
          <span className="text-[#72777F] dark:text-[#8C9199] shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Tipo:
          </span>

          {[
            { id: 'all', label: 'Todos' },
            { id: 'pdf', label: 'PDFs' },
            { id: 'slides', label: 'Diapositivas' },
            { id: 'docs', label: 'Documentos Word' },
            { id: 'sheets', label: 'Hojas Excel' },
            { id: 'links', label: 'Enlaces Web' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedFormatFilter(f.id as FormatFilterType)}
              className={`px-2.5 py-1 rounded-full transition-all shrink-0 cursor-pointer ${
                selectedFormatFilter === f.id
                  ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] font-black shadow-2xs'
                  : 'bg-transparent text-[#72777F] dark:text-[#8C9199] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. LISTADO DE ARCHIVOS EN GRID Y TARJETAS                */}
      {/* ======================================================== */}
      {filteredAndSortedDocs.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-[28px] border-2 border-dashed border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-3 bg-[#F1F4FA]/30 dark:bg-[#1D2024]/30">
          <div className="w-14 h-14 rounded-2xl bg-[#E2E7EF] dark:bg-[#272A2F] text-[#00639B] dark:text-[#92CCFF] flex items-center justify-center mx-auto shadow-xs">
            <FolderOpen className="w-7 h-7 stroke-[1.8]" />
          </div>
          <h3 className="text-base font-bold text-[#191C20] dark:text-[#E2E2E6]">
            {documents.length === 0
              ? 'Aún no has vinculado ningún documento'
              : 'No se encontraron archivos con los filtros actuales'}
          </h3>
          <p className="text-xs text-[#72777F] dark:text-[#8C9199] max-w-md mx-auto leading-relaxed">
            {documents.length === 0
              ? 'Vincula diapositivas en PowerPoint, informes en Word, guías en PDF o enlaces a Google Drive para organizarlos por materia y abrirlos en tu celular con un solo toque.'
              : 'Prueba cambiando la asignatura seleccionada o borrando el término de búsqueda.'}
          </p>
          {documents.length === 0 && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#00639B] text-white hover:bg-[#005282] transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Vincular mi primer archivo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAndSortedDocs.map((doc) => {
            const visuals = getFormatVisuals(doc.fileExtension, doc.isExternalLink);
            const subj = subjectsMap.get(doc.subjectId);
            const isOpening = isOpeningId === doc.id;

            return (
              <div
                key={doc.id}
                onClick={() => !isOpening && handleOpenDoc(doc)}
                className={`p-3.5 rounded-[24px] bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs hover:border-[#00639B]/50 transition-all cursor-pointer group active:scale-[0.99] select-none ${
                  isOpening ? 'opacity-70 ring-2 ring-[#00639B]/40' : ''
                }`}
              >
                {/* Parte Superior: Ícono, Título y Botones de Acción */}
                <div className="flex items-start gap-3">
                  {/* Squircle M3 de Formato */}
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ring-1 ring-white/20 select-none"
                    style={{ backgroundColor: visuals.bg }}
                  >
                    {visuals.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-[#E2E7EF] dark:bg-[#272A2F] text-[#41474D] dark:text-[#C2C7CF]">
                        {visuals.label}
                      </span>
                      {doc.sizeBytes && (
                        <span className="text-[11px] font-semibold text-[#72777F] dark:text-[#8C9199]">
                          {formatFileSize(doc.sizeBytes)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] truncate group-hover:text-[#00639B] dark:group-hover:text-[#92CCFF] transition-colors mt-0.5 leading-snug">
                      {doc.name}
                    </h4>
                  </div>

                  {/* Botón de Información Técnica (i) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDocForInfo(doc);
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#72777F] hover:text-[#00639B] dark:hover:text-[#92CCFF] hover:bg-[#D0E4FF]/40 dark:hover:bg-[#004B76]/30 transition-colors shrink-0"
                    title="Ver detalles técnicos y ruta"
                    aria-label="Información del archivo"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>

                {/* Parte Inferior: Materia asignada, Fecha y Botones */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[11px]">
                  {/* Chip de Materia */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {subj ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <SubjectBadge
                          icon={subj.icon}
                          color={subj.color}
                          size="sm"
                          className="w-4.5 h-4.5 rounded-md shadow-2xs ring-1 ring-white/20 shrink-0"
                        />
                        <span className="font-bold text-[#191C20] dark:text-[#E2E2E6] truncate">
                          {subj.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic truncate">Materia no asignada</span>
                    )}
                  </div>

                  {/* Botones Abrir y Menú */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isOpening}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDoc(doc);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] hover:bg-[#b9d7ff] dark:hover:bg-[#005d92] active:scale-95 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <ArrowUpRight className={`w-3.5 h-3.5 ${isOpening ? 'animate-spin' : ''}`} />
                      <span>{isOpening ? 'Abriendo...' : 'Abrir'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocToReassign(doc);
                        setNewReassignedSubjectId(doc.subjectId);
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-[#00639B] dark:hover:text-[#92CCFF] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      title="Cambiar materia asignada"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDocument(doc.id);
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-colors cursor-pointer"
                      title="Quitar acceso directo"
                      aria-label="Quitar acceso directo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL M3 DE INFORMACIÓN TÉCNICA Y AUDITORÍA           */}
      {/* ======================================================== */}
      {selectedDocForInfo && (
        <Modal
          isOpen={!!selectedDocForInfo}
          onClose={() => setSelectedDocForInfo(null)}
          title="Ficha Técnica del Documento"
          maxWidth="lg"
        >
          <div className="space-y-4 -mt-2">
            {/* Cabecera del archivo en el modal */}
            {(() => {
              const doc = selectedDocForInfo;
              const visuals = getFormatVisuals(doc.fileExtension, doc.isExternalLink);
              const subj = subjectsMap.get(doc.subjectId);
              const safeFileName = doc.name.replaceAll(/[\\/:*?"<>|]/g, '_');
              const androidInternalPath = `/data/user/0/com.agenda.universitaria/cache/shared_docs/${safeFileName}`;
              const androidContentUri = `content://com.agenda.universitaria.fileprovider/my_cache_images/shared_docs/${safeFileName}`;

              return (
                <>
                  <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#F1F4FA] dark:bg-[#1D2024] border border-[#C2C7CE]/40 dark:border-[#42474E]/40 shadow-xs">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: visuals.bg }}
                    >
                      {visuals.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-[#E2E7EF] dark:bg-[#272A2F] text-[#41474D] dark:text-[#C2C7CF]">
                          {visuals.label}
                        </span>
                        <span className="text-xs font-bold text-[#72777F] dark:text-[#8C9199]">
                          {formatFileSize(doc.sizeBytes)}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-[#191C20] dark:text-[#E2E2E6] truncate mt-0.5">
                        {doc.name}
                      </h4>
                    </div>
                  </div>

                  {/* Cuadrícula de Especificaciones */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {/* Materia Vinculada */}
                    <div className="p-3 rounded-2xl bg-white dark:bg-[#272A2F] border border-[#C2C7CE]/50 dark:border-[#42474E]/50">
                      <div className="flex items-center gap-1.5 text-[#72777F] dark:text-[#8C9199] font-medium mb-1">
                        <Tag className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
                        <span>Asignatura Asignada</span>
                      </div>
                      {subj ? (
                        <div className="flex items-center gap-2.5 mt-1.5">
                          <SubjectBadge
                            icon={subj.icon}
                            color={subj.color}
                            size="md"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-[#191C20] dark:text-[#E2E2E6] truncate block">
                              {subj.name}
                            </span>
                            {subj.code && (
                              <span className="font-mono text-[10px] text-[#72777F] dark:text-[#8C9199]">
                                {subj.code}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Sin asignar</span>
                      )}
                    </div>

                    {/* Fecha de Vinculación */}
                    <div className="p-3 rounded-2xl bg-white dark:bg-[#272A2F] border border-[#C2C7CE]/50 dark:border-[#42474E]/50">
                      <div className="flex items-center gap-1.5 text-[#72777F] dark:text-[#8C9199] font-medium mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
                        <span>Fecha y Hora de Registro</span>
                      </div>
                      <div className="font-bold text-[#191C20] dark:text-[#E2E2E6]">
                        {new Date(doc.createdAt).toLocaleString('es-ES', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>

                    {/* Tipo MIME Oficial */}
                    <div className="p-3 rounded-2xl bg-white dark:bg-[#272A2F] border border-[#C2C7CE]/50 dark:border-[#42474E]/50 sm:col-span-2">
                      <div className="flex items-center justify-between gap-2 text-[#72777F] dark:text-[#8C9199] font-medium mb-1">
                        <div className="flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
                          <span>Tipo MIME Registrado</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(doc.mimeType, 'mime')}
                          className="text-[11px] font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1"
                        >
                          {copiedField === 'mime' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedField === 'mime' ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] truncate bg-slate-100 dark:bg-[#1D2024] p-1.5 rounded-lg">
                        {doc.mimeType}
                      </div>
                    </div>

                    {/* Almacenamiento y Rutas del Sistema */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#272A2F] border border-[#C2C7CE]/50 dark:border-[#42474E]/50 sm:col-span-2 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[#72777F] dark:text-[#8C9199] font-bold">
                        <Smartphone className="w-4 h-4 text-[#00639B] dark:text-[#92CCFF]" />
                        <span>Ubicación y Almacenamiento en el Teléfono</span>
                      </div>

                      <div className="space-y-2">
                        {/* Almacén IndexedDB */}
                        <div>
                          <span className="text-[10px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block">
                            Base de Datos Local PWA (Persistencia Segura):
                          </span>
                          <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            IndexedDB → AgendaDocsCacheDB → objectStore: blobs (Clave: {doc.id})
                          </span>
                        </div>

                        {/* Ruta Interna de Android */}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block">
                              Ruta de Caché Nativa de Android (Sandboxed):
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(androidInternalPath, 'path')}
                              className="text-[10px] font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1"
                            >
                              {copiedField === 'path' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedField === 'path' ? 'Copiada' : 'Copiar Ruta'}</span>
                            </button>
                          </div>
                          <div className="font-mono text-[10px] sm:text-[11px] text-[#191C20] dark:text-[#E2E2E6] bg-slate-100 dark:bg-[#1D2024] p-2 rounded-lg break-all select-all">
                            {androidInternalPath}
                          </div>
                        </div>

                        {/* URI Seguro de FileProvider */}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block">
                              URI de Intercambio FileProvider (Hacia Word, PowerPoint, etc.):
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(androidContentUri, 'uri')}
                              className="text-[10px] font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1"
                            >
                              {copiedField === 'uri' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedField === 'uri' ? 'Copiado' : 'Copiar URI'}</span>
                            </button>
                          </div>
                          <div className="font-mono text-[10px] text-[#00639B] dark:text-[#92CCFF] bg-[#D0E4FF]/30 dark:bg-[#004B76]/20 p-2 rounded-lg break-all select-all">
                            {androidContentUri}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botones de Acción al pie de la Ficha Técnica */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setSelectedDocForInfo(null)}
                      className="px-4 py-2 rounded-full text-xs font-semibold text-[#41474D] dark:text-[#C2C7CF] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                      Cerrar
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDocForInfo(null);
                        handleOpenDoc(doc);
                      }}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] shadow-xs active:scale-95 transition-all"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Abrir Documento con App</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* 5. MODAL M3 PARA VINCULAR NUEVO ARCHIVO O ENLACE         */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Vincular Documento a Asignatura"
          maxWidth="md"
        >
          <div className="space-y-4 -mt-2">
            {/* Input Oculto de Archivos */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*"
              onChange={handleSelectLocalFile}
              className="hidden"
            />

            {/* Selector de Asignatura Obligatorio M3 */}
            <div>
              <label className="block text-xs font-bold text-[#41474D] dark:text-[#C2C7CF] mb-1.5">
                Selecciona la Asignatura Destino:
              </label>
              <M3Select
                value={targetSubjectId}
                onChange={setTargetSubjectId}
                options={subjectSelectOptions}
                placeholder="Elige la materia..."
              />
            </div>

            {/* Selector de Tipo (Archivo vs Enlace) */}
            <div className="flex p-1 rounded-2xl bg-[#E2E7EF] dark:bg-[#272A2F]">
              <button
                type="button"
                onClick={() => setAddMode('file')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  addMode === 'file'
                    ? 'bg-[#00639B] text-white shadow-2xs'
                    : 'text-[#41474D] dark:text-[#C2C7CF] hover:bg-black/5'
                }`}
              >
                Archivo en Celular / PC
              </button>
              <button
                type="button"
                onClick={() => setAddMode('link')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  addMode === 'link'
                    ? 'bg-[#00639B] text-white shadow-2xs'
                    : 'text-[#41474D] dark:text-[#C2C7CF] hover:bg-black/5'
                }`}
              >
                Enlace (Google Drive / Web)
              </button>
            </div>

            {/* Contenido según el modo */}
            {addMode === 'file' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 rounded-[24px] border-2 border-dashed border-[#00639B]/40 dark:border-[#92CCFF]/40 text-center space-y-2 hover:bg-[#D0E4FF]/10 transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] flex items-center justify-center mx-auto shadow-xs">
                  <HardDrive className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#191C20] dark:text-[#E2E2E6]">
                  Toca aquí para seleccionar un archivo
                </h4>
                <p className="text-xs text-[#72777F] dark:text-[#8C9199] max-w-xs mx-auto">
                  Soporta presentaciones PPTX, documentos Word, guías PDF, hojas Excel y apuntes de clase.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveExternalLink} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#41474D] dark:text-[#C2C7CF] mb-1">
                    Nombre Descriptivo:
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Diapositivas en Google Drive"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/60 dark:border-[#42474E]/60 text-xs text-[#191C20] dark:text-[#E2E2E6] focus:outline-none focus:ring-2 focus:ring-[#00639B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#41474D] dark:text-[#C2C7CF] mb-1">
                    Dirección URL del Enlace:
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/60 dark:border-[#42474E]/60 text-xs text-[#191C20] dark:text-[#E2E2E6] focus:outline-none focus:ring-2 focus:ring-[#00639B]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-[#41474D] dark:text-[#C2C7CF]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] shadow-2xs"
                  >
                    Guardar Enlace
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* 6. MODAL M3 PARA REASIGNAR MATERIA                       */}
      {/* ======================================================== */}
      {docToReassign && (
        <Modal
          isOpen={!!docToReassign}
          onClose={() => setDocToReassign(null)}
          title="Reasignar Asignatura del Documento"
          maxWidth="sm"
        >
          <div className="space-y-4 -mt-2">
            <p className="text-xs text-[#72777F] dark:text-[#8C9199]">
              Cambia la materia a la cual está vinculado el documento <strong className="text-[#191C20] dark:text-[#E2E2E6]">{docToReassign.name}</strong>:
            </p>

            <M3Select
              value={newReassignedSubjectId}
              onChange={setNewReassignedSubjectId}
              options={subjectSelectOptions}
              placeholder="Seleccionar nueva materia..."
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setDocToReassign(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-[#41474D] dark:text-[#C2C7CF]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReassign}
                className="px-5 py-2 rounded-full text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] shadow-2xs"
              >
                Actualizar Materia
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Botón Flotante Móvil Reubicable (FAB con Snap a Bordes) */}
      {isActive && (
        <DraggableFAB
          colorScheme="documents"
          onClick={handleOpenAddModal}
          label="Vincular Documento"
          icon={<FolderPlus className="w-6 h-6 text-white stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
