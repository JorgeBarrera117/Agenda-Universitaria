import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

export interface VoiceRecording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

/** Barras del medidor de voz (historial de niveles 0-1, el más nuevo al final). */
export const LEVEL_BARS = 36;
/** Opus a 32 kbps: voz clara a ~0,25 MB por minuto (una clase de 2 h ≈ 30 MB). */
const AUDIO_BITS_PER_SECOND = 32_000;
/** Cada segundo se guarda un trozo: si el sistema corta la grabación, se conserva lo grabado. */
const CHUNK_MS = 1000;
const LEVEL_UPDATE_MS = 70;

/** Formatos en orden de preferencia (Android/Chrome/Windows graban WebM-Opus; Safari, MP4/AAC). */
const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];

function pickMimeType(): string | null {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return null;
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function describeError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Permite el uso del micrófono para grabar. En Android: Ajustes → Aplicaciones → Agenda Universitaria → Permisos → Micrófono.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró un micrófono en este dispositivo.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'El micrófono está ocupado por otra app. Ciérrala y vuelve a intentarlo.';
  return 'No se pudo iniciar la grabación.';
}

/**
 * Grabadora de notas de voz con MediaRecorder (funciona en Android, Windows y navegadores):
 * pausa/reanudación, tiempo transcurrido, nivel de voz en vivo (para dibujar el medidor) y la
 * pantalla encendida mientras graba (Wake Lock), para que Android no corte la grabación al
 * apagarse. Al desmontarse libera el micrófono.
 */
export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_BARS).fill(0));
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<VoiceRecording | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  /** Tiempo grabado antes de la última pausa y comienzo del tramo actual. */
  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef(0);
  const discardRef = useRef(false);

  const currentElapsed = () => accumulatedRef.current + (segmentStartRef.current ? performance.now() - segmentStartRef.current : 0);

  const releaseWakeLock = () => {
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  };

  const requestWakeLock = async () => {
    try {
      wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // Sin Wake Lock (o denegado): se graba igual, solo que la pantalla puede apagarse
    }
  };

  /** Suelta el micrófono, el analizador, los temporizadores y el bloqueo de pantalla. */
  const releaseResources = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    analyserRef.current = null;
    releaseWakeLock();
  }, []);

  // Medidor de voz: nivel RMS de la señal, ~14 veces por segundo
  const startMeter = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const samples = new Uint8Array(analyser.fftSize);
    let lastUpdate = 0;
    const loop = (time: number) => {
      frameRef.current = requestAnimationFrame(loop);
      if (time - lastUpdate < LEVEL_UPDATE_MS) return;
      lastUpdate = time;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const value = (sample - 128) / 128;
        sum += value * value;
      }
      // Curva para que la voz normal llene bien las barras
      const level = Math.min(1, Math.sqrt(sum / samples.length) * 3.2);
      setLevels((previous) => [...previous.slice(1), level]);
    };
    frameRef.current = requestAnimationFrame(loop);
  };

  const startTicker = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setElapsedMs(currentElapsed()), 250);
  };

  const start = useCallback(async () => {
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      setError('Este dispositivo no permite grabar audio desde la app.');
      setStatus('error');
      return;
    }
    setError(null);
    setRecording(null);
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext;
      if (AudioContextClass) {
        const context = new AudioContextClass();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        audioContextRef.current = context;
        analyserRef.current = analyser;
      }

      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
      chunksRef.current = [];
      discardRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      // También cuando el sistema detiene la grabación por su cuenta: lo grabado se conserva
      recorder.onstop = () => {
        const durationMs = currentElapsed();
        accumulatedRef.current = durationMs;
        segmentStartRef.current = 0;
        setElapsedMs(durationMs);
        releaseResources();
        if (discardRef.current) return;
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        setRecording(blob.size > 0 ? { blob, mimeType: type, durationMs } : null);
        setStatus(blob.size > 0 ? 'stopped' : 'idle');
      };
      recorderRef.current = recorder;
      accumulatedRef.current = 0;
      segmentStartRef.current = performance.now();
      setElapsedMs(0);
      setLevels(Array(LEVEL_BARS).fill(0));
      recorder.start(CHUNK_MS);
      setStatus('recording');
      startTicker();
      startMeter();
      void requestWakeLock();
    } catch (err) {
      releaseResources();
      setError(describeError(err));
      setStatus('error');
    }
    // releaseResources es estable; las funciones internas leen refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseResources]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.pause();
    accumulatedRef.current = currentElapsed();
    segmentStartRef.current = 0;
    setElapsedMs(accumulatedRef.current);
    cancelAnimationFrame(frameRef.current);
    setLevels(Array(LEVEL_BARS).fill(0));
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    recorder.resume();
    segmentStartRef.current = performance.now();
    startMeter();
    setStatus('recording');
    // startMeter solo usa refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  /** Descarta lo grabado (y detiene la grabación si seguía en curso). */
  const discard = useCallback(() => {
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    releaseResources();
    recorderRef.current = null;
    chunksRef.current = [];
    accumulatedRef.current = 0;
    segmentStartRef.current = 0;
    setRecording(null);
    setElapsedMs(0);
    setLevels(Array(LEVEL_BARS).fill(0));
    setError(null);
    setStatus('idle');
  }, [releaseResources]);

  // Volver a pedir la pantalla encendida al regresar a la app (el sistema la suelta al salir)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && recorderRef.current?.state === 'recording') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Al desmontar: detener sin guardar y liberar el micrófono
  useEffect(
    () => () => {
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      releaseResources();
    },
    [releaseResources]
  );

  return { status, elapsedMs, levels, error, recording, start, pause, resume, stop, discard };
}

/** "1:05" o "1:02:30". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}` : `${minutes}:${ss}`;
}
