import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Mic, Pause, Pencil, Play, Square, Trash2, X } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { Button } from '../../../shared/components/atoms';
import { formInputClass } from '../../../shared/components/form/formStyles';
import { LEVEL_BARS, formatDuration, useVoiceRecorder } from '../hooks/useVoiceRecorder';
import type { NoteAudio } from '../types';

/* ---------------------------------------------------------------------------------------------
 * Grabadora (diálogo M3: hoja inferior en el teléfono, centrado en PC)
 * ------------------------------------------------------------------------------------------- */

interface VoiceRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Guarda la grabación en el apunte. */
  onSave: (recording: { blob: Blob; mimeType: string; durationMs: number; name: string }) => Promise<void>;
}

function defaultRecordingName(): string {
  const now = new Date();
  const day = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `Nota de voz · ${day}, ${time}`;
}

/** Medidor de voz: barras redondeadas con el color primario del tema (Material You). */
const LevelMeter: React.FC<{ levels: number[]; active: boolean }> = ({ levels, active }) => (
  <div className="flex h-16 items-center justify-center gap-[3px]" aria-hidden="true">
    {levels.map((level, index) => (
      <span
        key={index}
        className={`w-1.5 rounded-full transition-[height] duration-75 ${
          active ? 'bg-[var(--color-md-primary)]' : 'bg-[var(--color-md-outline-variant)]'
        }`}
        style={{ height: `${Math.max(6, Math.round(level * 64))}px` }}
      />
    ))}
  </div>
);

const RecorderBody: React.FC<Omit<VoiceRecorderModalProps, 'isOpen'> & { onDirtyChange: (dirty: boolean) => void; confirmDiscard: boolean; onConfirmDiscard: (value: boolean) => void }> = ({
  onClose,
  onSave,
  onDirtyChange,
  confirmDiscard,
  onConfirmDiscard,
}) => {
  const { status, elapsedMs, levels, error, recording, start, pause, resume, stop, discard } = useVoiceRecorder();
  const [name, setName] = useState(defaultRecordingName);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const nameId = useId();
  const previewUrl = useMemo(() => (recording ? URL.createObjectURL(recording.blob) : null), [recording]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const isLive = status === 'recording' || status === 'paused';
  const dirty = isLive || status === 'stopped';
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const handleSave = async () => {
    if (!recording) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({ ...recording, name: name.trim() || defaultRecordingName() });
      onDirtyChange(false);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la grabación.');
    } finally {
      setIsSaving(false);
    }
  };

  if (confirmDiscard) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-md-on-surface-variant)]">
          {isLive ? 'La grabación sigue en curso.' : 'Todavía no guardaste esta grabación.'} Si sales ahora, se perderá.
        </p>
        <ModalActions layout="stack">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              discard();
              onDirtyChange(false);
              onClose();
            }}
          >
            Descartar
          </Button>
          <Button variant="primary" size="sm" onClick={() => onConfirmDiscard(false)}>
            Seguir grabando
          </Button>
        </ModalActions>
      </div>
    );
  }

  const statusLabel =
    status === 'recording'
      ? 'Grabando'
      : status === 'paused'
        ? 'En pausa'
        : status === 'requesting'
          ? 'Esperando el micrófono…'
          : status === 'stopped'
            ? 'Grabación lista'
            : 'Toca el micrófono para empezar';

  return (
    <div className="space-y-5">
      {/* Estado, tiempo y medidor de voz */}
      <div className="rounded-3xl bg-[var(--color-md-surface-container-high)] px-4 py-5 text-center">
        <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--color-md-on-surface-variant)]" aria-live="polite">
          {status === 'recording' && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600 dark:bg-red-400" aria-hidden="true" />}
          {statusLabel}
        </p>
        <p className="mt-1 font-mono text-4xl font-bold tabular-nums tracking-tight text-[var(--color-md-on-surface)]" aria-label={`Duración ${formatDuration(elapsedMs)}`}>
          {formatDuration(elapsedMs)}
        </p>
        <div className="mt-3">
          <LevelMeter levels={status === 'stopped' ? Array(LEVEL_BARS).fill(0.15) : levels} active={status === 'recording'} />
        </div>
      </div>

      {(error || saveError) && (
        <p className="rounded-2xl bg-[var(--color-md-secondary-container)] px-3 py-2 text-xs font-semibold text-[var(--color-md-on-secondary-container)]" role="alert">
          {error || saveError}
        </p>
      )}

      {/* Controles: botón grande central (grabar / pausar / reanudar) y detener al lado */}
      {status !== 'stopped' && (
        <div className="flex items-center justify-center gap-5">
          <span className="h-12 w-12" aria-hidden="true" />
          <button
            type="button"
            onClick={() => {
              if (status === 'recording') pause();
              else if (status === 'paused') resume();
              else void start();
            }}
            disabled={status === 'requesting'}
            aria-label={status === 'recording' ? 'Pausar' : status === 'paused' ? 'Reanudar' : 'Empezar a grabar'}
            className={`flex h-[72px] w-[72px] items-center justify-center rounded-[24px] shadow-md transition-all duration-150 ease-out active:scale-95 disabled:opacity-60 ${
              status === 'recording'
                ? 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
                : 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
            }`}
          >
            {status === 'recording' ? <Pause className="h-8 w-8" aria-hidden="true" /> : <Mic className="h-8 w-8" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={stop}
            disabled={!isLive}
            aria-label="Detener"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)] transition-all duration-150 ease-out active:scale-95 disabled:opacity-0"
          >
            <Square className="h-5 w-5 fill-current" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Revisión antes de guardar: escuchar y poner nombre */}
      {status === 'stopped' && recording && previewUrl && (
        <div className="space-y-3">
          <audio src={previewUrl} controls preload="metadata" className="w-full" aria-label="Escuchar la grabación" />
          <div className="space-y-1.5">
            <label htmlFor={nameId} className="block text-xs font-semibold text-[var(--color-md-on-surface)]">
              Nombre
            </label>
            <input id={nameId} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={formInputClass} />
          </div>
        </div>
      )}

      <ModalActions layout="stack">
        {status === 'stopped' ? (
          <>
            <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} onClick={discard} disabled={isSaving}>
              Descartar
            </Button>
            <Button variant="primary" size="sm" icon={<Check className="h-4 w-4" aria-hidden="true" />} isLoading={isSaving} onClick={() => void handleSave()}>
              Guardar en el apunte
            </Button>
          </>
        ) : isLive ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => onConfirmDiscard(true)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" icon={<Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />} onClick={stop}>
              Terminar grabación
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </ModalActions>
    </div>
  );
};

