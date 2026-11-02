import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import { useScrollCollapse } from '../../../shared/hooks/useScrollCollapse';

interface DocumentsViewProps {
  isActive?: boolean;
}

type FormatFilterType = 'all' | 'pdf' | 'slides' | 'docs' | 'sheets' | 'links' | 'other';
type SortByType = 'newest' | 'oldest' | 'largest' | 'name';

export const DocumentsView: React.FC<DocumentsViewProps> = ({ isActive = true }) => {
  const { documents, addLocalDocument, addExternalLink, openDocument, deleteDocument, reassignSubject } =
    useSubjectDocuments();
  const { subjects } = useSubjects();
  const isScrolled = useScrollCollapse(48);

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
  const [docToast, setDocToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpiar temporizadores para evitar fugas de memoria
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const showDocToast = (msg: string) => {
    setDocToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setDocToast(null), 3000);
  };

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
        bg: '#00639B',
        icon: <LinkIcon className="w-4.5 h-4.5 text-white" />,
        label: 'ENLACE',
        category: 'links' as FormatFilterType,
      };
    }

    const clean = ext.toLowerCase();
    switch (clean) {
      case 'pdf':
        return {
          bg: '#D9381E',
          icon: <FileText className="w-4.5 h-4.5 text-white" />,
          label: 'PDF',
          category: 'pdf' as FormatFilterType,
        };
      case 'ppt':
      case 'pptx':
        return {
          bg: '#D04423',
          icon: <Presentation className="w-4.5 h-4.5 text-white" />,
          label: 'SLIDES',
          category: 'slides' as FormatFilterType,
        };
      case 'doc':
      case 'docx':
        return {
          bg: '#185ABD',
          icon: <FileText className="w-4.5 h-4.5 text-white" />,
          label: 'WORD',
          category: 'docs' as FormatFilterType,
        };
      case 'xls':
      case 'xlsx':
        return {
          bg: '#107C41',
          icon: <Table className="w-4.5 h-4.5 text-white" />,
          label: 'EXCEL',
          category: 'sheets' as FormatFilterType,
        };
      default:
        return {
          bg: '#5E6B7A',
          icon: <File className="w-4.5 h-4.5 text-white" />,
          label: clean.toUpperCase(),
          category: 'other' as FormatFilterType,
        };
    }
  };

  // Helper para formatear peso de bytes
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Mapeo memoizado de materias por ID (Búsqueda O(1))
  const subjectsMap = useMemo(() => {
    const map = new Map<string, (typeof subjects)[0]>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  // Conteo memoizado de documentos por materia (Búsqueda O(1) en las píldoras de filtro)
  const subjectDocCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of documents) {
      if (d.subjectId) {
        counts.set(d.subjectId, (counts.get(d.subjectId) || 0) + 1);
      }
    }
    return counts;
  }, [documents]);

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
          const matchSubj = subj
            ? subj.name.toLowerCase().includes(q) || (subj.code && subj.code.toLowerCase().includes(q))
            : false;
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
    showDocToast('Información copiada al portapapeles');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
  };

  // Vincular Archivo Local desde Input
  const handleSelectLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetSubjectId) return;

    try {
      setActionError(null);
      await addLocalDocument(targetSubjectId, file);
      setIsAddModalOpen(false);
      showDocToast('Archivo vinculado correctamente');
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
      showDocToast('Enlace guardado correctamente');
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
      showDocToast('Asignatura actualizada correctamente');
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
    <div className="space-y-3.5 w-full animate-in fade-in duration-200">
      {/* 1. Encabezado del Apartado (Jerarquía Nivel 1 Compacta) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Archivos y Documentos
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF]">
              {stats.totalCount} {stats.totalCount === 1 ? 'archivo' : 'archivos'} • {stats.totalBytesFormatted}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Presentaciones, guías PDF, documentos Word y enlaces por materia.
          </p>
        </div>

        {/* Botón Primario M3 */}
        <button
          type="button"
          onClick={handleOpenAddModal}
          className={`hidden sm:inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] active:scale-95 transition-all duration-300 ease-out origin-right shadow-sm hover:shadow ring-1 ring-[#00639B]/25 dark:ring-[#92CCFF]/35 cursor-pointer shrink-0 whitespace-nowrap ${
            isScrolled ? 'scale-75 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
          }`}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Vincular Documento</span>
        </button>
      </div>

      {/* 2. Barra de Búsqueda y Herramientas de Filtrado M3 */}
      <div className="space-y-2.5">
        {/* Barra de Búsqueda y Ordenamiento */}
        <div className="flex items-center gap-2 flex-col sm:flex-row">
          {/* M3 Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#72777F] dark:text-[#8C9199]" />
            <input
              type="text"
              placeholder="Buscar por nombre de archivo o asignatura..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 sm:h-11 pl-10 pr-9 rounded-full bg-[#E2E7EF]/70 dark:bg-[#272A2F]/70 text-[#191C20] dark:text-[#E2E2E6] text-xs sm:text-sm placeholder:text-[#72777F] dark:placeholder:text-[#8C9199] border border-transparent focus:border-[#00639B] dark:focus:border-[#92CCFF] focus:outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[#72777F] hover:text-[#191C20] dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Orden M3Select */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto">
            <M3Select<SortByType>
              variant="pill"
              menuAlign="right"
              value={sortBy}
              onChange={setSortBy}
              leadingIcon={<ArrowUpDown className="w-3.5 h-3.5" />}
              options={[
                { value: 'newest', label: 'Más recientes' },
                { value: 'oldest', label: 'Más antiguos' },
                { value: 'largest', label: 'Mayor tamaño' },
                { value: 'name', label: 'Nombre (A-Z)' },
              ]}
              className="w-full sm:w-auto min-w-[160px]"
            />
          </div>
        </div>

        {/* Chips Deslizables de Asignatura */}
        <div className="flex items-center sm:flex-wrap gap-1.5 overflow-x-auto sm:overflow-visible pb-0.5 pt-0.5 custom-scrollbar select-none">
          <button
            type="button"
            onClick={() => setSelectedSubjectFilter('all')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedSubjectFilter === 'all'
                ? 'bg-[#00639B] text-white shadow-2xs'
                : 'bg-[#E2E7EF]/80 dark:bg-[#272A2F]/80 text-[#41474D] dark:text-[#C2C7CF] hover:bg-[#D0E4FF]/50'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5 shrink-0" />
            <span>Todas</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
              {documents.length}
            </span>
          </button>

          {subjects.map((subj) => {
            const count = subjectDocCounts.get(subj.id) || 0;
            const isSelected = selectedSubjectFilter === subj.id;

            return (
              <button
                key={subj.id}
                type="button"
                onClick={() => setSelectedSubjectFilter(subj.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#00639B] text-white shadow-2xs'
                    : 'bg-[#E2E7EF]/80 dark:bg-[#272A2F]/80 text-[#41474D] dark:text-[#C2C7CF] hover:bg-[#D0E4FF]/50'
                }`}
              >
                <SubjectBadge
                  icon={subj.icon}
                  color={subj.color}
                  size="sm"
                  className="w-4 h-4 rounded-md shadow-2xs ring-1 ring-white/20 shrink-0"
                />
                <span className="max-w-[120px] sm:max-w-none truncate">{subj.name}</span>
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
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar select-none text-[10px] sm:text-[11px] font-bold">
          <span className="text-[#72777F] dark:text-[#8C9199] shrink-0 mr-0.5 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Tipo:
          </span>

          {[
            { id: 'all', label: 'Todos' },
            { id: 'pdf', label: 'PDFs' },
            { id: 'slides', label: 'Diapositivas' },
            { id: 'docs', label: 'Word' },
            { id: 'sheets', label: 'Excel' },
            { id: 'links', label: 'Enlaces' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedFormatFilter(f.id as FormatFilterType)}
              className={`px-2 py-0.5 rounded-full transition-all shrink-0 cursor-pointer ${
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

      {/* 3. Listado de Archivos en Rejilla M3 Descongestionada */}
      {filteredAndSortedDocs.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl sm:rounded-3xl border-2 border-dashed border-[#C2C7CE]/60 dark:border-[#42474E]/60 space-y-2.5 bg-[#F1F4FA]/30 dark:bg-[#1D2024]/30">
          <div className="w-11 h-11 rounded-2xl bg-[#E2E7EF] dark:bg-[#272A2F] text-[#00639B] dark:text-[#92CCFF] flex items-center justify-center mx-auto shadow-2xs">
            <FolderOpen className="w-5 h-5 stroke-[1.8]" />
          </div>
          <h3 className="text-sm font-bold text-[#191C20] dark:text-[#E2E2E6]">
            {documents.length === 0
              ? 'Aún no has vinculado ningún documento'
              : 'No se encontraron archivos con los filtros actuales'}
          </h3>
          <p className="text-xs text-[#72777F] dark:text-[#8C9199] max-w-md mx-auto leading-relaxed">
            {documents.length === 0
              ? 'Vincula diapositivas, documentos Word, guías PDF o enlaces web para organizarlos por materia.'
              : 'Prueba cambiando la asignatura seleccionada o borrando la búsqueda.'}
          </p>
          {documents.length === 0 && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-extrabold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Vincular mi primer archivo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
          {filteredAndSortedDocs.map((doc) => {
            const visuals = getFormatVisuals(doc.fileExtension, doc.isExternalLink);
            const subj = subjectsMap.get(doc.subjectId);
            const isOpening = isOpeningId === doc.id;

            return (
              <div
                key={doc.id}
                onClick={() => !isOpening && handleOpenDoc(doc)}
                className={`p-3 rounded-2xl sm:rounded-3xl bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C2C7CE]/60 dark:border-[#42474E]/60 flex flex-col justify-between gap-2.5 shadow-2xs hover:shadow-xs hover:border-[#00639B]/50 transition-all cursor-pointer group active:scale-[0.99] select-none ${
                  isOpening ? 'opacity-70 ring-2 ring-[#00639B]/40' : ''
                }`}
              >
                {/* Parte Superior: Ícono, Título y Ficha Técnica */}
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ring-1 ring-white/20 select-none"
                    style={{ backgroundColor: visuals.bg }}
                  >
                    {visuals.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-[9px] px-1.5 py-0.2 rounded bg-[#E2E7EF] dark:bg-[#272A2F] text-[#41474D] dark:text-[#C2C7CF]">
                        {visuals.label}
                      </span>
                      {doc.sizeBytes && (
                        <span className="text-[10px] sm:text-[11px] font-semibold text-[#72777F] dark:text-[#8C9199]">
                          {formatFileSize(doc.sizeBytes)}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6] truncate group-hover:text-[#00639B] dark:group-hover:text-[#92CCFF] transition-colors mt-0.5 leading-snug">
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
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#72777F] hover:text-[#00639B] dark:hover:text-[#92CCFF] hover:bg-[#D0E4FF]/40 dark:hover:bg-[#004B76]/30 transition-colors shrink-0"
                    title="Ver detalles técnicos y ruta"
                    aria-label="Información del archivo"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Parte Inferior: Materia asignada y Acciones */}
                <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 dark:border-white/5 text-[11px]">
                  {/* Chip de Materia */}
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    {subj ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <SubjectBadge
                          icon={subj.icon}
                          color={subj.color}
                          size="sm"
                          className="w-4 h-4 rounded-md shadow-2xs ring-1 ring-white/20 shrink-0"
                        />
                        <span className="font-bold text-[#191C20] dark:text-[#E2E2E6] truncate text-[11px]">
                          {subj.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic truncate text-[10px]">Sin asignar</span>
                    )}
                  </div>

                  {/* Botones Abrir, Reasignar y Eliminar */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isOpening}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDoc(doc);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] hover:bg-[#b9d7ff] dark:hover:bg-[#005d92] active:scale-95 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <ArrowUpRight className={`w-3 h-3 ${isOpening ? 'animate-spin' : ''}`} />
                      <span>{isOpening ? 'Abriendo...' : 'Abrir'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocToReassign(doc);
                        setNewReassignedSubjectId(doc.subjectId);
                      }}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-[#00639B] dark:hover:text-[#92CCFF] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      title="Cambiar materia asignada"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDocument(doc.id);
                      }}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/25 transition-colors cursor-pointer"
                      title="Quitar acceso directo"
                      aria-label="Quitar acceso directo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Modal M3 de Información Técnica */}
      {selectedDocForInfo && (
        <Modal
          isOpen={!!selectedDocForInfo}
          onClose={() => setSelectedDocForInfo(null)}
          title="Ficha Técnica del Documento"
          maxWidth="lg"
        >
          <div className="space-y-3 -mt-2">
            {(() => {
              const doc = selectedDocForInfo;
              const visuals = getFormatVisuals(doc.fileExtension, doc.isExternalLink);
              const subj = subjectsMap.get(doc.subjectId);
              const safeFileName = doc.name.replaceAll(/[\\/:*?"<>|]/g, '_');
              const androidInternalPath = `/data/user/0/com.agenda.universitaria/cache/shared_docs/${safeFileName}`;
              const androidContentUri = `content://com.agenda.universitaria.fileprovider/my_cache_images/shared_docs/${safeFileName}`;

              return (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F1F4FA] dark:bg-[#1D2024] border border-[#C2C7CE]/40 dark:border-[#42474E]/40 shadow-2xs">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: visuals.bg }}
                    >
                      {visuals.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[9px] px-1.5 py-0.2 rounded bg-[#E2E7EF] dark:bg-[#272A2F] text-[#41474D] dark:text-[#C2C7CF]">
                          {visuals.label}
                        </span>
                        <span className="text-[11px] font-bold text-[#72777F] dark:text-[#8C9199]">
                          {formatFileSize(doc.sizeBytes)}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-[#191C20] dark:text-[#E2E2E6] truncate mt-0.5">
                        {doc.name}
                      </h4>
                    </div>
                  </div>

                  {/* Cuadrícula de Especificaciones */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Materia Vinculada */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#272A2F] border border-[#C2C7CE]/50 dark:border-[#42474E]/50">
                      <div className="flex items-center gap-1 text-[#72777F] dark:text-[#8C9199] font-medium mb-0.5">
                        <Tag className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF]" />
                        <span>Asignatura</span>
                      </div>
                      {subj ? (
                        <div className="flex items-center gap-2 mt-1">
                          <SubjectBadge
                            icon={subj.icon}
                            color={subj.color}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-[#191C20] dark:text-[#E2E2E6] truncate block text-xs">
                              {subj.name}
                            </span>
                            {subj.code && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded font-mono text-[9px] font-black bg-black text-white dark:bg-white dark:text-black tracking-wider mt-0.5">
                                {subj.code}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Sin asignar</span>
                      )}
                    </div>

                    {/* Fecha de Registro */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#272A2F] border border-[#C2C7CE]/50 dark:border-[#42474E]/50">
                      <div className="flex items-center gap-1 text-[#72777F] dark:text-[#8C9199] font-medium mb-0.5">
                        <Clock className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF]" />
                        <span>Fecha de Registro</span>
                      </div>
                      <div className="font-bold text-[#191C20] dark:text-[#E2E2E6] text-xs">
                        {new Date(doc.createdAt).toLocaleString('es-ES', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>

                    {/* Tipo MIME Oficial */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#272A2F] border border-[#C2C7CE]/50 dark:border-[#42474E]/50 sm:col-span-2">
                      <div className="flex items-center justify-between gap-2 text-[#72777F] dark:text-[#8C9199] font-medium mb-1">
                        <div className="flex items-center gap-1">
                          <Database className="w-3 h-3 text-[#00639B] dark:text-[#92CCFF]" />
                          <span>Tipo MIME Registrado</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(doc.mimeType, 'mime')}
                          className="text-[10px] font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1"
                        >
                          {copiedField === 'mime' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedField === 'mime' ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-[10px] font-bold text-[#191C20] dark:text-[#E2E2E6] truncate bg-slate-100 dark:bg-[#1D2024] p-1.5 rounded-lg">
                        {doc.mimeType}
                      </div>
                    </div>

                    {/* Almacenamiento y Rutas del Sistema */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#272A2F] border border-[#C2C7CE]/50 dark:border-[#42474E]/50 sm:col-span-2 space-y-2">
                      <div className="flex items-center gap-1.5 text-[#72777F] dark:text-[#8C9199] font-bold">
                        <Smartphone className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
                        <span>Almacenamiento Local PWA & Móvil</span>
                      </div>

                      <div className="space-y-1.5">
                        <div>
                          <span className="text-[9px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block">
                            Base de Datos Local PWA:
                          </span>
                          <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">
                            IndexedDB → AgendaDocsCacheDB → objectStore: blobs (Clave: {doc.id})
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block">
                              Ruta Sandboxed Android:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(androidInternalPath, 'path')}
                              className="text-[9px] font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1"
                            >
                              {copiedField === 'path' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedField === 'path' ? 'Copiada' : 'Copiar'}</span>
                            </button>
                          </div>
                          <div className="font-mono text-[10px] text-[#191C20] dark:text-[#E2E2E6] bg-slate-100 dark:bg-[#1D2024] p-1.5 rounded-lg break-all select-all">
                            {androidInternalPath}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-[#72777F] dark:text-[#8C9199] uppercase tracking-wider block">
                              URI FileProvider:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(androidContentUri, 'uri')}
                              className="text-[9px] font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1"
                            >
                              {copiedField === 'uri' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedField === 'uri' ? 'Copiado' : 'Copiar'}</span>
                            </button>
                          </div>
                          <div className="font-mono text-[9px] text-[#00639B] dark:text-[#92CCFF] bg-[#D0E4FF]/30 dark:bg-[#004B76]/20 p-1.5 rounded-lg break-all select-all">
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
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#41474D] dark:text-[#C2C7CF] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                      Cerrar
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDocForInfo(null);
                        handleOpenDoc(doc);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] shadow-2xs active:scale-95 transition-all"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Abrir Documento</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* 5. Modal M3 para Vincular Nuevo Archivo o Enlace */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Vincular Documento"
          maxWidth="md"
        >
          <div className="space-y-3 -mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,image/*"
              onChange={handleSelectLocalFile}
              className="hidden"
            />

            {/* Selector de Asignatura Obligatorio M3 */}
            <div>
              <label className="block text-xs font-bold text-[#41474D] dark:text-[#C2C7CF] mb-1">
                Asignatura Destino:
              </label>
              <M3Select
                value={targetSubjectId}
                onChange={setTargetSubjectId}
                options={subjectSelectOptions}
                placeholder="Elige la materia..."
              />
            </div>

            {/* Selector de Tipo (Archivo vs Enlace) */}
            <div className="flex p-0.5 rounded-xl bg-[#E2E7EF] dark:bg-[#272A2F]">
              <button
                type="button"
                onClick={() => setAddMode('file')}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                  addMode === 'file'
                    ? 'bg-[#00639B] text-white shadow-2xs'
                    : 'text-[#41474D] dark:text-[#C2C7CF] hover:bg-black/5'
                }`}
              >
                Archivo en Dispositivo
              </button>
              <button
                type="button"
                onClick={() => setAddMode('link')}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                  addMode === 'link'
                    ? 'bg-[#00639B] text-white shadow-2xs'
                    : 'text-[#41474D] dark:text-[#C2C7CF] hover:bg-black/5'
                }`}
              >
                Enlace Web / Drive
              </button>
            </div>

            {/* Contenido según el modo */}
            {addMode === 'file' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl border-2 border-dashed border-[#00639B]/40 dark:border-[#92CCFF]/40 text-center space-y-1.5 hover:bg-[#D0E4FF]/10 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] flex items-center justify-center mx-auto shadow-2xs">
                  <HardDrive className="w-5 h-5" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-[#191C20] dark:text-[#E2E2E6]">
                  Toca aquí para seleccionar un archivo
                </h4>
                <p className="text-[11px] text-[#72777F] dark:text-[#8C9199] max-w-xs mx-auto">
                  Soporta PPTX, DOCX, PDF, XLSX y archivos de texto.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveExternalLink} className="space-y-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#41474D] dark:text-[#C2C7CF] mb-1">
                    Nombre Descriptivo:
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Diapositivas en Google Drive"
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/60 dark:border-[#42474E]/60 text-xs text-[#191C20] dark:text-[#E2E2E6] focus:outline-none focus:ring-2 focus:ring-[#00639B]"
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
                    className="w-full px-3 py-2 rounded-xl bg-[#E2E7EF]/60 dark:bg-[#272A2F]/60 border border-[#C2C7CE]/60 dark:border-[#42474E]/60 text-xs text-[#191C20] dark:text-[#E2E2E6] focus:outline-none focus:ring-2 focus:ring-[#00639B]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#41474D] dark:text-[#C2C7CF]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] shadow-2xs"
                  >
                    Guardar Enlace
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* 6. Modal M3 para Reasignar Materia */}
      {docToReassign && (
        <Modal
          isOpen={!!docToReassign}
          onClose={() => setDocToReassign(null)}
          title="Reasignar Asignatura"
          maxWidth="sm"
        >
          <div className="space-y-3 -mt-2">
            <p className="text-xs text-[#72777F] dark:text-[#8C9199]">
              Cambia la materia asignada a <strong className="text-[#191C20] dark:text-[#E2E2E6]">{docToReassign.name}</strong>:
            </p>

            <M3Select
              value={newReassignedSubjectId}
              onChange={setNewReassignedSubjectId}
              options={subjectSelectOptions}
              placeholder="Seleccionar nueva materia..."
            />

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setDocToReassign(null)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#41474D] dark:text-[#C2C7CF]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReassign}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] shadow-2xs"
              >
                Actualizar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Notificación Contextual */}
      <ContextualToast
        message={docToast || actionError}
        bottomOffset="nav"
        onClose={() => {
          setDocToast(null);
          setActionError(null);
        }}
      />

      {/* Botón Flotante Compacto */}
      {isActive && (
        <DraggableFAB
          colorScheme="documents"
          onClick={handleOpenAddModal}
          label="Vincular Documento"
          icon={<FolderPlus className="w-6 h-6 stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
