import React from 'react';
import { PartyPopper, ScrollText } from 'lucide-react';
import type { ChangelogEntry } from '../constants/changelog';
import { APP_INFO } from '../constants/appInfo';
import { markChangelogSeen } from '../services/whatsNewService';
import { ChangelogEntryCard } from './ChangelogEntryCard';
import { Modal } from './Modal';
import { Button } from './atoms';

/** Cuántas versiones mostrar en el aviso (el resto queda en el historial completo). */
const MAX_ENTRIES = 3;

interface WhatsNewModalProps {
  /** Novedades desde la última versión vista (la más nueva primero). */
  entries: ChangelogEntry[];
  onClose: () => void;
  /** Abrir Ajustes → Novedades de la versión. */
  onOpenAll: () => void;
}

/**
 * Aviso "Lo nuevo" tras actualizar: aparece una sola vez por versión. Al cerrarlo (o al ir al
 * historial completo) se registra la versión instalada como vista.
 */
export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ entries, onClose, onOpenAll }) => {
  const shown = entries.slice(0, MAX_ENTRIES);
  const hidden = entries.length - shown.length;

  const close = () => {
    markChangelogSeen();
    onClose();
  };
  const openAll = () => {
    markChangelogSeen();
    onOpenAll();
  };

  return (
    <Modal isOpen onClose={close} title={`Lo nuevo en la versión ${APP_INFO.version}`} maxWidth="md">
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-md-on-surface-variant)]">
          <PartyPopper className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
          {entries.length > 1
            ? `Tu agenda se actualizó. Esto cambió en las últimas ${entries.length} versiones:`
            : 'Tu agenda se actualizó. Esto es lo que cambió:'}
        </p>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {shown.map((entry, index) => (
            <React.Fragment key={entry.version}>
              {index > 0 && <hr className="border-[var(--color-md-outline-variant)]" />}
              <ChangelogEntryCard entry={entry} isCurrent={entry.version === APP_INFO.version} plain />
            </React.Fragment>
          ))}
          {hidden > 0 && (
            <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">
              Y {hidden} {hidden === 1 ? 'versión más' : 'versiones más'} en el historial completo.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-md-outline-variant)] pt-3">
          <Button variant="ghost" size="sm" icon={<ScrollText className="h-4 w-4" aria-hidden="true" />} onClick={openAll}>
            Ver todas
          </Button>
          <Button variant="primary" size="sm" onClick={close}>
            Entendido
          </Button>
        </div>
      </div>
    </Modal>
  );
};
