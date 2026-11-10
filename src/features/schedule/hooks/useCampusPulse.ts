import { useEffect, useMemo, useState } from 'react';
import type { DayOfWeek, ScheduleSlot } from '../types';
import type { Subject } from '../../subjects/types';
import type { Professor } from '../../professors/types';
import { describeSlotLocation, isSlotVirtual } from '../utils/slotModality';

export interface PulseClass {
  slot: ScheduleSlot;
  subject?: Subject;
  professor?: Professor;
  isVirtual: boolean;
  /** Aula/edificio o plataforma virtual; null si el bloque no tiene ubicación. */
  location: string | null;
}

export interface CurrentClassPulse extends PulseClass {
  /** Porcentaje transcurrido de la clase, de 0 a 100. */
  progressPercent: number;
  minutesRemaining: number;
}

export interface NextClassPulse extends PulseClass {
  dayOfWeek: DayOfWeek;
  /** 0 = hoy, 1 = mañana, 2+ = otro día de la semana. */
  daysAhead: number;
  minutesUntilStart: number;
}

export interface DaySummary {
  totalToday: number;
  completedToday: number;
  virtualToday: number;
  hasVirtual: boolean;
}

export interface CampusPulse {
  todayDayOfWeek: DayOfWeek;
  /** Hora actual "HH:mm", la misma referencia que usan las tarjetas para marcar "EN CURSO". */
  nowTimeString: string;
  currentClass: CurrentClassPulse | null;
  nextClass: NextClassPulse | null;
  daySummary: DaySummary;
  /** Sin clase en curso: hora libre entre clases o jornada sin actividad. */
  isFreeTime: boolean;
  /** Hoy había clases y ya terminaron todas. */
  isDayFinished: boolean;
}

const MINUTES_PER_DAY = 24 * 60;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function toDayOfWeek(date: Date): DayOfWeek {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as DayOfWeek;
}

function shiftDay(day: DayOfWeek, offset: number): DayOfWeek {
  return ((((day - 1 + offset) % 7) + 7) % 7 + 1) as DayOfWeek;
}

function byStartTime(a: ScheduleSlot, b: ScheduleSlot): number {
  return a.startTime.localeCompare(b.startTime);
}

/** Cálculo puro del pulso del campus para un instante dado (sin efectos ni dependencia del reloj). */
export function computeCampusPulse(
  now: Date,
  slots: ScheduleSlot[],
  subjects: Subject[],
  professors: Professor[]
): CampusPulse {
  const todayDayOfWeek = toDayOfWeek(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const professorById = new Map(professors.map((p) => [p.id, p]));

  const describe = (slot: ScheduleSlot): PulseClass => {
    const subject = subjectById.get(slot.subjectId);
    // El docente del bloque tiene prioridad; si no hay, se usa el titular de la materia.
    const professorId = slot.professorId || subject?.professorId;
    return {
      slot,
      subject,
      professor: professorId ? professorById.get(professorId) : undefined,
      isVirtual: isSlotVirtual(slot),
      location: describeSlotLocation(slot),
    };
  };

  const todaySlots = slots.filter((s) => s.dayOfWeek === todayDayOfWeek).sort(byStartTime);

  const current = todaySlots.find(
    (s) => toMinutes(s.startTime) <= nowMinutes && nowMinutes < toMinutes(s.endTime)
  );

  let currentClass: CurrentClassPulse | null = null;
  if (current) {
    const start = toMinutes(current.startTime);
    const end = toMinutes(current.endTime);
    const duration = Math.max(1, end - start);
    currentClass = {
      ...describe(current),
      progressPercent: Math.min(100, Math.max(0, Math.round(((nowMinutes - start) / duration) * 100))),
      minutesRemaining: Math.max(0, end - nowMinutes),
    };
  }

  // Próxima clase: la siguiente de hoy o, si ya no quedan, la primera de los días siguientes.
  let nextClass: NextClassPulse | null = null;
  const laterToday = todaySlots.find((s) => toMinutes(s.startTime) > nowMinutes);
  if (laterToday) {
    nextClass = {
      ...describe(laterToday),
      dayOfWeek: todayDayOfWeek,
      daysAhead: 0,
      minutesUntilStart: toMinutes(laterToday.startTime) - nowMinutes,
    };
  } else {
    for (let offset = 1; offset <= 7 && !nextClass; offset++) {
      const day = shiftDay(todayDayOfWeek, offset);
      const first = slots.filter((s) => s.dayOfWeek === day).sort(byStartTime)[0];
      if (first) {
        nextClass = {
          ...describe(first),
          dayOfWeek: day,
          daysAhead: offset,
          minutesUntilStart: offset * MINUTES_PER_DAY - nowMinutes + toMinutes(first.startTime),
        };
      }
    }
  }

  const virtualToday = todaySlots.filter((s) => isSlotVirtual(s)).length;
  const daySummary: DaySummary = {
    totalToday: todaySlots.length,
    completedToday: todaySlots.filter((s) => toMinutes(s.endTime) <= nowMinutes).length,
    virtualToday,
    hasVirtual: virtualToday > 0,
  };

  return {
    todayDayOfWeek,
    nowTimeString,
    currentClass,
    nextClass,
    daySummary,
    isFreeTime: currentClass === null,
    isDayFinished: daySummary.totalToday > 0 && daySummary.completedToday === daySummary.totalToday,
  };
}

/** Reloj que avanza al inicio de cada minuto y se resincroniza al volver la app a primer plano. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(new Date());
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const align = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, msToNextMinute);

    // En Android/Electron los temporizadores se pausan en segundo plano
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return now;
}

/**
 * Estado en tiempo real de la jornada: clase en curso, próxima clase y resumen del día.
 * Se recalcula cada minuto o cuando cambian los horarios, materias o docentes.
 */
export function useCampusPulse(
  slots: ScheduleSlot[],
  subjects: Subject[],
  professors: Professor[]
): CampusPulse {
  const now = useMinuteClock();
  return useMemo(
    () => computeCampusPulse(now, slots, subjects, professors),
    [now, slots, subjects, professors]
  );
}
