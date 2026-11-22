import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { NotificationService, sectionTones } from '../../../shared/services/notificationService';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { studyRepository } from '../repositories/studyRepository';
import { getStudyTimerState, studyTimer, useStudyTimer } from '../state/studyTimerStore';
import { hasNativeStudyTimer, studyNativeTimer, toNativeState } from '../services/studyNativeTimer';
import type { StudyPhase } from '../types';

const FALLBACK_COLOR = '#00639B';

/**
 * Siempre montado (en App): vigila el temporizador del modo estudio aunque se esté en otra pestaña.
 * - Al terminar una fase guarda lo estudiado, avisa con un mensaje, vibra y suena el tono de esa
 *   fase (Ajustes → Sonidos): «empezar», «pausa» y «volver a estudiar».
 * - En Android mantiene la notificación en curso (cuenta regresiva con Pausar y Detener). Lo que
 *   se toque ahí con la app cerrada llega como eventos y se aplica al volver, en orden.
 */
export const StudyTimerHost: React.FC = () => {
  const timer = useStudyTimer();
  const { settings } = useAppSettings();
  const { subjects } = useSubjects();
  const [message, setMessage] = useState<string | null>(null);
  // En Android, no se manda nada a la notificación hasta aplicar lo que pasó con la app cerrada
  const nativeReadyRef = useRef(!hasNativeStudyTimer);
  const tones = sectionTones(settings);
  const soundOn = settings.notificationSound;

  const saveFocus = useCallback((minutes: number, startedAt: string | null, subjectId: string | undefined) => {
    if (minutes < 1 || !startedAt) return;
    void studyRepository.add({ subjectId, startedAt, minutes });
  }, []);

  const announce = useCallback((finished: StudyPhase) => {
    const next = getStudyTimerState();
    if (finished === 'focus') {
      const breakMin = Math.round(next.phaseTotalMs / 60_000);
      setMessage(
        next.running
          ? `¡Hora de una pausa! Descansa ${breakMin} min: levántate y toma agua.`
          : `¡Sesión terminada! Toca ▶ para empezar tu pausa de ${breakMin} min.`
      );
    } else {
      setMessage(next.running ? 'Se acabó la pausa: ¡nueva sesión en marcha!' : 'Se acabó la pausa: ¡a estudiar! Toca ▶ para la siguiente sesión.');
    }
  }, []);

  /**
   * Termina las fases cuya hora de fin ya pasó (en orden, cada una en su hora exacta). Con
   * `withSound`, suena el tono de la última; sin él (lo hizo la notificación), solo avisa.
   */
  const catchUp = useCallback(
    (until: number, withSound: boolean, withMessage = true) => {
      let current = getStudyTimerState();
      let last: StudyPhase | null = null;
      // Con los dos auto-inicios encendidos podrían encadenarse muchas fases tras días cerrada: tope
      let guard = 0;
      while (current.running && current.endsAt !== null && current.endsAt <= until && guard < 200) {
        guard += 1;
        const end = current.endsAt;
        const subjectId = current.subjectId;
        const { finished, focusMinutes, startedAt } = studyTimer.advance(true, end);
        if (finished === 'focus') saveFocus(focusMinutes, startedAt, subjectId);
        last = finished;
        current = getStudyTimerState();
      }
      if (last === null) return;
      if (withSound) {
        NotificationService.playToneId(last === 'focus' ? tones.studyBreak : tones.studyResume, soundOn);
        navigator.vibrate?.([250, 120, 250]);
      }
      if (withMessage) announce(last);
    },
    [saveFocus, announce, tones.studyBreak, tones.studyResume, soundOn]
  );

  /** Aplica lo que se tocó en la notificación (o la alarma) mientras la app no estaba. */
  const applyNativeEvents = useCallback(async () => {
    const events = await studyNativeTimer.consumeEvents().catch(() => []);
    for (const event of events) {
      catchUp(event.at, false, false);
      if (event.type === 'pause') studyTimer.pause(event.at);
      else if (event.type === 'resume') studyTimer.start(event.at);
      else if (event.type === 'stop') {
        const subjectId = getStudyTimerState().subjectId;
        const { focusMinutes, startedAt } = studyTimer.reset(event.at);
        saveFocus(focusMinutes, startedAt, subjectId);
      }
    }
    // Lo que terminó sin evento (la notificación ya sonó): al día, sin repetir el sonido
    catchUp(Date.now(), false, events.some((e) => e.type === 'phaseEnd'));
  }, [catchUp, saveFocus]);

  // Android: la notificación en curso refleja siempre el estado del temporizador
  const subject = subjects.find((s) => s.id === timer.subjectId);
  const pushNative = useCallback(() => {
    if (!hasNativeStudyTimer || !nativeReadyRef.current) return;
    void studyNativeTimer
      .sync(
        toNativeState(getStudyTimerState(), {
          subject: subject?.name ?? '',
          color: subject?.color ?? FALLBACK_COLOR,
          breakTone: tones.studyBreak,
          resumeTone: tones.studyResume,
          soundOn,
        })
      )
      .catch(() => undefined);
  }, [subject?.name, subject?.color, tones.studyBreak, tones.studyResume, soundOn]);
  const pushNativeRef = useRef(pushNative);
  useEffect(() => {
    pushNativeRef.current = pushNative;
    pushNative();
  }, [timer, pushNative]);

  // Android: primero ponerse al día con la notificación; después, escuchar sus botones
  useEffect(() => {
    if (!hasNativeStudyTimer) return;
    let handle: { remove: () => Promise<void> } | null = null;
    // Asíncrono: primero lee los eventos guardados y recién después manda el estado
    void Promise.resolve()
      .then(applyNativeEvents)
      .finally(() => {
        nativeReadyRef.current = true;
        pushNativeRef.current();
      });
    void studyNativeTimer.onEvent(() => void applyNativeEvents()).then((h) => {
      handle = h;
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void applyNativeEvents();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void handle?.remove();
    };
  }, [applyNativeEvents]);

  // Fin de fase con la app abierta: se comprueba con la hora de fin, cada segundo
  useEffect(() => {
    if (!timer.running || timer.endsAt === null) return;
    const check = () => {
      if (document.visibilityState === 'visible' || !hasNativeStudyTimer) catchUp(Date.now(), true);
    };
    check();
    const id = window.setInterval(check, 1000);
    return () => window.clearInterval(id);
  }, [timer.running, timer.endsAt, catchUp]);

  // Sonido al empezar una sesión nueva (no al reanudar una pausa)
  const prevRef = useRef(timer);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = timer;
    const freshStart = !prev.running && timer.running && timer.phase === 'focus' && timer.focusElapsedMs === 0 && prev.phase === 'focus';
    if (freshStart && timer.endsAt !== null && timer.endsAt - Date.now() > 5_000) {
      NotificationService.playToneId(tones.studyStart, soundOn);
    }
  }, [timer, tones.studyStart, soundOn]);


  return <ContextualToast message={message} variant="success" bottomOffset="nav" durationMs={6000} onClose={() => setMessage(null)} />;
};
