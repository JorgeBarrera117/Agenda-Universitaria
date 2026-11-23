import React, { useState } from 'react';
import { ChevronDown, Heart, ShieldCheck, Sparkles } from 'lucide-react';
import { APP_INFO } from '../../../shared/constants/appInfo';
import type { UpdateCheckResult } from '../../../shared/services/updateService';
import { ChangelogPreview } from './ChangelogSettings';
import { SettingsCard } from './SettingsPrimitives';
import { UpdateSettings } from './UpdateSettings';

interface AboutSettingsProps {
  /** Resultado de actualizaciones ya conocido en esta sesión (p. ej. el de la comprobación al abrir la app). */
  updateResult: UpdateCheckResult | null;
  onUpdateResult: (result: UpdateCheckResult) => void;
  onOpenChangelog: () => void;
  onShowToast: (message: string) => void;
}

/**
 * Ajustes → Acerca de la agenda, en cuatro bloques sin scroll de más:
 * 1. Tarjeta principal: logo, nombre, versión, «Buscar actualizaciones» y su estado.
 * 2. Las 3 novedades principales de la versión (el resto, en el historial completo).
 * 3. «Un mensaje para ti», cerrado por defecto (solo la cita).
 * 4. Pie de dos líneas: autoría y privacidad.
 */
export const AboutSettings: React.FC<AboutSettingsProps> = ({ updateResult, onUpdateResult, onOpenChangelog, onShowToast }) => {
  const [messageOpen, setMessageOpen] = useState(false);

  return (
    <>
      <UpdateSettings initialResult={updateResult} onResult={onUpdateResult} onShowToast={onShowToast} />

      <ChangelogPreview onOpenAll={onOpenChangelog} />

      {/* Mensaje del autor para quien use la agenda: ánimo para no rendirse */}
      <section
        aria-labelledby="about-message-title"
        className="space-y-3 rounded-2xl bg-[var(--color-md-primary-container)] p-4 text-[var(--color-md-on-primary-container)]"
      >
        <h4 id="about-message-title" className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          Un mensaje para ti
        </h4>
        {messageOpen && (
          <>
            <p className="text-13px leading-relaxed">
              No te rindas. Puede que hoy tengas menos recursos, menos tiempo o más obstáculos que otros, pero tus
              circunstancias no definen hasta dónde puedes llegar. Siempre hay una razón para seguir adelante.
            </p>
            <p className="text-13px leading-relaxed">
              Aunque parezca que todo el mundo está en contra, persigue tus sueños con constancia y sin dejar de ser humilde:
              aprende de cada caída, agradece cada ayuda y nunca pases por encima de nadie para avanzar.
            </p>
          </>
        )}
        <figure className="rounded-xl border-l-4 border-[var(--color-md-primary)] bg-[var(--color-md-surface)]/60 px-3 py-2.5">
          <blockquote className="text-sm font-semibold italic leading-snug text-[var(--color-md-on-surface)]">
            «Todo lo puedo en Cristo que me fortalece.»
          </blockquote>
          <figcaption className="mt-1 text-xs font-medium text-[var(--color-md-on-surface-variant)]">Filipenses 4:13</figcaption>
        </figure>
        {messageOpen && (
          <>
            <p className="text-13px leading-relaxed">
              Creas o no en Dios, que estas palabras te recuerden que no estás solo y que tienes más fuerza de la que imaginas.
            </p>
            <p className="text-right text-xs font-semibold">— {APP_INFO.author}</p>
          </>
        )}
        <button
          type="button"
          onClick={() => setMessageOpen((open) => !open)}
          aria-expanded={messageOpen}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10 active:scale-[0.98]"
        >
          {messageOpen ? 'Mostrar menos' : 'Leer mensaje completo'}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${messageOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </section>

      {/* Pie compacto: autoría y privacidad en dos líneas */}
      <SettingsCard>
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--color-md-on-surface)]">
            <Heart className="h-4 w-4 shrink-0 fill-[var(--color-md-primary)] text-[var(--color-md-primary)]" aria-hidden="true" />
            Desarrollada por {APP_INFO.author}
          </p>
          <p className="flex items-center gap-2 text-xs text-[var(--color-md-on-surface-variant)]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
            <span>
              <span className="font-bold text-[var(--color-md-on-surface)]">Offline-first y privada:</span> tus datos se quedan en este dispositivo, sin cuenta ni internet.
            </span>
          </p>
        </div>
      </SettingsCard>
    </>
  );
};
