import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarCheck, ChevronRight, Clock, Coffee, Play, Repeat, Square, Timer } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { sectionTones } from '../../../shared/services/notificationService';
import { notificationToneUrl, resolveNotificationTone } from '../notificationTones';
import { NotificationTonePicker } from './NotificationTonePicker';
import type { AppSettings, NotificationSoundTone } from '../types';

type ToneKey = 'notificationTone' | 'agendaTone' | 'studyStartTone' | 'studyBreakTone' | 'studyResumeTone';

interface ToneSlot {
  key: ToneKey;
  /** Nombre corto (para «En Agenda» en el selector). */
  name: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const SECTIONS: { title: string; slots: ToneSlot[] }[] = [
  {
    title: 'Avisos',
    slots: [
      { key: 'notificationTone', name: 'Horario', label: 'Horario', description: 'Antes y al iniciar cada clase, y el resumen del día', icon: <Clock className="h-5 w-5" /> },
      { key: 'agendaTone', name: 'Agenda', label: 'Agenda', description: 'Tareas, exámenes, recordatorios y repasos', icon: <CalendarCheck className="h-5 w-5" /> },
    ],
  },
  {
    title: 'Estudio',
    slots: [
      { key: 'studyStartTone', name: 'Empezar', label: 'Al empezar a estudiar', description: 'Cuando inicias una sesión de concentración', icon: <Timer className="h-5 w-5" /> },
      { key: 'studyBreakTone', name: 'Pausa', label: 'Al empezar la pausa', description: 'Cuando termina la sesión y toca descansar', icon: <Coffee className="h-5 w-5" /> },
      { key: 'studyResumeTone', name: 'Volver', label: 'Al terminar la pausa', description: 'Cuando toca volver a estudiar', icon: <Repeat className="h-5 w-5" /> },
    ],
  },
];

const ALL_SLOTS = SECTIONS.flatMap((section) => section.slots);

interface SoundsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (partial: Partial<AppSettings>) => void;
}

/**
 * Sonidos de la app por sección, en una hoja: primero la lista (qué suena en cada caso, con ▶
 * para escucharlo) y al tocar una fila, el catálogo de tonos. Ninguna sección repite tono: si el
 * elegido ya lo usa otra, se intercambian, así cada aviso se reconoce por su sonido.
 */
export const SoundsSheet: React.FC<SoundsSheetProps> = ({ isOpen, onClose, settings, onUpdate }) => {
  const [editing, setEditing] = useState<ToneSlot | null>(null);
  const [playing, setPlaying] = useState<ToneKey | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tones = sectionTones(settings);
  const current: Record<ToneKey, NotificationSoundTone> = {
    notificationTone: tones.schedule,
    agendaTone: tones.agenda,
    studyStartTone: tones.studyStart,
    studyBreakTone: tones.studyBreak,
    studyResumeTone: tones.studyResume,
  };

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  };

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    []
  );

  const preview = (key: ToneKey) => {
    const wasPlaying = playing === key;
    stop();
    if (wasPlaying) return;
    const file = resolveNotificationTone(current[key]).file;
    if (!file) return;
    const audio = new Audio(notificationToneUrl(file));
    audio.onended = () => setPlaying((p) => (p === key ? null : p));
    audioRef.current = audio;
    setPlaying(key);
    audio.play().catch(() => setPlaying(null));
  };

  const choose = (slot: ToneSlot, tone: NotificationSoundTone) => {
    const previous = current[slot.key];
    const owner = ALL_SLOTS.find((s) => s.key !== slot.key && current[s.key] === tone);
    // Sin repetidos: si otra sección tenía ese tono, se queda con el que esta tenía
    onUpdate(owner ? { [slot.key]: tone, [owner.key]: previous } : { [slot.key]: tone });
  };

  const usedBy = (slot: ToneSlot): Partial<Record<NotificationSoundTone, string>> => {
    const result: Partial<Record<NotificationSoundTone, string>> = {};
    for (const other of ALL_SLOTS) if (other.key !== slot.key) result[current[other.key]] = other.key.startsWith('study') ? `Estudio · ${other.name}` : other.name;
    return result;
  };

  const close = () => {
    stop();
    setEditing(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={editing ? editing.label : 'Sonidos'} maxWidth="lg">
      {editing ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full pl-2 pr-3 text-sm font-bold text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/10"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Sonidos
          </button>
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">
            {editing.description}. Si eliges un tono que ya usa otra sección, se intercambian.
          </p>
          <NotificationTonePicker value={current[editing.key]} onSelect={(tone) => choose(editing, tone)} usedBy={usedBy(editing)} />
        </div>
      ) : (
        <div className="space-y-4">
          {!settings.notificationSound && (
            <p className="rounded-2xl bg-[var(--color-md-secondary-container)] px-3 py-2.5 text-xs font-semibold text-[var(--color-md-on-secondary-container)]">
              El sonido está apagado en Notificaciones: los avisos llegan en silencio (solo vibran).
            </p>
          )}
          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-1.5">
              <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">{section.title}</h3>
              <ul className="space-y-1.5">
                {section.slots.map((slot) => {
                  const tone = resolveNotificationTone(current[slot.key]);
                  const isPlaying = playing === slot.key;
                  return (
                    <li key={slot.key} className="flex items-center gap-1 rounded-2xl bg-[var(--color-md-surface-container)] pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          stop();
                          setEditing(slot);
                        }}
                        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2 pl-3 text-left transition-colors hover:bg-[var(--color-md-surface-container-high)]"
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]"
                          aria-hidden="true"
                        >
                          {slot.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">{slot.label}</span>
                          <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">
                            {tone.label} · {tone.badge}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
                      </button>
                      {tone.file && (
                        <button
                          type="button"
                          onClick={() => preview(slot.key)}
                          aria-label={isPlaying ? `Detener ${tone.label}` : `Escuchar el sonido de ${slot.label}`}
                          aria-pressed={isPlaying}
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                            isPlaying
                              ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                              : 'text-[var(--color-md-primary)] hover:bg-[var(--color-md-surface-container-high)]'
                          }`}
                        >
                          {isPlaying ? <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <p className="text-11px text-[var(--color-md-on-surface-variant)]">Cada sección tiene su propio tono, así reconoces el aviso sin mirar el teléfono.</p>
        </div>
      )}
      <ModalActions>
        <button
          type="button"
          onClick={close}
          className="h-10 rounded-full bg-[var(--color-md-primary)] px-6 text-sm font-bold text-[var(--color-md-on-primary)] hover:bg-[var(--color-md-primary-hover)]"
        >
          Listo
        </button>
      </ModalActions>
    </Modal>
  );
};
