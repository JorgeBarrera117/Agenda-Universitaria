import React, { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import {
  NOTIFICATION_TONE_GROUPS,
  NOTIFICATION_TONES,
  notificationToneUrl,
  resolveNotificationTone,
  type NotificationToneInfo,
} from '../notificationTones';
import type { NotificationSoundTone } from '../types';

interface NotificationTonePickerProps {
  value: NotificationSoundTone;
  onSelect: (tone: NotificationSoundTone) => void;
}

/**
 * Catálogo de tonos M3 agrupado por familia. Cada ficha es una opción seleccionable (role="radio")
 * con un botón hermano de preescucha; solo suena un tono a la vez y el audio se detiene al
 * desmontar la sección. La descripción solo se muestra en el tono elegido para mantener la lista corta.
 */
export const NotificationTonePicker: React.FC<NotificationTonePickerProps> = ({ value, onSelect }) => {
  const selected = resolveNotificationTone(value).id;
  const [playing, setPlaying] = useState<NotificationSoundTone | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPreview = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }
    setPlaying(null);
  };

  const togglePreview = (tone: NotificationSoundTone, file: string) => {
    const wasPlaying = playing === tone;
    stopPreview();
    if (wasPlaying) return;

    const audio = new Audio(notificationToneUrl(file));
    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlaying(null);
      }
    };
    audioRef.current = audio;
    setPlaying(tone);
    audio.play().catch(() => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlaying(null);
      }
    });
  };

  // Al salir de la subvista (o desactivar el sonido) se corta la preescucha en curso
  useEffect(
    () => () => {
      const audio = audioRef.current;
      if (audio) {
        audio.onended = null;
        audio.pause();
        audio.currentTime = 0;
        audioRef.current = null;
      }
    },
    []
  );

  const renderTone = (tone: NotificationToneInfo) => {
    const isSelected = tone.id === selected;
    const isPlaying = playing === tone.id;
    return (
      <div
        key={tone.id}
        className={`flex items-center gap-1 rounded-xl border pr-1 transition-colors duration-150 ease-out ${
          isSelected
            ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)]'
            : 'border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface)] hover:border-[var(--color-md-outline)]'
        }`}
      >
        <button
          type="button"
          role="radio"
          aria-checked={isSelected}
          aria-label={`${tone.label}, ${tone.badge}`}
          onClick={() => onSelect(tone.id)}
          className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1.5 pl-3 text-left transition-transform duration-150 ease-out active:scale-[0.99]"
        >
          {/* Radio M3: anillo exterior y punto interior al seleccionarse */}
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
              isSelected ? 'border-[var(--color-md-primary)]' : 'border-[var(--color-md-outline)]'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full bg-[var(--color-md-primary)] transition-transform duration-150 ease-out ${
                isSelected ? 'scale-100' : 'scale-0'
              }`}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span
                className={`text-sm font-bold ${
                  isSelected ? 'text-[var(--color-md-on-primary-container)]' : 'text-[var(--color-md-on-surface)]'
                }`}
              >
                {tone.label}
              </span>
              <span
                className={`shrink-0 rounded-md px-1.5 py-px text-[10px] font-bold ${
                  isSelected
                    ? 'bg-[var(--color-md-surface)]/60 text-[var(--color-md-on-primary-container)]'
                    : 'bg-[var(--color-md-surface-container-high)] text-[var(--color-md-on-surface-variant)]'
                }`}
              >
                {tone.badge}
              </span>
            </span>
            {isSelected && (
              <span className="mt-0.5 block text-xs text-[var(--color-md-on-primary-container)]/80">{tone.description}</span>
            )}
          </span>
        </button>

        {tone.file ? (
          <button
            type="button"
            onClick={() => togglePreview(tone.id, tone.file as string)}
            aria-label={isPlaying ? `Detener ${tone.label}` : `Escuchar ${tone.label}`}
            aria-pressed={isPlaying}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-150 ease-out active:scale-90 ${
              isPlaying
                ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-2xs'
                : 'text-[var(--color-md-primary)] hover:bg-[var(--color-md-surface-container-high)]'
            }`}
          >
            {isPlaying ? (
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            )}
          </button>
        ) : (
          // El tono del sistema no se puede reproducir desde la app
          <span className="shrink-0 px-2 text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">
            (Sonido del sistema)
          </span>
        )}
      </div>
    );
  };

  return (
    <div role="radiogroup" aria-label="Tono de notificación" className="space-y-3">
      {NOTIFICATION_TONE_GROUPS.map((group) => {
        const tones = NOTIFICATION_TONES.filter((t) => t.group === group.id);
        if (tones.length === 0) return null;
        return (
          <div key={group.id} className="space-y-1.5">
            <p className="px-1 text-[11px] font-bold text-[var(--color-md-on-surface-variant)]">{group.label}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">{tones.map(renderTone)}</div>
          </div>
        );
      })}
    </div>
  );
};
