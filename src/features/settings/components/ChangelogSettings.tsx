import React from 'react';
import { ChevronRight, ScrollText } from 'lucide-react';
import { ChangelogEntryCard } from '../../../shared/components/ChangelogEntryCard';
import { APP_INFO } from '../../../shared/constants/appInfo';
import { changelogUpTo } from '../../../shared/constants/changelog';
import { SettingsCard } from './SettingsPrimitives';

/** En "Acerca de la agenda": lo que trajo la versión instalada y acceso al historial completo. */
export const ChangelogPreview: React.FC<{ onOpenAll: () => void }> = ({ onOpenAll }) => {
  const current = changelogUpTo().find((entry) => entry.version === APP_INFO.version);
  return (
    <SettingsCard>
      <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-md-on-surface)]">
        <ScrollText className="h-4 w-4 text-[var(--color-md-primary)]" aria-hidden="true" />
        Novedades de la versión
      </h3>
      {current ? (
        <ChangelogEntryCard entry={current} isCurrent plain />
      ) : (
        <p className="text-xs text-[var(--color-md-on-surface-variant)]">Consulta qué trajo cada versión de la agenda.</p>
      )}
      <button
        type="button"
        onClick={onOpenAll}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl bg-[var(--color-md-surface-container)] px-4 text-sm font-bold text-[var(--color-md-primary)] transition-colors hover:bg-[var(--color-md-surface-container-high)] active:scale-[0.99]"
      >
        Ver todas las novedades
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </SettingsCard>
  );
};

/** Historial completo hasta la versión instalada (la más nueva arriba, marcada como "Tu versión"). */
export const ChangelogList: React.FC = () => {
  const entries = changelogUpTo();
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-[var(--color-md-on-surface-variant)]">
        Lo que trajo cada versión de la agenda. Disponible también sin conexión.
      </p>
      {entries.map((entry) => (
        <ChangelogEntryCard key={entry.version} entry={entry} isCurrent={entry.version === APP_INFO.version} />
      ))}
    </div>
  );
};
