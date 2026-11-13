import React from 'react';
import { Capacitor } from '@capacitor/core';
import { AlertTriangle, Download, ExternalLink, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useInAppUpdate } from '../hooks/useInAppUpdate';
import { canInstallInApp, isDesktopApp, type UpdateInfo } from '../services/updateService';

interface UpdateInstallActionsProps {
  info: UpdateInfo;
  /** Alternativa: abrir la página de descarga (web, versiones sin enlace directo o si algo falla). */
  onOpenPage: () => void;
}

const primaryButton =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-md-primary)] px-4 text-sm font-bold text-[var(--color-md-on-primary)] shadow-xs transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-[0.98] disabled:opacity-60';
const textButton =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold text-[var(--color-md-primary)] hover:bg-[var(--color-md-surface-container-high)]';

/**
 * Botón y estados de la actualización. En Android, si version.json trae el APK directo y su huella,
 * descarga e instala sin salir de la app (barra de progreso, permiso, instalador). En otro caso
 * abre la página de descarga como antes.
 */
export const UpdateInstallActions: React.FC<UpdateInstallActionsProps> = ({ info, onOpenPage }) => {
  const { state, start, grantPermission, reopenInstaller } = useInAppUpdate();
  const inApp = canInstallInApp(info);
  const isNative = Capacitor.isNativePlatform();
  const isDesktop = isDesktopApp();

  if (!inApp) {
    return (
      <button type="button" onClick={onOpenPage} className={primaryButton}>
        {isNative || isDesktop ? <Download className="h-4 w-4" aria-hidden="true" /> : <ExternalLink className="h-4 w-4" aria-hidden="true" />}
        {isNative || isDesktop ? 'Descargar actualización' : 'Abrir la nueva versión'}
      </button>
    );
  }

  return (
    <div className="space-y-2" aria-live="polite">
      {state.phase === 'idle' && (
        <button type="button" onClick={() => void start(info)} className={primaryButton}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Descargar e instalar
        </button>
      )}

      {state.phase === 'downloading' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-md-on-surface)]">
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Descargando actualización…
            </span>
            {state.percent !== null && <span>{state.percent} %</span>}
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--color-md-surface-container-high)]"
            role="progressbar"
            aria-label="Progreso de la descarga"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state.percent ?? undefined}
          >
            <div
              className={`h-full rounded-full bg-[var(--color-md-primary)] transition-[width] duration-200 ${state.percent === null ? 'w-1/3 animate-pulse' : ''}`}
              style={state.percent === null ? undefined : { width: `${state.percent}%` }}
            />
          </div>
        </div>
      )}

      {state.phase === 'needs-permission' && (
        <div className="space-y-2 rounded-xl bg-[var(--color-md-surface-container)] p-3">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-md-on-surface)]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
            La actualización ya se descargó y verificó. Android necesita tu permiso (solo esta vez): activa
            «Permitir de esta fuente» y vuelve a la app.
          </p>
          <button type="button" onClick={() => void grantPermission()} className={primaryButton}>
            Dar permiso para instalar
          </button>
        </div>
      )}

      {state.phase === 'installer-opened' && isDesktop && (
        <p className="inline-flex items-center gap-2 text-xs font-semibold leading-relaxed text-[var(--color-md-on-surface)]">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
          Instalando… La agenda se cerrará y volverá a abrirse en unos segundos. Tus datos se conservan.
        </p>
      )}

      {state.phase === 'installer-opened' && !isDesktop && (
        <div className="space-y-1.5">
          <p className="text-xs leading-relaxed text-[var(--color-md-on-surface)]">
            Se abrió el instalador de Android: toca «Actualizar». Tus materias y apuntes se conservan.
          </p>
          <button type="button" onClick={() => void reopenInstaller()} className={textButton}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Abrir el instalador de nuevo
          </button>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="space-y-2">
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => void start(info)} className={textButton}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reintentar
            </button>
            <button type="button" onClick={onOpenPage} className={textButton}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Descargar desde GitHub
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
