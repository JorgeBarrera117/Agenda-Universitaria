import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Database,
  File,
  FileText,
  FolderSync,
  HardDrive,
  Info,
  Link as LinkIcon,
  Presentation,
  Share2,
  Table,
  Tag,
  Trash2,
} from 'lucide-react';
import type { SubjectDocumentItem } from '../../subjects/hooks/useSubjectDocuments';
import type { Subject } from '../../subjects/types';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import {
  DetailAction,
  DetailActions,
  DetailChip,
  DetailHero,
  DetailIconTile,
  DetailRow,
  DetailRows,
  DetailScreen,
  DetailSection,
} from '../../../shared/components/detail/DetailKit';

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

const ROW_ICON = 'h-[18px] w-[18px]';

/** Color (el de cada formato, para reconocerlo de un vistazo), ícono y nombre del tipo. */
function formatVisuals(ext: string, isLink?: boolean): { color: string; icon: React.ReactNode; label: string } {
  const icon = (Glyph: typeof File) => <Glyph className="h-7 w-7 stroke-[2.2]" />;
  if (isLink) return { color: '#00639B', icon: icon(LinkIcon), label: 'Enlace web' };
  const clean = ext.toLowerCase();
  switch (clean) {
    case 'pdf':
      return { color: '#D9381E', icon: icon(FileText), label: 'Documento PDF' };
    case 'ppt':
    case 'pptx':
      return { color: '#D04423', icon: icon(Presentation), label: 'Presentación' };
    case 'doc':
    case 'docx':
      return { color: '#185ABD', icon: icon(FileText), label: 'Documento de Word' };
    case 'xls':
    case 'xlsx':
      return { color: '#107C41', icon: icon(Table), label: 'Hoja de cálculo' };
    default:
      return { color: '#5E6B7A', icon: icon(File), label: clean ? `Archivo ${clean.toUpperCase()}` : 'Documento' };
  }
}

