import React from 'react';
import { Heart, ShieldCheck } from 'lucide-react';
import { APP_INFO } from '../../../shared/constants/appInfo';
import { SettingsCard } from './SettingsPrimitives';

export const AboutSettings: React.FC = () => (
  <SettingsCard>
    <header className="flex items-center gap-3">
      <img
        src="./app-icon-claro.svg"
        alt=""
        className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-1 shadow-2xs ring-1 ring-[var(--color-md-outline-variant)]"
      />
      <div className="min-w-0">
        <h3 className="truncate text-base font-black text-[var(--color-md-on-surface)]">{APP_INFO.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[var(--color-md-primary-container)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-md-on-primary-container)]">
            Versión {APP_INFO.version}
          </span>
          <span className="text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">“{APP_INFO.slogan}”</span>
        </div>
      </div>
    </header>

    <div className="space-y-1.5 border-t border-[var(--color-md-outline-variant)] pt-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-md-on-surface)]">
        <Heart className="h-4 w-4 shrink-0 fill-[var(--color-md-primary)] text-[var(--color-md-primary)]" aria-hidden="true" />
        Desarrollada por {APP_INFO.author}
      </p>
      <p className="text-xs leading-relaxed text-[var(--color-md-on-surface-variant)]">{APP_INFO.description}</p>
    </div>

    <div className="flex gap-3 rounded-xl bg-[var(--color-md-surface-container)] p-3">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="text-xs font-bold text-[var(--color-md-on-surface)]">Offline-first y privada</p>
        <p className="text-xs leading-relaxed text-[var(--color-md-on-surface-variant)]">
          Tus datos se guardan solo en este dispositivo (IndexedDB). No necesitas cuenta ni conexión a internet para
          gestionar tus materias y apuntes.
        </p>
      </div>
    </div>
  </SettingsCard>
);
