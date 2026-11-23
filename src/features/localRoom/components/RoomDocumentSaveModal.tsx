import React, { useMemo, useState } from 'react';
import { CopyPlus, FileText, LoaderCircle, Save, TriangleAlert } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { documentPayloadBytes, findDuplicateDocument, formatRoomBytes, saveRoomDocument, suggestDocumentSubject } from '../services/roomItems';
import type { RoomItemPayload } from '../types/room';
import { ROOM_FILLED_BUTTON, ROOM_INPUT, ROOM_TONAL_BUTTON } from './roomStyles';

interface RoomDocumentSaveModalProps {
  payload: RoomItemPayload;
  onClose: () => void;
  /** alreadyHad: el estudiante ya tenía el mismo archivo y decidió no duplicarlo. */
  onSaved: (result: { subjectName: string; alreadyHad: boolean }) => void;
}

/**
 * Guardar un archivo recibido en la Biblioteca: propone la materia de origen si existe con el
 * mismo nombre y avisa si ese archivo (mismo nombre y tamaño) ya está en la materia elegida.
 */
export const RoomDocumentSaveModal: React.FC<RoomDocumentSaveModalProps> = ({ payload, onClose, onSaved }) => {
  const { subjects } = useSubjects();
  const current = useMemo(() => subjects.filter((s) => !s.isArchived), [subjects]);
  const [subjectId, setSubjectId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedId = subjectId || suggestDocumentSubject(current, payload.subjectName)?.id || current[0]?.id || '';
  const selected = current.find((s) => s.id === selectedId);
  const sizeBytes = documentPayloadBytes(payload);
  const fileName = payload.fileName || payload.title;
  const duplicate = selectedId ? findDuplicateDocument(selectedId, fileName, sizeBytes) : undefined;

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveRoomDocument(payload, selected.id);
      onSaved({ subjectName: selected.name, alreadyHad: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el archivo.');
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Guardar archivo" maxWidth="md">
      <div className="flex items-start gap-3 rounded-2xl bg-[var(--color-md-surface-container-high)] p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block break-words text-sm font-bold text-[var(--color-md-on-surface)]">{fileName}</span>
          <span className="block text-xs text-[var(--color-md-on-surface-variant)]">
            {formatRoomBytes(sizeBytes)}
            {payload.subjectName ? ` · de ${payload.subjectName}` : ''}
          </span>
        </span>
      </div>

      {current.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-md-on-surface-variant)]">Los archivos de la Biblioteca se guardan dentro de una materia. Crea una materia primero y vuelve a intentarlo.</p>
      ) : (
        <>
          <label htmlFor="room-doc-subject" className="mt-4 block text-xs font-bold text-[var(--color-md-on-surface-variant)]">
            Guardar en la materia
          </label>
          <select id="room-doc-subject" value={selectedId} onChange={(e) => setSubjectId(e.target.value)} className={`${ROOM_INPUT} mt-1`}>
            {current.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {duplicate && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-500/12 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100" role="status">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Ya tienes este archivo en {selected?.name}. Puedes dejarlo así o guardar una copia.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-red-700 dark:text-red-200">
              {error}
            </p>
          )}
        </>
      )}

      <ModalActions layout="stack">
        {duplicate ? (
          <>
            <button type="button" className={ROOM_TONAL_BUTTON} disabled={saving} onClick={() => void save()}>
              <CopyPlus aria-hidden="true" />
              Guardar como copia
            </button>
            <button type="button" className={ROOM_FILLED_BUTTON} onClick={() => selected && onSaved({ subjectName: selected.name, alreadyHad: true })}>
              Ya lo tengo
            </button>
          </>
        ) : (
          <>
            <button type="button" className={ROOM_TONAL_BUTTON} onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className={ROOM_FILLED_BUTTON} disabled={!selected || saving} onClick={() => void save()}>
              {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Guardar
            </button>
          </>
        )}
      </ModalActions>
    </Modal>
  );
};
