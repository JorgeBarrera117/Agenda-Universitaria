import React, { useState } from 'react';
import { Calendar, CalendarRange, GraduationCap, Layers, Save } from 'lucide-react';
import { SegmentedControl, formInputClass, type SegmentedOption } from '../../../shared/components/form';
import { SettingsBlock, SettingsCard } from './SettingsPrimitives';
import type { AppSettings } from '../types';
import { NewSemesterWizardModal } from './NewSemesterWizardModal';

interface ScheduleSettingsProps {
  settings: AppSettings;
  semesterInput: string;
  onSemesterInputChange: (value: string) => void;
  onSaveSemester: () => void;
  onViewModeChange: (view: AppSettings['defaultScheduleView']) => void;
  onVisibleDaysChange: (days: AppSettings['visibleDays']) => void;
  onShowToast: (message: string) => void;
}

const VIEW_OPTIONS: SegmentedOption<AppSettings['defaultScheduleView']>[] = [
  { value: 'weekly', label: 'Semanal', icon: <Layers className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  { value: 'daily', label: 'Por día', icon: <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" /> },
];

const DAY_RANGE_OPTIONS: SegmentedOption<AppSettings['visibleDays']>[] = [
  { value: 'mon-fri', label: 'Lun - Vie' },
  { value: 'mon-sat', label: 'Lun - Sáb' },
  { value: 'all', label: 'Toda la semana', shortLabel: 'Todos' },
];

export const ScheduleSettings: React.FC<ScheduleSettingsProps> = ({
  settings,
  semesterInput,
  onSemesterInputChange,
  onSaveSemester,
  onViewModeChange,
  onVisibleDaysChange,
  onShowToast,
}) => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const hasChanges = semesterInput.trim() !== '' && semesterInput.trim() !== settings.semesterName;

  return (
    <SettingsCard>
      <SettingsBlock
        title="Periodo lectivo actual"
        description="Aparece en tu credencial y en la cabecera del horario."
        icon={<CalendarRange className="h-4 w-4" aria-hidden="true" />}
      >
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveSemester();
          }}
        >
          <label htmlFor="settings-semester" className="sr-only">
            Periodo lectivo actual
          </label>
          <input
            id="settings-semester"
            type="text"
            value={semesterInput}
            onChange={(e) => onSemesterInputChange(e.target.value)}
            placeholder="ej. Semestre 2026-I"
            className={`${formInputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={!hasChanges}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-md-primary)] px-4 text-xs font-bold text-[var(--color-md-on-primary)] shadow-2xs transition-all duration-150 ease-out hover:bg-[var(--color-md-primary-hover)] active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Guardar
          </button>
        </form>
      </SettingsBlock>

      {/* Cierre del semestre: abre el asistente (respaldo → nuevo nombre → opciones) */}
      <SettingsBlock
        title="Transición de ciclo académico"
        description="¿Terminaste el semestre? Archiva las materias cursadas, conserva todos tus apuntes y prepara tu horario para el nuevo período."
        icon={<GraduationCap className="h-4 w-4" aria-hidden="true" />}
      >
        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-md-primary)] bg-[var(--color-md-primary-container)] px-4 text-sm font-bold text-[var(--color-md-on-primary-container)] shadow-2xs transition-all duration-150 ease-out hover:bg-[var(--color-md-secondary-container)] active:scale-[0.98]"
        >
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          Finalizar semestre actual
        </button>
      </SettingsBlock>

      {/* Se monta solo al abrirse: cada vez empieza desde el paso 1 */}
      {isWizardOpen && (
        <NewSemesterWizardModal
          isOpen
          onClose={() => setIsWizardOpen(false)}
          onCompleted={() => {
            setIsWizardOpen(false);
            onShowToast('¡Bienvenido al nuevo ciclo lectivo! Tu horario está listo.');
          }}
        />
      )}

      <SettingsBlock title="Vista predeterminada" description="Cómo se abre el horario al iniciar la app.">
        <SegmentedControl
          value={settings.defaultScheduleView}
          onChange={onViewModeChange}
          options={VIEW_OPTIONS}
          ariaLabel="Vista predeterminada del horario"
        />
      </SettingsBlock>

      <SettingsBlock title="Días visibles" description="Los días con clases se muestran siempre, aunque queden fuera del rango.">
        <SegmentedControl
          value={settings.visibleDays}
          onChange={onVisibleDaysChange}
          options={DAY_RANGE_OPTIONS}
          ariaLabel="Días visibles en el horario"
        />
      </SettingsBlock>
    </SettingsCard>
  );
};
