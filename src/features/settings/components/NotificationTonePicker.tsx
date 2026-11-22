import React, { useEffect, useRef, useState } from 'react';
import {
  Backpack,
  BellRing,
  Bubbles,
  Castle,
  Church,
  Clock4,
  Droplet,
  Droplets,
  Drum,
  Flower2,
  GraduationCap,
  Landmark,
  Music,
  Music4,
  Piano,
  Play,
  Radar,
  School,
  Smartphone,
  Square,
  Sun,
  TrainFront,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import {
  NOTIFICATION_TONE_GROUPS,
  NOTIFICATION_TONES,
  notificationToneUrl,
  resolveNotificationTone,
  type NotificationToneInfo,
} from '../notificationTones';
import type { NotificationSoundTone } from '../types';

/** Ícono característico de cada tono (Record: un tono nuevo sin ícono no compila). */
const TONE_ICONS: Record<NotificationSoundTone, LucideIcon> = {
  chime_school_jp: School,
  chime_big_ben: Clock4,
  chime_lycee_fr: Backpack,
  bell_retro_school: BellRing,
  chime_shinjuku_station: TrainFront,
  carillon_oxford: GraduationCap,
  bell_campus: Landmark,
  bell_harvard_chapel: Church,
  carillon_sorbonne: Castle,
  bell_berkeley_campanile: Sun,
  bowl_tibetan_zen: Flower2,
  tone_water_tuning_fork: Droplets,
  windchime_furin: Wind,
  sonar_study_ping: Radar,
  zen_drop: Droplet,
  kalimba_study_arpeggio: Music,
  harp_glissando_short: Music4,
  marimba_gentle: Drum,
  synth_warm_chord: Piano,
  pop_glass_organic: Bubbles,
  default: Smartphone,
};

interface NotificationTonePickerProps {
  value: NotificationSoundTone;
  onSelect: (tone: NotificationSoundTone) => void;
  /** Tonos que ya usa otra sección (se muestra «En …»; elegirlo los intercambia). */
  usedBy?: Partial<Record<NotificationSoundTone, string>>;
}

/**
 * Catálogo de tonos M3 agrupado por familia. Cada ficha es una opción seleccionable (role="radio")
 * con un botón hermano de preescucha; solo suena un tono a la vez y el audio se detiene al
 * desmontar la sección. La descripción solo se muestra en el tono elegido para mantener la lista corta.
 */
export const NotificationTonePicker: React.FC<NotificationTonePickerProps> = ({ value, onSelect, usedBy }) => {
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
    const ToneIcon = TONE_ICONS[tone.id];
    const usedLabel = !isSelected ? usedBy?.[tone.id] : undefined;
    return (
      <div
        key={tone.id}
        className={`flex items-center gap-2 rounded-2xl pr-2 transition-[background-color,border-color,box-shadow] duration-150 ease-out ${
          isSelected
            ? 'border-2 border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)]'
            : 'border-2 border-[var(--color-md-outline-variant)]/70 bg-[var(--color-md-surface)] hover:border-[var(--color-md-outline)] hover:bg-[var(--color-md-surface-container)]'
        }`}
      >
        {/* Toda la parte izquierda elige el tono */}
        <button
          type="button"
          role="radio"
          aria-checked={isSelected}
          aria-label={`${tone.label}, ${tone.badge}${usedLabel ? `, ahora en ${usedLabel}` : ''}`}
          onClick={() => onSelect(tone.id)}
          className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 rounded-2xl py-2 pl-3 text-left transition-transform duration-150 ease-out active:scale-[0.99]"
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
            <span
              className={`block truncate text-sm font-bold ${
                isSelected ? 'text-[var(--color-md-on-primary-container)]' : 'text-[var(--color-md-on-surface)]'
              }`}
            >
              {tone.label}
            </span>
            {/* Origen como texto secundario (no parece un botón) */}
            <span
              className={`mt-0.5 flex items-center gap-1 text-xs ${
                isSelected ? 'text-[var(--color-md-on-primary-container)]/80' : 'text-[var(--color-md-on-surface-variant)]'
              }`}
            >
              <ToneIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{isSelected ? `${tone.badge} · ${tone.description}` : tone.badge}</span>
              {/* Única etiqueta: si otra sección ya lo usa (plana, sin relieve), junto al origen */}
              {usedLabel && (
                <span className="shrink-0 rounded-md bg-[var(--color-md-secondary-container)]/70 px-1.5 py-px text-10px font-semibold text-[var(--color-md-on-secondary-container)]">
                  En {usedLabel}
                </span>
              )}
            </span>
          </span>
        </button>

        {/* Escuchar: botón tonal aparte (no elige el tono) */}
        {tone.file ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePreview(tone.id, tone.file as string);
            }}
            aria-label={isPlaying ? `Detener ${tone.label}` : `Escuchar ${tone.label}`}
            aria-pressed={isPlaying}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 ease-out active:scale-90 ${
              isPlaying
                ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] shadow-xs'
                : 'bg-[var(--color-md-primary)]/10 text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/20'
            }`}
          >
            {/* Mientras suena, un anillo que late */}
            {isPlaying && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-md-primary)]/35" aria-hidden="true" />}
            {isPlaying ? (
              <Square className="relative h-4 w-4 fill-current" aria-hidden="true" />
            ) : (
              <Play className="relative ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
            )}
          </button>
        ) : (
          // El tono del sistema no se puede reproducir desde la app
          <span className="w-11 shrink-0 text-center text-10px font-semibold leading-tight text-[var(--color-md-on-surface-variant)]">
            Del sistema
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
            <p className="px-1 text-11px font-bold text-[var(--color-md-on-surface-variant)]">{group.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">{tones.map(renderTone)}</div>
          </div>
        );
      })}
    </div>
  );
};
