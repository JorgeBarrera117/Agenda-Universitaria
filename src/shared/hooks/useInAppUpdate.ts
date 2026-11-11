import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  InstallPermissionError,
  downloadUpdateInApp,
  hasInstallPermission,
  installDownloadedUpdate,
  openInstallPermissionSettings,
  type UpdateInfo,
} from '../services/updateService';

export type InAppUpdateState =
  | { phase: 'idle' }
  | { phase: 'downloading'; percent: number | null }
  /** Descargado y verificado, pero Android aún no deja que la app instale. */
  | { phase: 'needs-permission' }
  /** Se abrió el instalador de Android (si el usuario lo cierra, puede volver a abrirlo). */
  | { phase: 'installer-opened' }
  | { phase: 'error'; message: string };

/**
 * Actualización dentro de la app (Android): descarga con progreso → permiso de instalación si
 * falta → instalador del sistema. Al volver de los ajustes de Android tras conceder el permiso,
 * la instalación continúa sola (evento "resume" de la app).
 */
export function useInAppUpdate() {
  const [state, setState] = useState<InAppUpdateState>({ phase: 'idle' });
  const resumeHandleRef = useRef<PluginListenerHandle | null>(null);

  const clearResumeListener = useCallback(() => {
    void resumeHandleRef.current?.remove();
    resumeHandleRef.current = null;
  }, []);

  useEffect(() => clearResumeListener, [clearResumeListener]);

  const tryInstall = useCallback(async () => {
    try {
      if (!(await hasInstallPermission())) {
        setState({ phase: 'needs-permission' });
        return;
      }
      await installDownloadedUpdate();
      setState({ phase: 'installer-opened' });
    } catch (err) {
      if (err instanceof InstallPermissionError) {
        setState({ phase: 'needs-permission' });
        return;
      }
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'No se pudo abrir el instalador.' });
    }
  }, []);

  const start = useCallback(
    async (info: UpdateInfo) => {
      setState({ phase: 'downloading', percent: 0 });
      try {
        await downloadUpdateInApp(info, (percent) => setState({ phase: 'downloading', percent }));
      } catch (err) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : 'No se pudo descargar la actualización.',
        });
        return;
      }
      await tryInstall();
    },
    [tryInstall]
  );

  /** Abre los ajustes de Android; al volver a la app se reintenta la instalación. */
  const grantPermission = useCallback(async () => {
    clearResumeListener();
    resumeHandleRef.current = await App.addListener('resume', () => {
      clearResumeListener();
      void tryInstall();
    });
    try {
      await openInstallPermissionSettings();
    } catch (err) {
      clearResumeListener();
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'No se pudieron abrir los ajustes.' });
    }
  }, [clearResumeListener, tryInstall]);

  return { state, start, grantPermission, reopenInstaller: tryInstall };
}
