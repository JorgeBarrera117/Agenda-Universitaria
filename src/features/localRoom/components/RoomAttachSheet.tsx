import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Search, SendHorizontal } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { useNotes } from '../../notes/hooks/useNotes';
import { useSubjectDocuments } from '../../subjects/hooks/useSubjectDocuments';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { shareItem } from '../services/roomStore';
import {
  ROOM_ITEM_LABEL,
  assertRoomItemSize,
  buildContactRoomItem,
  buildDocumentRoomItem,
  buildNoteRoomItem,
  buildScheduleRoomItem,
  buildSubjectRoomItem,
  formatRoomBytes,
} from '../services/roomItems';
import { ROOM_ITEM_KINDS, ROOM_ITEM_MAX_BYTES, ROOM_TEXT_MAX, type RoomItemDraft, type RoomItemKind } from '../types/room';
import { ROOM_FILLED_BUTTON, ROOM_INPUT, ROOM_ITEM_ICON, ROOM_TEXT_BUTTON } from './roomStyles';

interface RoomAttachSheetProps {
  /** Si el anfitrión desactivó el texto, el mensaje opcional no se ofrece. */
  textAllowed: boolean;
  /** Chat privado: destinatario (sin él, va al hilo de la sala). */
  to?: string;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

const KIND_DESCRIPTION: Record<RoomItemKind, string> = {
  schedule: 'Todas tus materias con sus clases y docentes',
  subject: 'Una materia con sus clases y su docente',
  contact: 'Correo, teléfono y oficina de un docente',
  note: 'Un apunte con sus fotos y audios',
  document: 'Un archivo de la Biblioteca (hasta 300 MB)',
};

interface PickOption {
  id: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  build: () => Promise<RoomItemDraft>;
}

/** Selector de adjuntos: los cinco tipos académicos y, después, el elemento concreto. */
export const RoomAttachSheet: React.FC<RoomAttachSheetProps> = ({ textAllowed, to, onClose, onShowToast }) => {
  const [kind, setKind] = useState<RoomItemKind | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<PickOption | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const { subjects } = useSubjects();
  const { slots } = useSchedule();
  const { professors } = useProfessors();
  const { notes } = useNotes();
  const { documents } = useSubjectDocuments();
  const { settings } = useAppSettings();

  const subjectName = useMemo(() => {
    const map = new Map(subjects.map((s) => [s.id, s.name]));
    return (id: string) => map.get(id);
  }, [subjects]);

  const options: PickOption[] = useMemo(() => {
    switch (kind) {
      case 'subject':
        return subjects
          .filter((s) => !s.isArchived)
          .map((s) => ({ id: s.id, title: s.name, subtitle: s.code, build: () => buildSubjectRoomItem(s, slots, professors) }));
      case 'contact':
        return professors.map((p) => ({ id: p.id, title: p.name, subtitle: p.email, build: () => buildContactRoomItem(p, subjects) }));
      case 'note':
        return [...notes]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((n) => {
            const subject = subjects.find((s) => s.id === n.subjectId);
            return { id: n.id, title: n.title.trim() || 'Apunte sin título', subtitle: subject?.name ?? 'Personal', build: () => buildNoteRoomItem(n, subject) };
          });
      case 'document':
        return documents
          .filter((d) => !d.isExternalLink)
          .map((d) => {
            const tooBig = (d.sizeBytes ?? 0) > ROOM_ITEM_MAX_BYTES;
            return {
              id: d.id,
              title: d.name,
              subtitle: [subjectName(d.subjectId), d.sizeBytes ? formatRoomBytes(d.sizeBytes) : undefined, tooBig ? 'más de 300 MB' : undefined].filter(Boolean).join(' · '),
              disabled: tooBig,
              build: () => buildDocumentRoomItem(d, subjectName(d.subjectId)),
            };
          });
      default:
        return [];
    }
  }, [kind, subjects, slots, professors, notes, documents, subjectName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.title.toLowerCase().includes(q) || o.subtitle?.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const pickKind = (next: RoomItemKind) => {
    if (next === 'schedule') {
      setChosen({
        id: 'schedule',
        title: settings.semesterName.trim() ? `Horario · ${settings.semesterName.trim()}` : 'Horario completo',
        subtitle: KIND_DESCRIPTION.schedule,
        build: () => buildScheduleRoomItem(settings.semesterName, subjects, slots, professors),
      });
    }
    setKind(next);
    setQuery('');
  };

  const back = () => {
    if (chosen && kind !== 'schedule') setChosen(null);
    else {
      setChosen(null);
      setKind(null);
    }
  };

  const share = async () => {
    if (!chosen || sending) return;
    setSending(true);
    try {
      const item = await chosen.build();
      assertRoomItemSize(item);
      // La subida sigue en segundo plano: su tarjeta en el hilo muestra el progreso
      shareItem(item, { text: textAllowed ? text.trim() || undefined : undefined, to });
      onClose();
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'No se pudo compartir.');
    } finally {
      setSending(false);
    }
  };

  const shareLabel = to ? 'Enviar en privado' : 'Compartir en la sala';
  const title = chosen ? shareLabel : kind ? ROOM_ITEM_LABEL[kind] : 'Adjuntar';

  return (
    <Modal isOpen onClose={onClose} title={title} maxWidth="md">
      {kind && (
        <button type="button" className={`${ROOM_TEXT_BUTTON} -ml-3 -mt-2 mb-2`} onClick={back}>
          <ChevronLeft aria-hidden="true" />
          Volver
        </button>
      )}

      {!kind && (
        <ul className="-mx-2 space-y-1">
          {ROOM_ITEM_KINDS.map((k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => pickKind(k)}
                className="flex min-h-16 w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-md-surface-container-high)] active:scale-[0.99]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] [&>svg]:h-5 [&>svg]:w-5">
                  {ROOM_ITEM_ICON[k]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">{ROOM_ITEM_LABEL[k]}</span>
                  <span className="block text-xs text-[var(--color-md-on-surface-variant)]">{KIND_DESCRIPTION[k]}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {kind && !chosen && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" aria-label="Buscar" className={`${ROOM_INPUT} pl-10`} />
          </div>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-md-on-surface-variant)]">{options.length === 0 ? 'No tienes nada de este tipo todavía.' : 'Sin resultados.'}</p>
          ) : (
            <ul className="-mx-2 mt-2 space-y-0.5">
              {filtered.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={option.disabled}
                    onClick={() => setChosen(option)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-[var(--color-md-surface-container-high)] disabled:opacity-45"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-surface-container-high)] text-[var(--color-md-primary)] [&>svg]:h-4 [&>svg]:w-4">
                      {ROOM_ITEM_ICON[kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{option.title}</span>
                      {option.subtitle && <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">{option.subtitle}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {chosen && kind && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl bg-[var(--color-md-surface-container-high)] p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] [&>svg]:h-5 [&>svg]:w-5">
              {ROOM_ITEM_ICON[kind]}
            </span>
            <span className="min-w-0">
              <span className="block text-11px font-bold uppercase tracking-wide text-[var(--color-md-primary)]">{ROOM_ITEM_LABEL[kind]}</span>
              <span className="block break-words text-sm font-bold text-[var(--color-md-on-surface)]">{chosen.title}</span>
              {chosen.subtitle && <span className="block break-words text-xs text-[var(--color-md-on-surface-variant)]">{chosen.subtitle}</span>}
            </span>
          </div>
          {textAllowed && (
            <div>
              <label htmlFor="room-attach-text" className="text-xs font-bold text-[var(--color-md-on-surface-variant)]">
                Mensaje (opcional)
              </label>
              <textarea
                id="room-attach-text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, ROOM_TEXT_MAX))}
                rows={2}
                placeholder="Por ejemplo: el apunte de hoy"
                className={`${ROOM_INPUT} mt-1 resize-none`}
              />
              <p className="mt-0.5 text-right text-10px font-semibold text-[var(--color-md-on-surface-variant)]">
                {text.length}/{ROOM_TEXT_MAX}
              </p>
            </div>
          )}
          <button type="button" className={`${ROOM_FILLED_BUTTON} w-full`} onClick={() => void share()} disabled={sending}>
            {sending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <SendHorizontal aria-hidden="true" />}
            {sending ? 'Preparando…' : shareLabel}
          </button>
        </div>
      )}
    </Modal>
  );
};
