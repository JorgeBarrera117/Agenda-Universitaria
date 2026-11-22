import React, { useCallback, useEffect, useState } from 'react';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { NotificationService } from '../../../shared/services/notificationService';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { studyRepository } from '../repositories/studyRepository';
import { getStudyTimerState, phaseDurationMs, studyTimer, useStudyTimer } from '../state/studyTimerStore';
import { StudyTimerScreen } from './StudyTimerScreen';

/**
 * Siempre montado (en App): vigila el temporizador del modo estudio aunque su pantalla esté cerrada.
 * Al terminar una fase guarda lo estudiado, suena el tono elegido en Ajustes, vibra y avisa; en
 * Android además deja programado un aviso del sistema por si la app está en segundo plano.
 */
export const StudyTimerHost: React.FC = () => {
  const timer = useStudyTimer();
  const { settings } = useAppSettings();
  const { subjects } = useSubjects();
  const [message, setMessage] = useState<string | null>(null);

  const saveFocus = useCallback((minutes: number, startedAt: string | null, subjectId: string | undefined) => {
    if (minutes < 1 || !startedAt) return;
    void studyRepository.add({ subjectId, startedAt, minutes });
  }, []);

  // Fin de fase: se comprueba con la hora de fin (también al volver de segundo plano)
  useEffect(() => {
    if (!timer.running || timer.endsAt === null) return;
    const check = () => {
      const current = getStudyTimerState();
      if (!current.running || current.endsAt === null || Date.now() < current.endsAt) return;
      const subjectId = current.subjectId;
      const { finished, focusMinutes, startedAt } = studyTimer.advance(true);
      const tone = { notificationTone: settings.notificationTone, notificationSound: settings.notificationSound };
      NotificationService.playTone(tone);
      navigator.vibrate?.([250, 120, 250]);
      if (finished === 'focus') {
        saveFocus(focusMinutes, startedAt, subjectId);
        const next = getStudyTimerState();
        const breakMin = Math.round(phaseDurationMs('break', next.presetId, next.focusCount) / 60_000);
        setMessage(`¡Sesión terminada! Descansa ${breakMin} min.`);
      } else {
        setMessage('Se acabó el descanso: ¿otra sesión?');
      }
    };
    check();
    const id = window.setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [timer.running, timer.endsAt, settings.notificationTone, settings.notificationSound, saveFocus]);

  // Aviso del sistema (Android) para cuando termine la fase en curso
  useEffect(() => {
    const tone = { notificationTone: settings.notificationTone, notificationSound: settings.notificationSound };
    if (!timer.running || timer.endsAt === null) {
      void NotificationService.setStudyAlarm(null, '', '', tone);
      return;
    }
    const subjectName = subjects.find((s) => s.id === timer.subjectId)?.name;
    const isFocus = timer.phase === 'focus';
    void NotificationService.setStudyAlarm(
      new Date(timer.endsAt),
      isFocus ? '¡Sesión de estudio terminada!' : 'Se acabó el descanso',
      isFocus ? `${subjectName ? `${subjectName} · ` : ''}Toma un descanso.` : 'Vuelve a la app para empezar la siguiente sesión.',
      tone
    );
  }, [timer.running, timer.endsAt, timer.phase, timer.subjectId, subjects, settings.notificationTone, settings.notificationSound]);

  return (
    <>
      <ContextualToast message={message} variant="success" bottomOffset="nav" onClose={() => setMessage(null)} />
      {timer.isOpen && (
        <StudyTimerScreen onFocusInterrupted={(minutes, startedAt) => saveFocus(minutes, startedAt, getStudyTimerState().subjectId)} />
      )}
    </>
  );
};
