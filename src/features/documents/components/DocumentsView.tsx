import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  X,
  FileText,
  Table,
  Presentation,
  File,
  Link as LinkIcon,
  Trash2,
  ArrowUpRight,
  FolderOpen,
  Plus,
  Info,
  Filter,
  ArrowUpDown,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';
import { useSubjectDocuments, type SubjectDocumentItem } from '../../subjects/hooks/useSubjectDocuments';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { M3Select } from '../../../shared/components/M3Select';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { useScrollCollapse } from '../../../shared/hooks/useScrollCollapse';
import { DocumentLinkForm } from './DocumentLinkForm';
import { DocumentDetailView } from './DocumentDetailView';
import { DocumentReassignView } from './DocumentReassignView';

interface DocumentsViewProps {
  isActive?: boolean;
}

type FormatFilterType = 'all' | 'pdf' | 'slides' | 'docs' | 'sheets' | 'links' | 'other';
type SortByType = 'newest' | 'oldest' | 'largest' | 'name';
type DocumentsViewMode = 'list' | 'add' | 'details' | 'reassign';

export const DocumentsView: React.FC<DocumentsViewProps> = ({ isActive = true }) => {
  const { documents, addLocalDocument, addExternalLink, openDocument, deleteDocument, reassignSubject } =
    useSubjectDocuments();
  const { subjects } = useSubjects();
  const isScrolled = useScrollCollapse(48);

  // Modo de navegación: apartado principal de lista o apartados dedicados independientes a pantalla completa
  const [viewMode, setViewMode] = useState<DocumentsViewMode>('list');
  const [selectedDoc, setSelectedDoc] = useState<SubjectDocumentItem | null>(null);

  // Estados de Búsqueda, Filtros y Ordenamiento
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<FormatFilterType>('all');
  const [sortBy, setSortBy] = useState<SortByType>('newest');

  // Estados interactivos
  const [isOpeningId, setIsOpeningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [docToast, setDocToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpiar temporizadores para evitar fugas de memoria
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showDocToast = (msg: string) => {
    setDocToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setDocToast(null), 3000);
  };

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

  const handleOpenAdd = () => {
    if (subjects.length === 0) {
      setActionError('Debes registrar al menos una asignatura antes de vincular archivos.');
      return;
    }
    setViewMode('add');
  };

  // 1. APARTADO INDEPENDIENTE A PANTALLA COMPLETA: VINCULAR DOCUMENTO
  if (viewMode === 'add') {
    return (
      <DocumentLinkForm
        subjects={subjects}
        initialSubjectId={selectedSubjectFilter !== 'all' ? selectedSubjectFilter : undefined}
        onSubmitLocalFile={async (subjectId, file) => {
          await addLocalDocument(subjectId, file);
          setViewMode('list');
          showDocToast('Archivo vinculado correctamente');
        }}
        onSubmitExternalLink={async (subjectId, name, url) => {
          await addExternalLink(subjectId, name, url);
          setViewMode('list');
          showDocToast('Enlace guardado correctamente');
        }}
        onCancel={() => setViewMode('list')}
      />
    );
  }

  // 2. APARTADO INDEPENDIENTE A PANTALLA COMPLETA: FICHA TÉCNICA
  if (viewMode === 'details' && selectedDoc) {
    const docSubject = subjectsMap.get(selectedDoc.subjectId);
    return (
      <DocumentDetailView
        document={selectedDoc}
        subject={docSubject}
        onBack={() => {
          setViewMode('list');
          setSelectedDoc(null);
        }}
        onOpen={async (doc) => {
          await handleOpenDoc(doc);
        }}
        onRequestReassign={(doc) => {
          setSelectedDoc(doc);
          setViewMode('reassign');
        }}
        onDelete={(doc) => {
          deleteDocument(doc.id);
          setViewMode('list');
          setSelectedDoc(null);
          showDocToast('Documento eliminado');
        }}
        onShowToast={showDocToast}
      />
    );
  }

  // 3. APARTADO INDEPENDIENTE A PANTALLA COMPLETA: REASIGNAR MATERIA
  if (viewMode === 'reassign' && selectedDoc) {
    const docSubject = subjectsMap.get(selectedDoc.subjectId);
    return (
      <DocumentReassignView
        document={selectedDoc}
        currentSubject={docSubject}
        subjects={subjects}
        onConfirmReassign={async (docId, newSubjectId) => {
          await reassignSubject(docId, newSubjectId);
          setViewMode('list');
          setSelectedDoc(null);
          showDocToast('Asignatura actualizada correctamente');
        }}
        onCancel={() => {
          setViewMode('list');
          setSelectedDoc(null);
        }}
      />
    );
  }

  // 4. APARTADO PRINCIPAL: CATÁLOGO Y LISTADO GENERAL
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
          onClick={handleOpenAdd}
          className={`hidden sm:inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[#00639B] dark:bg-[#92CCFF] text-white dark:text-[#003353] hover:bg-[#005282] dark:hover:bg-[#72BAF5] active:scale-95 transition-all duration-300 ease-out origin-right shadow-sm hover:shadow ring-1 ring-[#00639B]/25 dark:ring-[#92CCFF]/35 cursor-pointer shrink-0 whitespace-nowrap ${
            isScrolled ? 'scale-75 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
          }`}
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Vincular Documento</span>
        </button>
      </div>

      {/* 2. Barra de Búsqueda, Ordenamiento y Filtros Descongestionada */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Campo de Búsqueda */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#72777F] dark:text-[#8C9199]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o código de materia..."
              className="w-full pl-9 pr-9 h-10 sm:h-11 rounded-full bg-[#E2E7EF]/70 dark:bg-[#272A2F]/70 border border-[#C2C7CE]/60 dark:border-[#42474E]/60 text-xs sm:text-sm text-[#191C20] dark:text-[#E2E2E6] placeholder-[#72777F] dark:placeholder-[#8C9199] focus:outline-none focus:ring-2 focus:ring-[#00639B]/40 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#C2C7CE]/50 dark:bg-[#42474E]/50 flex items-center justify-center text-[#191C20] dark:text-[#E2E2E6] hover:bg-[#C2C7CE] transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Selector de Ordenamiento M3 */}
          <M3Select<SortByType>
            value={sortBy}
            onChange={setSortBy}
            variant="pill"
            leadingIcon={<ArrowUpDown className="w-3.5 h-3.5" />}
            menuAlign="right"
            options={[
              { value: 'newest', label: 'Más recientes' },
              { value: 'oldest', label: 'Más antiguos' },
              { value: 'largest', label: 'Mayor tamaño' },
              { value: 'name', label: 'Nombre A-Z' },
            ]}
          />
        </div>

        {/* Chips Horizontales de Asignaturas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar select-none">
          <button
            type="button"
            onClick={() => setSelectedSubjectFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedSubjectFilter === 'all'
                ? 'bg-[#00639B] text-white shadow-2xs'
                : 'bg-[#E2E7EF]/80 dark:bg-[#272A2F]/80 text-[#41474D] dark:text-[#C2C7CF] hover:bg-[#D0E4FF]/50'
            }`}
          >
            Todas ({documents.length})
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

      {/* 3. Listado de Archivos en Rejilla M3 */}
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
              onClick={handleOpenAdd}
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

                  {/* Botón de Información Técnica (Abre Ficha Técnica a pantalla completa) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDoc(doc);
                      setViewMode('details');
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
                          className="w-4 h-4 rounded-md shadow-2xs ring-1 ring-white/10 shrink-0"
                        />
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate text-[11px]">
                          {subj.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                        Sin asignatura
                      </span>
                    )}
                  </div>

                  {/* Acciones */}
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
                        setSelectedDoc(doc);
                        setViewMode('reassign');
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
                        showDocToast('Documento eliminado');
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

      {/* Notificación Contextual */}
      <ContextualToast
        message={docToast || actionError}
        bottomOffset="nav"
        onClose={() => {
          setDocToast(null);
          setActionError(null);
        }}
      />

      {/* Botón Flotante Compacto (visible solo en modo lista) */}
      {isActive && viewMode === 'list' && (
        <DraggableFAB
          colorScheme="documents"
          onClick={handleOpenAdd}
          label="Vincular Documento"
          icon={<FolderPlus className="w-6 h-6 stroke-[2.2]" />}
        />
      )}
    </div>
  );
};
