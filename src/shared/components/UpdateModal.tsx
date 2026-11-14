import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Sparkles } from 'lucide-react';
import { Modal, ModalActions } from './Modal';
import { Button } from './atoms';
import { UpdateInstallActions } from './UpdateInstallActions';
import { APP_INFO } from '../constants/appInfo';
import { canInstallInApp, formatReleaseDate, isDesktopApp, type UpdateInfo } from '../services/updateService';

interface UpdateModalProps {
  info: UpdateInfo;
  /** Abrir la página de descarga (web, o si la descarga dentro de la app no está disponible o falla). */
  onDownload: () => void;
  /** "Más tarde" (o cerrar): no se vuelve a mostrar hoy para esta versión. */
  onLater: () => void;
}

/** Aviso de nueva versión al abrir la app: novedades, descargar e instalar o posponer hasta mañana. */
export const UpdateModal: React.FC<UpdateModalProps> = ({ info, onDownload, onLater }) => {
  const isNative = Capacitor.isNativePlatform();
  const inApp = canInstallInApp(info);
  const releaseDate = formatReleaseDate(info.releaseDate);

  return (
    <Modal isOpen onClose={onLater} title={`¡Nueva versión disponible! (v${info.latestVersion})`} maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-xs leading-relaxed text-[var(--color-md-on-surface-variant)]">
            Tienes la versión <strong className="text-[var(--color-md-on-surface)]">{APP_INFO.version}</strong>
            {releaseDate ? `. La ${info.latestVersion} se publicó el ${releaseDate}.` : '.'}
          </p>
        </div>

        {info.highlights.length > 0 && (
          <section aria-label="Novedades" className="space-y-1.5">
            <p className="text-xs font-bold text-[var(--color-md-on-surface)]">Novedades</p>
            <ul className="space-y-1.5">
              {info.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-md-on-surface)]">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                  {highlight}
                </li>
              ))}
            </ul>
          </section>
        )}

        {isNative && (
          <p className="rounded-xl bg-[var(--color-md-surface-container)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-md-on-surface-variant)]">
            {inApp
              ? 'Se descarga dentro de la app y se abre el instalador de Android. Tus materias y apuntes se conservan.'
              : 'Se abrirá GitHub para descargar el APK. Instálalo encima de la app actual: tus materias y apuntes se conservan.'}
          </p>
        )}
        {isDesktopApp() && inApp && (
          <p className="rounded-xl bg-[var(--color-md-surface-container)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-md-on-surface-variant)]">
            Se descarga dentro de la app y se instala sola: la agenda se cierra y vuelve a abrirse actualizada. Tus materias y apuntes se conservan.
          </p>
        )}

        <UpdateInstallActions info={info} onOpenPage={onDownload} />

        <ModalActions>
          <Button variant="ghost" size="sm" onClick={onLater}>
            Más tarde
          </Button>
        </ModalActions>
      </div>
    </Modal>
  );
};
