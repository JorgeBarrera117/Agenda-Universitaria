import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Plus, Sun, X } from 'lucide-react';
import { useAgenda } from '../hooks/useAgenda';
import { useTodayKey } from '../hooks/useTodayKey';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useSchedule } from '../../schedule/hooks/useSchedule';
import { useAppSettings } from '../../settings/hooks/useAppSettings';
import { AGENDA_TYPE_LABEL, type AgendaEvent, type AgendaEventType, type CreateAgendaEventDTO } from '../types';
import { addDaysToKey, eventCoversDay, fromDateKey, holidayOn, longDayLabel, scheduleWeekday } from '../utils/agendaDates';
import { MonthCalendar } from './MonthCalendar';
import { AgendaEventCard } from './AgendaEventCard';
import { AgendaEventForm } from './AgendaEventForm';
import { DraggableFAB } from '../../../shared/components/DraggableFAB';
import { ContextualToast } from '../../../shared/components/ContextualToast';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { HEADER_SCRIM_CLASS } from '../../../shared/styles/surfaces';
import { formatTimeRange } from '../../../shared/utils/timeFormat';

/** Pedido desde otra pestaña (p. ej. "Próximos" en Horario): abrir la agenda en un día. */
export interface AgendaFocusRequest {
  day: string;
  nonce: number;
}

interface AgendaViewProps {
  focusRequest?: AgendaFocusRequest | null;
  onEditorActiveChange?: (isActive: boolean) => void;
  isActive?: boolean;
}

type Filter = 'all' | AgendaEventType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'task', label: 'Tareas' },
  { value: 'exam', label: 'Exámenes' },
  { value: 'reminder', label: 'Recordatorios' },
  { value: 'holiday', label: 'Días libres' },
];

const CALENDAR_OPEN_KEY = 'agenda_calendar_open_v1';