function formatFileSize(bytes?: number): string | null {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Ficha de un archivo o enlace (mismo patrón que las demás fichas): lo principal es abrirlo, así que
 * «Abrir» es la acción destacada; compartir va al lado y cambiar de materia o eliminar en ⋮. Los
 * datos técnicos (MIME, rutas) quedan plegados al final porque casi nunca hacen falta.
 */
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    []
  );

  const copy = (text: string, fieldKey: string) => {
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopiedField(fieldKey);
        onShowToast('Copiado al portapapeles');
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
      },
      () => onShowToast('No se pudo copiar')
    );
  };

  const run = async (action: (d: SubjectDocumentItem) => Promise<void>, setBusy: (v: boolean) => void) => {
    setBusy(true);
    try {
      await action(doc);
    } finally {
      setBusy(false);
    }
  };

  const visuals = formatVisuals(doc.fileExtension, doc.isExternalLink);
  const size = formatFileSize(doc.sizeBytes);
  const isLink = Boolean(doc.isExternalLink);
  const androidInternalPath = `/data/user/0/com.agenda.universitaria/files/documents/${doc.id}.${doc.fileExtension || 'bin'}`;
  const androidContentUri = `content://com.agenda.universitaria.fileprovider/external_files/${doc.name}`;

  const copyButton = (text: string, key: string, label: string) => (
    <button
      type="button"
      onClick={() => copy(text, key)}
      aria-label={`Copiar ${label}`}
      title="Copiar"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10"
    >
      {copiedField === key ? <Check className="h-4 w-4 stroke-[2.6]" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
    </button>
  );

  return (
    <DetailScreen
      title={isLink ? 'Enlace' : 'Archivo'}
      subtitle={subject?.name ?? 'Archivos'}
      onBack={onBack}
      backLabel="Volver a Archivos"
      actions={
        <M3KebabMenu
          ariaLabel="Más opciones"
          items={[
            {
              id: 'reassign',
              label: 'Cambiar de materia',
              icon: <FolderSync className="h-3.5 w-3.5 text-[var(--color-md-primary)]" />,
              onClick: () => onRequestReassign(doc),
            },
            {
              id: 'delete',
              label: 'Eliminar',
              icon: <Trash2 className="h-3.5 w-3.5" />,
              variant: 'destructive' as const,
              onClick: () => setConfirmDelete(true),
            },
          ]}
        />
      }
    >
      <DetailHero
        color={subject?.color}
        titleId="document-detail-title"
        leading={<DetailIconTile color={visuals.color}>{visuals.icon}</DetailIconTile>}
        kicker={visuals.label}
        title={doc.name}
        chips={
          <>
            {doc.fileExtension && !isLink && <DetailChip tone="mono">{doc.fileExtension.toUpperCase()}</DetailChip>}
            {size && <DetailChip icon={<HardDrive className="h-3 w-3 shrink-0" aria-hidden="true" />}>{size}</DetailChip>}
          </>
        }
        actions={
          <DetailActions>
            <DetailAction
              variant="primary"
              icon={<ArrowUpRight className="h-4 w-4 stroke-[2.4]" aria-hidden="true" />}
              label={isOpening ? 'Abriendo…' : isLink ? 'Abrir enlace' : 'Abrir'}
              busy={isOpening}
              onClick={() => void run(onOpen, setIsOpening)}
            />
            <DetailAction
              icon={<Share2 className="h-4 w-4" aria-hidden="true" />}
              label="Compartir"
              busy={isSharing}
              onClick={() => void run(onShare, setIsSharing)}
            />
          </DetailActions>
        }
      />

      <DetailSection icon={<Info className="h-4 w-4" />} title="Detalles">
        <DetailRows>
          <DetailRow
            icon={<Tag className={ROW_ICON} />}
            leading={subject ? <SubjectBadge icon={subject.icon} color={subject.color} size="lg" /> : undefined}
            label="Materia"
            value={
              subject ? (
                <>
                  <span className="font-bold">{subject.name}</span>
                  {subject.code && <span className="whitespace-nowrap text-[var(--color-md-on-surface-variant)]"> · {subject.code}</span>}
                </>
              ) : (
                'Sin materia'
              )
            }
            trailing={
              <button
                type="button"
                onClick={() => onRequestReassign(doc)}
                className="h-9 shrink-0 rounded-full px-3 text-xs font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10"
              >
                Cambiar
              </button>
            }
          />
          <DetailRow
            icon={<CalendarDays className={ROW_ICON} />}
            label="Agregado"
            value={new Date(doc.createdAt).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
          />
          {isLink && doc.externalUrl && (
            <DetailRow
              icon={<LinkIcon className={ROW_ICON} />}
              label="Dirección"
              value={<span className="break-all">{doc.externalUrl}</span>}
              trailing={copyButton(doc.externalUrl, 'url', 'la dirección')}
            />
          )}
        </DetailRows>
      </DetailSection>

      {/* Datos técnicos plegados: útiles a veces, ruido casi siempre */}
      {!isLink && (
        <details className="group md-card rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] shadow-xs">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-3xl px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
              <Database className="h-4 w-4 text-[var(--color-md-primary)]" aria-hidden="true" />
              Información técnica
            </span>
            <ChevronDown
              className="h-4 w-4 text-[var(--color-md-on-surface-variant)] transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="px-4 pb-3 sm:px-5">
            <DetailRows>
              <DetailRow
                icon={<FileText className={ROW_ICON} />}
                label="Tipo MIME"
                value={<span className="font-mono text-xs">{doc.mimeType}</span>}
                trailing={copyButton(doc.mimeType, 'mime', 'el tipo MIME')}
              />
              <DetailRow
                icon={<Database className={ROW_ICON} />}
                label="Guardado en este dispositivo"
                value={<span className="font-mono text-xs">IndexedDB · AgendaDocsCacheDB · blobs · {doc.id}</span>}
              />
              <DetailRow
                icon={<HardDrive className={ROW_ICON} />}
                label="Ruta en Android"
                value={<span className="break-all font-mono text-xs">{androidInternalPath}</span>}
                trailing={copyButton(androidInternalPath, 'path', 'la ruta')}
              />
              <DetailRow
                icon={<LinkIcon className={ROW_ICON} />}
                label="URI de FileProvider"
                value={<span className="break-all font-mono text-xs">{androidContentUri}</span>}
                trailing={copyButton(androidContentUri, 'uri', 'la URI')}
              />
            </DetailRows>
          </div>
        </details>
      )}

      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title={isLink ? '¿Eliminar el enlace?' : '¿Eliminar el archivo?'} maxWidth="sm">
        <p className="text-sm text-[var(--color-md-on-surface-variant)]">Se eliminará «{doc.name}» de la app. No se puede deshacer.</p>
        <ModalActions>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="h-10 rounded-full px-4 text-sm font-bold text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              onDelete(doc);
            }}
            className="h-10 rounded-full bg-[#BA1A1A] px-5 text-sm font-bold text-white hover:bg-[#93000A] dark:bg-[#FFB4AB] dark:text-[#690005]"
          >
            Eliminar
          </button>
        </ModalActions>
      </Modal>
    </DetailScreen>
  );
};
