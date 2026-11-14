import React, { useMemo, useState } from 'react';
import { BookOpen, Download, ImageIcon, Plus, Tag, X } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
import { formInputClass } from '../../../shared/components/form';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SUBJECT_PRESET_COLORS } from '../../subjects/components/SubjectIcon';
import { parseNotePreview } from '../utils/notePreview';
import {
  findMatchingSubject,
  importAgnotePackage,
  type NoteSharePackage,
} from '../services/noteShareService';

const NEW_SUBJECT = '__new__';
const DEFAULT_NEW_SUBJECT_NAME = 'Apuntes compartidos';

interface ImportNoteModalProps {
  /** Paquete ya validado y sanitizado por parseAgnoteContent. */
  sharePackage: NoteSharePackage;
  onClose: () => void;
  onImported: (result: { title: string; subjectName: string }) => void;
}

/**
 * Vista previa de un apunte compartido (.agnote) y elección de la materia donde guardarlo.
 * Empareja sola la materia de origen si el estudiante ya la tiene (por código o nombre); si no,
 * propone crearla con el mismo nombre y color. No se renderiza el HTML recibido: solo el extracto
 * en texto plano y la portada (data: o blob:), así la vista previa no ejecuta nada del archivo.
 */
export const ImportNoteModal: React.FC<ImportNoteModalProps> = ({ sharePackage, onClose, onImported }) => {
  const { subjects } = useSubjects();
  const origin = sharePackage.subject;
  const preview = useMemo(() => parseNotePreview(sharePackage.note.content), [sharePackage]);
  const inlinePhotos = (sharePackage.note.content.match(/<img\b/gi) ?? []).length;
  const photoCount = inlinePhotos + sharePackage.attachments.length;

  // La elección por defecto se deriva en cada render: las materias llegan de IndexedDB después
  // del primer render y el emparejamiento debe aplicarse cuando aparezcan
  const matching = findMatchingSubject(subjects, origin);
  const defaultChoice = matching?.id ?? (origin || subjects.length === 0 ? NEW_SUBJECT : subjects[0].id);
  const [choice, setChoice] = useState<string | null>(null);
  const selected = choice ?? defaultChoice;

  const [newSubjectName, setNewSubjectName] = useState(origin?.name ?? DEFAULT_NEW_SUBJECT_NAME);
  const [tags, setTags] = useState<string[]>(sharePackage.note.tags);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newSubjectColor = origin?.color ?? SUBJECT_PRESET_COLORS[0];
  const subjectOptions: M3SelectOption[] = [
    ...subjects.map((s) => ({
      value: s.id,
      label: s.name,
      sublabel: s.code,
      color: s.color,
    })),
    {
      value: NEW_SUBJECT,
      label: `Crear materia «${newSubjectName.trim() || DEFAULT_NEW_SUBJECT_NAME}»`,
      color: newSubjectColor,
      icon: <Plus className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  const sharedOn = new Date(sharePackage.exportedAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handleSave = async () => {
    const isNew = selected === NEW_SUBJECT;
    const name = newSubjectName.trim() || DEFAULT_NEW_SUBJECT_NAME;
    setIsSaving(true);
    setError(null);
    try {
      await importAgnotePackage(
        sharePackage,
        isNew
          ? { kind: 'create', name, code: origin?.code, color: newSubjectColor }
          : { kind: 'existing', subjectId: selected },
        tags
      );
      onImported({
        title: sharePackage.note.title,
        subjectName: isNew ? name : (subjects.find((s) => s.id === selected)?.name ?? 'tu materia'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el apunte.');
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Apunte compartido" maxWidth="md">
      <div className="space-y-4">
        {/* Vista previa */}
        <section className="flex gap-3 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-3">
          {preview.coverImageUrl ? (
            <img
              src={preview.coverImageUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
              draggable={false}
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
              <BookOpen className="h-7 w-7" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-black text-[var(--color-md-on-surface)]">{sharePackage.note.title}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--color-md-on-surface-variant)]">
              {origin && (
                <span className="inline-flex items-center gap-1 font-semibold">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: origin.color ?? 'var(--color-md-primary)' }}
                    aria-hidden="true"
                  />
                  {origin.name}
                </span>
              )}
              <span>Compartido el {sharedOn}</span>
            </p>
            {photoCount > 0 && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">
                <ImageIcon className="h-3 w-3" aria-hidden="true" />
                {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}
              </p>
            )}
          </div>
        </section>

        <p
          className={`line-clamp-4 text-xs leading-relaxed ${
            preview.hasText ? 'text-[var(--color-md-on-surface)]' : 'italic text-[var(--color-md-on-surface-variant)]'
          }`}
        >
          {preview.cleanText}
        </p>

        {/* Materia de destino */}
        <section className="space-y-2">
          <M3Select
            label="Guardar en la materia"
            value={selected}
            onChange={(value) => setChoice(value)}
            options={subjectOptions}
          />
          {selected === NEW_SUBJECT && (
            <div className="space-y-1">
              <label htmlFor="import-new-subject" className="text-xs font-semibold text-[var(--color-md-on-surface)]">
                Nombre de la nueva materia
              </label>
              <input
                id="import-new-subject"
                type="text"
                maxLength={100}
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                className={formInputClass}
              />
            </div>
          )}
          {matching && selected === matching.id && (
            <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">
              Coincide con la materia de origen del apunte.
            </p>
          )}
          {!matching && origin && selected !== NEW_SUBJECT && (
            <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">
              No tienes «{origin.name}»: el apunte se guardará en la materia que elegiste.
            </p>
          )}
        </section>

        {/* Etiquetas sugeridas (se pueden quitar) */}
        {tags.length > 0 && (
          <section className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-md-on-surface)]">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              Etiquetas sugeridas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-md-secondary-container)] py-0.5 pl-2 pr-1 text-xs font-semibold text-[var(--color-md-on-surface)]"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                    aria-label={`Quitar etiqueta ${tag}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--color-md-surface-container-high)]"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        <ModalActions>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="h-4 w-4" aria-hidden="true" />}
            isLoading={isSaving}
            onClick={() => void handleSave()}
          >
            Guardar en mis apuntes
          </Button>
        </ModalActions>
      </div>
    </Modal>
  );
};
