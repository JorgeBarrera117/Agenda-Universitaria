import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, Droplet, Landmark, Music, Play, Smartphone, Square } from 'lucide-react';
import { NOTIFICATION_TONES, notificationToneUrl, resolveNotificationTone } from '../notificationTones';
import type { NotificationSoundTone } from '../types';

const TONE_ICONS: Record<NotificationSoundTone, React.ComponentType<{ className?: string }>> = {
  chime_school_jp: Bell,
  bell_campus: Landmark,
  marimba_gentle: Music,
  zen_drop: Droplet,
  default: Smartphone,
};

interface NotificationTonePickerProps {
  value: NotificationSoundTone;
  onSelect: (tone: NotificationSoundTone) => void;
}

/**
 * Lista de tonos M3: cada fila es una opción seleccionable (role="radio") con un botón hermano de
 * preescucha. Solo suena un tono a la vez y el audio se detiene al desmontar la sección.
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

  return (
    <div role="radiogroup" aria-label="Tono de notificación" className="space-y-1.5">
      {NOTIFICATION_TONES.map((tone) => {
        const Icon = TONE_ICONS[tone.id];
        const isSelected = tone.id === selected;
        const isPlaying = playing === tone.id;
        return (
          <div
            key={tone.id}
            className={`flex items-center gap-1 rounded-2xl border p-1 transition-colors duration-150 ease-out ${
              isSelected
                ? 'border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)]'
                : 'border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface)] hover:border-[var(--color-md-outline)]'
            }`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(tone.id)}
              className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-transform duration-150 ease-out active:scale-[0.99]"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isSelected
                    ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
                    : 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-primary)]'
                }`}
                aria-hidden="true"
              >
                {isSelected ? <Check className="h-4 w-4 stroke-[3]" /> : <Icon className="h-4 w-4" />}
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
                <span
                  className={`block text-xs ${
                    isSelected ? 'text-[var(--color-md-on-primary-container)]/80' : 'text-[var(--color-md-on-surface-variant)]'
                  }`}
                >
                  {tone.description}
                </span>
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
              // El tono del sistema no se puede reproducir desde la web: se reserva el hueco para alinear
              <span className="h-10 w-10 shrink-0" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
};