function readCalendarOpen(): boolean {
  try {
    return localStorage.getItem(CALENDAR_OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

interface Group {
  key: string;
  label: string;
  danger?: boolean;
  events: AgendaEvent[];
}

/**
 * Agenda: calendario del mes plegable, filtros por tipo y la lista agrupada por cuándo
 * (Vencidas, Hoy, Mañana, Próximos 7 días, Más adelante). Al tocar un día se ven sus clases (del
 * horario) y lo que tiene en la agenda.
 */
export const AgendaView: React.FC<AgendaViewProps> = ({ focusRequest, onEditorActiveChange, isActive = true }) => {
  const { events, addEvent, updateEvent, setDone, removeEvent } = useAgenda();
  const { subjects } = useSubjects();
  const { slots } = useSchedule();
  const { settings } = useAppSettings();
  const todayKey = useTodayKey();

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = fromDateKey(todayKey);
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(readCalendarOpen);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showDone, setShowDone] = useState(false);
  const [formState, setFormState] = useState<{ event?: AgendaEvent; defaultDate: string } | null>(null);
  const [toDelete, setToDelete] = useState<AgendaEvent | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const showToast = useCallback((text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text })), []);

  // Pedido de otra pestaña: se atiende durante el render al cambiar el nonce (sin efectos)
  const [seenFocusNonce, setSeenFocusNonce] = useState<number | null>(null);
  if (focusRequest && focusRequest.nonce !== seenFocusNonce) {
    setSeenFocusNonce(focusRequest.nonce);
    setSelectedDay(focusRequest.day);
    const date = fromDateKey(focusRequest.day);
    setVisibleMonth({ year: date.getFullYear(), month: date.getMonth() });
    setFilter('all');
  }

  const isFormOpen = formState !== null;
  useEffect(() => {
    onEditorActiveChange?.(isFormOpen);
    return () => onEditorActiveChange?.(false);
  }, [isFormOpen, onEditorActiveChange]);

  const toggleCalendar = () => {
    setIsCalendarOpen((open) => {
      try {
        localStorage.setItem(CALENDAR_OPEN_KEY, open ? '0' : '1');
      } catch {
        // Sin almacenamiento: se recuerda solo en esta sesión
      }
      return !open;
    });
  };

  const changeMonth = (delta: number) =>
    setVisibleMonth(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const goToday = () => {
    const today = fromDateKey(todayKey);
    setVisibleMonth({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDay(todayKey);
  };

  const selectDay = (key: string) => setSelectedDay((current) => (current === key ? null : key));

  const filtered = useMemo(() => (filter === 'all' ? events : events.filter((e) => e.type === filter)), [events, filter]);

  const { groups, doneCount } = useMemo(() => {
    const doneList = filtered.filter((e) => e.done);
    if (selectedDay) {
      const dayEvents = filtered.filter((e) => eventCoversDay(e, selectedDay));
      return {
        groups: dayEvents.length ? [{ key: 'day', label: 'En tu agenda', events: dayEvents }] : [],
        doneCount: 0,
      };
    }
    if (filter === 'holiday') {
      const upcoming = filtered.filter((e) => (e.endDate ?? e.date) >= todayKey);
      const past = filtered.filter((e) => (e.endDate ?? e.date) < todayKey).reverse();
      const result: Group[] = [];
      if (upcoming.length) result.push({ key: 'next', label: 'Próximos días libres', events: upcoming });
      if (past.length) result.push({ key: 'past', label: 'Ya pasaron', events: past });
      return { groups: result, doneCount: 0 };
    }
    const tomorrow = addDaysToKey(todayKey, 1);
    const weekEnd = addDaysToKey(todayKey, 7);
    // Pendiente = no hecho; lo pasado que no es una tarea (un examen de ayer) ya no se lista
    const pending = filtered.filter((e) => !e.done);
    const result: Group[] = [
      { key: 'overdue', label: 'Vencidas', danger: true, events: pending.filter((e) => e.type === 'task' && e.date < todayKey) },
      { key: 'today', label: 'Hoy', events: pending.filter((e) => eventCoversDay(e, todayKey) && !(e.type === 'task' && e.date < todayKey)) },
      { key: 'tomorrow', label: 'Mañana', events: pending.filter((e) => e.date === tomorrow) },
      { key: 'week', label: 'Próximos 7 días', events: pending.filter((e) => e.date > tomorrow && e.date <= weekEnd) },
      { key: 'later', label: 'Más adelante', events: pending.filter((e) => e.date > weekEnd) },
    ];
    if (showDone && doneList.length) result.push({ key: 'done', label: 'Hechas', events: doneList });
    return { groups: result.filter((g) => g.events.length > 0), doneCount: doneList.length };
  }, [filtered, selectedDay, filter, todayKey, showDone]);

  const selectedHoliday = selectedDay ? holidayOn(events, selectedDay) : undefined;
  const selectedClasses = useMemo(() => {
    if (!selectedDay || selectedHoliday) return [];
    const weekday = scheduleWeekday(selectedDay);
    return slots
      .filter((slot) => slot.dayOfWeek === weekday)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((slot) => ({ slot, subject: subjects.find((s) => s.id === slot.subjectId) }));
  }, [selectedDay, selectedHoliday, slots, subjects]);

  const pendingToday = events.filter(
    (e) => !e.done && e.type !== 'holiday' && ((e.type === 'task' && e.date < todayKey) || e.date === todayKey)
  ).length;

  const openCreate = useCallback(
    (date?: string) => setFormState({ defaultDate: date ?? selectedDay ?? todayKey }),
    [selectedDay, todayKey]
  );
  const openEdit = useCallback((event: AgendaEvent) => setFormState({ event, defaultDate: event.date }), []);
  const toggleDone = useCallback(
    (event: AgendaEvent) => {
      void setDone(event.id, !event.done).then(() => {
        if (!event.done) showToast(`«${event.title}» marcada como hecha.`);
      });
    },
    [setDone, showToast]
  );

  const handleSubmit = async (data: CreateAgendaEventDTO) => {
    const editing = formState?.event;
    if (editing) await updateEvent(editing.id, data);
    else await addEvent(data);
    setFormState(null);
    setSelectedDay(data.date);
    const date = fromDateKey(data.date);
    setVisibleMonth({ year: date.getFullYear(), month: date.getMonth() });
    showToast(editing ? 'Cambios guardados.' : `${AGENDA_TYPE_LABEL[data.type]} guardado en la agenda.`);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await removeEvent(toDelete.id);
    showToast(`«${toDelete.title}» se eliminó.`);
    setToDelete(null);
  };

  if (formState) {
    return (
      <div className="w-full pb-8">
        <ErrorBoundary fallbackTitle="Error al abrir el formulario de la agenda" onReset={() => setFormState(null)}>
          <AgendaEventForm
            initialData={formState.event}
            defaultDate={formState.defaultDate}
            subjects={subjects}
            notificationsEnabled={settings.notificationsEnabled}
            onSubmit={handleSubmit}
            onCancel={() => setFormState(null)}
          />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3.5">
      <ContextualToast message={toast?.text ?? null} bottomOffset="nav" onClose={() => setToast(null)} />

      {/* Cabecera */}
      <div className={`flex flex-wrap items-center justify-between gap-2 ${HEADER_SCRIM_CLASS}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-[var(--color-md-on-surface)] sm:text-xl">Agenda</h2>
            {pendingToday > 0 && (
              <span className="rounded-full bg-[#FFDAD6] px-2 py-0.5 text-xs font-bold text-[#410002] dark:bg-[#93000A] dark:text-[#FFDAD6]">
                {pendingToday} para hoy o vencidas
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-md-on-surface-variant)] sm:text-13px">
            Tareas, exámenes, recordatorios y días libres, con tus clases de cada día.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="hidden h-10 items-center gap-2 rounded-2xl bg-[var(--color-md-primary)] px-4 text-sm font-bold text-[var(--color-md-on-primary)] shadow-xs transition-transform active:scale-[0.98] md:flex"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo
        </button>
      </div>

      {/* En PC: calendario a la izquierda y lista a la derecha; en el teléfono, uno debajo del otro */}
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-24 lg:w-[400px] lg:shrink-0">
          <MonthCalendar
            year={visibleMonth.year}
            month={visibleMonth.month}
            todayKey={todayKey}
            selectedKey={selectedDay}
            events={events}
            subjects={subjects}
            isOpen={isCalendarOpen}
            onToggleOpen={toggleCalendar}
            onChangeMonth={changeMonth}
            onGoToday={goToday}
            onSelectDay={selectDay}
          />

          {/* Día elegido: sus clases del horario */}
          {selectedDay && (
            <section className="md-card space-y-2.5 rounded-[24px] border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-3.5">
              <div className="flex items-center gap-2">
                <h3 className="min-w-0 flex-1 text-base font-bold text-[var(--color-md-on-surface)]">{longDayLabel(selectedDay)}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--color-md-outline-variant)] px-3 text-xs font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-primary)]/10"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Ver todo
                </button>
              </div>
              {selectedHoliday ? (
                <p className="flex items-center gap-2 rounded-2xl bg-[#FFDAD6] px-3 py-2.5 text-13px text-[#410002] dark:bg-[#93000A]/60 dark:text-[#FFDAD6]">
                  <Sun className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {selectedHoliday.title}: ese día no te avisamos de tus clases.
                </p>
              ) : (
                <>
                  <p className="text-11px font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">Clases</p>
                  {selectedClasses.length === 0 ? (
                    <p className="text-13px text-[var(--color-md-on-surface-variant)]">Sin clases este día.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedClasses.map(({ slot, subject }) => (
                        <li
                          key={slot.id}
                          className="card-tinted md-card flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
                          style={{ '--card-tint': subject?.color ?? '#00639B' } as React.CSSProperties}
                        >
                          <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: subject?.color ?? '#00639B' }} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{subject?.name ?? 'Clase'}</span>
                            <span className="block text-xs text-[var(--color-md-on-surface-variant)]">
                              {formatTimeRange(slot.startTime, slot.endTime, settings.timeFormat)}
                              {slot.classroom ? ` · ${slot.classroom}` : ''}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => openCreate(selectedDay)}
                className="flex h-10 items-center gap-2 rounded-full bg-[var(--color-md-secondary-container)] px-4 text-13px font-bold text-[var(--color-md-on-secondary-container)] transition-transform active:scale-[0.98]"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Agregar en este día
              </button>
            </section>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3.5">
          {/* Filtros por tipo */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filtrar por tipo">
            {FILTERS.map((option) => {
              const selected = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(option.value)}
                  className={`h-9 shrink-0 rounded-lg px-3 text-13px font-bold transition-colors ${
                    selected
                      ? 'bg-[var(--color-md-secondary-container)] text-[var(--color-md-on-secondary-container)]'
                      : 'border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] text-[var(--color-md-on-surface-variant)] hover:bg-[var(--color-md-surface-container-high)]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {groups.length === 0 ? (
            <div className="md-card rounded-[24px] border border-dashed border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] px-5 py-10 text-center">
              <p className="text-sm font-bold text-[var(--color-md-on-surface)]">
                {selectedDay ? 'Nada en la agenda este día' : events.length === 0 ? 'Tu agenda está vacía' : 'Nada pendiente con este filtro'}
              </p>
              <p className="mt-1 text-xs text-[var(--color-md-on-surface-variant)]">
                Agrega tareas, exámenes, recordatorios o días libres; te avisamos a tiempo.
              </p>
              <button
                type="button"
                onClick={() => openCreate(selectedDay ?? undefined)}
                className="mx-auto mt-4 flex h-10 items-center gap-2 rounded-full bg-[var(--color-md-primary)] px-5 text-13px font-bold text-[var(--color-md-on-primary)]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Agregar
              </button>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.key} className="space-y-2.5" aria-label={group.label}>
                <h3
                  className={`px-1 text-sm font-bold ${
                    group.danger ? 'text-[#BA1A1A] dark:text-[#FFB4AB]' : 'text-[var(--color-md-on-surface)]'
                  }`}
                >
                  {group.label} <span className="font-medium text-[var(--color-md-on-surface-variant)]">· {group.events.length}</span>
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:gap-3 xl:grid-cols-2">
                  {group.events.map((event) => (
                    <AgendaEventCard
                      key={event.id}
                      event={event}
                      subjects={subjects}
                      todayKey={todayKey}
                      onEdit={openEdit}
                      onDelete={setToDelete}
                      onToggleDone={toggleDone}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {!selectedDay && filter !== 'holiday' && doneCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="h-10 rounded-full border border-[var(--color-md-outline-variant)] px-4 text-13px font-bold text-[var(--color-md-on-surface-variant)] transition-colors hover:bg-[var(--color-md-surface-container-high)]"
            >
              {showDone ? 'Ocultar hechas' : `Mostrar hechas (${doneCount})`}
            </button>
          )}
        </div>
      </div>

      <Modal isOpen={toDelete !== null} onClose={() => setToDelete(null)} title="¿Eliminar de la agenda?" maxWidth="sm">
        <p className="text-sm text-[var(--color-md-on-surface-variant)]">
          Se eliminará «{toDelete?.title}» y su aviso. No se puede deshacer.
        </p>
        <ModalActions>
          <button
            type="button"
            onClick={() => setToDelete(null)}
            className="h-10 rounded-full px-4 text-sm font-bold text-[var(--color-md-primary)] hover:bg-[var(--color-md-primary)]/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirmDelete()}
            className="h-10 rounded-full bg-[#BA1A1A] px-5 text-sm font-bold text-white hover:bg-[#93000A]"
          >
            Eliminar
          </button>
        </ModalActions>
      </Modal>

      {isActive && (
        <DraggableFAB onClick={() => openCreate()} label="Nuevo en la agenda" icon={<Plus className="h-6 w-6 stroke-[2.2]" />} />
      )}
    </div>
  );
};
