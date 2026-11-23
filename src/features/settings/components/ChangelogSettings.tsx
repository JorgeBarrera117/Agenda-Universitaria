import React from 'react';
import { ChevronRight, ScrollText } from 'lucide-react';
import { ChangelogEntryCard } from '../../../shared/components/ChangelogEntryCard';
import { APP_INFO } from '../../../shared/constants/appInfo';
import { changelogUpTo } from '../../../shared/constants/changelog';
import { SettingsCard } from './SettingsPrimitives';

/** Novedades que se ven sin abrir el historial (el resto, en «Ver todas las novedades»). */
const PREVIEW_ITEMS = 3;

/** En "Acerca de la agenda": las 3 novedades principales de la versión instalada y acceso al historial completo. */
export const ChangelogPreview: React.FC<{ onOpenAll: () => void }> = ({ onOpenAll }) => {
  const full = changelogUpTo().find((entry) => entry.version === APP_INFO.version);
  const current = full ? { ...full, changes: full.changes.slice(0, PREVIEW_ITEMS) } : undefined;
  const hidden = full ? full.changes.length - PREVIEW_ITEMS : 0;
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
        className="group flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-[var(--color-md-primary)]/40 bg-[var(--color-md-card-bg)] px-4 text-sm font-bold text-[var(--color-md-primary)] shadow-2xs transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out hover:border-[var(--color-md-primary)] hover:bg-[var(--color-md-primary-container)] hover:shadow-xs active:scale-[0.99]"
      >
        <span>
          Ver todas las novedades
          {hidden > 0 && <span className="font-semibold opacity-80"> · {hidden} más</span>}
        </span>
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
