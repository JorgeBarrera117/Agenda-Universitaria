import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Download, ExternalLink, RotateCcw, Sparkles, WifiOff } from 'lucide-react';
import { APP_INFO } from '../../../shared/constants/appInfo';
import {
  checkForUpdates,
  formatReleaseDate,
  openDownloadUrl,
  updateUrlFor,
  type UpdateCheckResult,
} from '../../../shared/services/updateService';
import { SettingsCard } from './SettingsPrimitives';

interface UpdateSettingsProps {
  /** Resultado ya conocido en esta sesión (p. ej. el de la comprobación al abrir la app). */
  initialResult: UpdateCheckResult | null;
  onResult: (result: UpdateCheckResult) => void;
  onShowToast: (message: string) => void;
}

/** Ajustes → Actualizaciones: versión instalada, comprobación manual y descarga de la nueva. */
export const UpdateSettings: React.FC<UpdateSettingsProps> = ({ initialResult, onResult, onShowToast }) => {
  const [result, setResult] = useState<UpdateCheckResult | null>(initialResult);
  const [isChecking, setIsChecking] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const handleCheck = async () => {
    setIsChecking(true);
    const next = await checkForUpdates();
    setResult(next);
    onResult(next);
    setIsChecking(false);
  };

  const handleDownload = async (url: string) => {
    try {
      await openDownloadUrl(url);
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'No se pudo abrir la descarga.');
    }
  };

  const downloadUrl = result?.status === 'available' ? updateUrlFor(result.info) : undefined;
  const releaseDate = result && result.status !== 'error' ? formatReleaseDate(result.info.releaseDate) : null;

  return (
    <SettingsCard>
      <header className="flex items-center gap-3">
        <img
          src="./app-icon-claro.svg"
          alt=""
          className="h-12 w-12 shrink-0 rounded-2xl bg-white object-contain p-1 shadow-2xs ring-1 ring-[var(--color-md-outline-variant)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">Versión instalada</p>
          <p className="text-base font-black text-[var(--color-md-on-surface)]">v{APP_INFO.version}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={isChecking}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-md-outline)] px-4 text-xs font-bold text-[var(--color-md-primary)] transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--color-md-primary-container)] active:scale-95 disabled:opacity-60"
        >
          {/* Gira en sentido horario mientras consulta (el ícono apunta al revés) */}
          <RotateCcw className={`h-4 w-4 ${isChecking ? 'animate-spin [animation-direction:reverse]' : ''}`} aria-hidden="true" />
          {isChecking ? 'Buscando…' : 'Buscar actualizaciones'}
        </button>
      </header>

      <div aria-live="polite">
        {!result && (
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">
            Toca «Buscar actualizaciones» para comprobar si hay una versión más nueva.
          </p>
        )}

        {result?.status === 'up-to-date' && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            Tu app está actualizada a la última versión
          </p>
        )}

        {result?.status === 'error' && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {result.message}
          </p>
        )}

        {result?.status === 'available' && (
          <section className="space-y-3 rounded-2xl border border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] p-3 text-[var(--color-md-on-primary-container)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-md-primary)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-md-on-primary)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Nueva versión disponible
              </span>
              <span className="text-xs font-bold">
                v{result.info.latestVersion}
                {releaseDate ? ` · ${releaseDate}` : ''}
              </span>
            </div>

            {result.info.highlights.length > 0 && (
              <ul className="space-y-1">
                {result.info.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-xs leading-relaxed">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {highlight}
                  </li>
                ))}
              </ul>
            )}

            {downloadUrl ? (
              <button
                type="button"
                onClick={() => void handleDownload(downloadUrl)}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-md-primary)] px-4 text-sm font-bold text-[var(--color-md-on-primary)] shadow-xs transition-[transform,background-color] duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-[0.98]"
              >
                {isNative ? <Download className="h-4 w-4" aria-hidden="true" /> : <ExternalLink className="h-4 w-4" aria-hidden="true" />}
                {isNative ? 'Descargar e instalar' : 'Abrir la nueva versión'}
              </button>
            ) : (
              <p className="text-[11px]">La descarga todavía no está disponible. Vuelve a intentarlo más tarde.</p>
            )}

            {isNative && downloadUrl && (
              <p className="text-[11px] leading-relaxed opacity-90">
                Se abrirá GitHub para descargar el APK. Instálalo encima de la app actual: tus materias y apuntes se conservan.
              </p>
            )}
          </section>
        )}
      </div>
    </SettingsCard>
  );
};
