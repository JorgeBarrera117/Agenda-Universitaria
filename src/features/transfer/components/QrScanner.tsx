import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff, Loader2 } from 'lucide-react';

interface QrScannerProps {
  /** Texto leído del QR. Devuelve true si se acepta (se detiene la cámara) o false para seguir buscando. */
  onDetected: (text: string) => boolean;
}

type CameraState = 'starting' | 'running' | 'denied' | 'unavailable';

const SCAN_INTERVAL_MS = 120;
/** Los fotogramas se reducen a este tamaño antes de buscar el QR (más rápido, igual de fiable). */
const MAX_SCAN_SIDE = 720;

/**
 * Lector de códigos QR con la cámara trasera. Funciona sin internet: jsQR analiza los fotogramas
 * del video en el propio teléfono.
 */
export const QrScanner: React.FC<QrScannerProps> = ({ onDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [state, setState] = useState<CameraState>('starting');

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && context && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        const scale = Math.min(1, MAX_SCAN_SIDE / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (code?.data && onDetectedRef.current(code.data)) {
          stop();
          return;
        }
      }
      timer = window.setTimeout(scan, SCAN_INTERVAL_MS);
    };

    const stop = () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setState('running');
        scan();
      } catch (error: unknown) {
        if (stopped) return;
        const name = error instanceof DOMException ? error.name : '';
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      }
    };

    void startCamera();
    return stop;
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-3xl bg-black">
      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" aria-label="Vista de la cámara" />

      {state === 'running' && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
      )}

      {state !== 'running' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white">
          {state === 'starting' ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              Abriendo la cámara…
            </>
          ) : (
            <>
              <CameraOff className="h-6 w-6" aria-hidden="true" />
              {state === 'denied'
                ? 'La agenda no tiene permiso para usar la cámara. Actívalo en los ajustes del teléfono (Apps → Agenda Universitaria → Permisos).'
                : 'No se pudo abrir la cámara del teléfono.'}
            </>
          )}
        </div>
      )}
    </div>
  );
};