/**
 * Grabadora de notas de voz. Cerrarla (✕, Atrás o Escape) con algo grabado pide confirmación
 * para no perder la grabación por un toque.
 */
export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({ isOpen, onClose, onSave }) => {
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [session, setSession] = useState(0);
  const [prevOpen, setPrevOpen] = useState(isOpen);

  // Cada apertura empieza de cero (nuevo cuerpo = grabadora nueva)
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setSession((value) => value + 1);
      setDirty(false);
      setConfirmDiscard(false);
    }
  }

  const requestClose = () => {
    if (dirty && !confirmDiscard) setConfirmDiscard(true);
    else onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={requestClose} title={confirmDiscard ? '¿Descartar la grabación?' : 'Nota de voz'} maxWidth="sm">
      {isOpen && (
        <RecorderBody
          key={session}
          onClose={onClose}
          onSave={onSave}
          onDirtyChange={setDirty}
          confirmDiscard={confirmDiscard}
          onConfirmDiscard={setConfirmDiscard}
        />
      )}
    </Modal>
  );
};

/* ---------------------------------------------------------------------------------------------
 * Reproductor de una nota de voz
 * ------------------------------------------------------------------------------------------- */

/** Solo una nota de voz suena a la vez: al empezar una, las demás se pausan. */
const PLAY_EVENT = 'agenda-voice-note-play';

interface VoiceNoteCardProps {
  audio: NoteAudio;
  onRename: () => void;
  onDelete: () => void;
}

export const VoiceNoteCard: React.FC<VoiceNoteCardProps> = ({ audio, onRename, onDelete }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const fixingDurationRef = useRef(false);
  const url = useMemo(() => URL.createObjectURL(audio.blob), [audio.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const durationMs = Math.max(audio.durationMs, 1);
  const progress = Math.min(100, (currentMs / durationMs) * 100);

  useEffect(() => {
    const onOtherPlay = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== audio.id) audioRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, [audio.id]);

  const togglePlay = () => {
    const element = audioRef.current;
    if (!element) return;
    if (element.paused) {
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: audio.id }));
      void element.play().catch(() => setIsPlaying(false));
    } else {
      element.pause();
    }
  };

  const seekTo = (ms: number) => {
    const element = audioRef.current;
    if (!element) return;
    element.currentTime = ms / 1000;
    setCurrentMs(ms);
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-2.5 pr-1">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentMs(0);
        }}
        onLoadedMetadata={(event) => {
          // Los WebM de MediaRecorder no traen duración: este truco hace que el navegador la calcule
          // y así se pueda adelantar/retroceder con precisión
          const element = event.currentTarget;
          if (!Number.isFinite(element.duration)) {
            fixingDurationRef.current = true;
            element.currentTime = 1e7;
          }
        }}
        onTimeUpdate={(event) => {
          const element = event.currentTarget;
          if (fixingDurationRef.current) {
            fixingDurationRef.current = false;
            element.currentTime = 0;
            return;
          }
          setCurrentMs(element.currentTime * 1000);
        }}
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? `Pausar ${audio.name}` : `Reproducir ${audio.name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-2xs transition-all duration-150 ease-out active:scale-95"
      >
        {isPlaying ? <Pause className="h-5 w-5 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-semibold text-[var(--color-md-on-surface)]">{audio.name}</p>
        <input
          type="range"
          min={0}
          max={durationMs}
          step={100}
          value={Math.min(currentMs, durationMs)}
          onChange={(event) => seekTo(Number(event.target.value))}
          aria-label={`Posición en ${audio.name}`}
          aria-valuetext={`${formatDuration(currentMs)} de ${formatDuration(durationMs)}`}
          data-no-swipe="true"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-md-primary)]"
          style={{
            background: `linear-gradient(to right, var(--color-md-primary) ${progress}%, var(--color-md-outline-variant) ${progress}%)`,
          }}
        />
        <p className="font-mono text-[11px] tabular-nums text-[var(--color-md-on-surface-variant)]">
          {formatDuration(currentMs)} / {formatDuration(audio.durationMs)}
        </p>
      </div>
      <M3KebabMenu
        size="sm"
        ariaLabel={`Opciones de ${audio.name}`}
        items={[
          { id: 'rename', label: 'Cambiar nombre', icon: <Pencil className="h-4 w-4 text-[var(--color-md-primary)]" />, onClick: onRename },
          { id: 'delete', label: 'Eliminar', icon: <Trash2 className="h-4 w-4" />, variant: 'destructive', onClick: onDelete },
        ]}
      />
    </div>
  );
};

/* ---------------------------------------------------------------------------------------------
 * Sección "Notas de voz" del apunte (lista + renombrar + eliminar)
 * ------------------------------------------------------------------------------------------- */

interface VoiceNotesSectionProps {
  audios: NoteAudio[];
  onRecord: () => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  className?: string;
}

export const VoiceNotesSection: React.FC<VoiceNotesSectionProps> = ({ audios, onRecord, onRename, onDelete, className = '' }) => {
  const [renaming, setRenaming] = useState<NoteAudio | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<NoteAudio | null>(null);
  const renameId = useId();

  if (audios.length === 0) return null;

  return (
    <section className={`space-y-3 ${className}`} aria-label="Notas de voz">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">
          Notas de voz
          <span className="ml-1.5 font-medium text-[var(--color-md-on-surface-variant)]">{audios.length}</span>
        </h3>
        <button
          type="button"
          onClick={onRecord}
          aria-label="Grabar otra nota de voz"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-md-primary)] transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-95"
        >
          <Mic className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {audios.map((audio) => (
          <VoiceNoteCard
            key={audio.id}
            audio={audio}
            onRename={() => {
              setRenaming(audio);
              setRenameValue(audio.name);
              setRenameError(null);
            }}
            onDelete={() => setDeleting(audio)}
          />
        ))}
      </div>

      <Modal isOpen={renaming !== null} onClose={() => setRenaming(null)} title="Cambiar nombre" maxWidth="sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!renaming) return;
            onRename(renaming.id, renameValue)
              .then(() => setRenaming(null))
              .catch((err: unknown) => setRenameError(err instanceof Error ? err.message : 'No se pudo cambiar el nombre.'));
          }}
          className="space-y-2"
        >
          <label htmlFor={renameId} className="block text-xs font-semibold text-[var(--color-md-on-surface)]">
            Nombre de la nota de voz
          </label>
          <input id={renameId} value={renameValue} maxLength={80} autoFocus onChange={(e) => setRenameValue(e.target.value)} className={formInputClass} />
          {renameError && <p className="text-xs text-red-600 dark:text-red-400">{renameError}</p>}
          <ModalActions>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Guardar
            </Button>
          </ModalActions>
        </form>
      </Modal>

      <Modal isOpen={deleting !== null} onClose={() => setDeleting(null)} title="¿Eliminar la nota de voz?" maxWidth="sm">
        <p className="text-sm text-[var(--color-md-on-surface-variant)]">
          Se borrará «{deleting?.name}» de este apunte. No se puede deshacer.
        </p>
        <ModalActions>
          <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" aria-hidden="true" />} onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (!deleting) return;
              void onDelete(deleting.id).finally(() => setDeleting(null));
            }}
          >
            Eliminar
          </Button>
        </ModalActions>
      </Modal>
    </section>
  );
};
