import React, { Suspense, lazy, useCallback, useState } from 'react';
import { ArrowLeft, Hourglass, LoaderCircle, LogOut, Radio, UsersRound } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import type { IncomingSharedFile } from '../../../shared/hooks/useIncomingSharedFile';
import { professorImportedMessage } from '../../professors/utils/importMessage';
import { scheduleImportedMessage, subjectImportedMessage } from '../../schedule/utils/importMessages';
import { useLocalRoom } from '../hooks/useLocalRoom';
import { dismissRoomEnd, fetchRoomItem, leaveRoom, loadRoomProfile, markRoomItemSaved, setRoomScreenOpen } from '../services/roomStore';
import { parseRoomPackage } from '../services/roomItems';
import type { RoomItemPayload, RoomMessage } from '../types/room';
import { RoomLobby } from './RoomLobby';
import { RoomSidebar } from './RoomSidebar';
import { RoomThread } from './RoomThread';
import { ROOM_FILLED_BUTTON, ROOM_ICON_BUTTON, ROOM_TONAL_BUTTON } from './roomStyles';

const RoomAttachSheet = lazy(() => import('./RoomAttachSheet').then((m) => ({ default: m.RoomAttachSheet })));
const RoomDocumentSaveModal = lazy(() => import('./RoomDocumentSaveModal').then((m) => ({ default: m.RoomDocumentSaveModal })));
const ImportNoteModal = lazy(() => import('../../notes/components/ImportNoteModal').then((m) => ({ default: m.ImportNoteModal })));
const ImportProfessorModal = lazy(() => import('../../professors/components/ImportProfessorModal').then((m) => ({ default: m.ImportProfessorModal })));
const ImportSubjectModal = lazy(() => import('../../subjects/components/ImportSubjectModal').then((m) => ({ default: m.ImportSubjectModal })));
const ImportScheduleModal = lazy(() => import('../../schedule/components/ImportScheduleModal').then((m) => ({ default: m.ImportScheduleModal })));

interface LocalRoomScreenProps {
  studentName?: string;
  onShowToast: (message: string) => void;
}

type SaveTarget = { itemId: string } & ({ kind: 'package'; parsed: IncomingSharedFile } | { kind: 'document'; payload: RoomItemPayload });

/**
 * Pantalla de la Sala de Intercambio Local (encima de la app; la sala sigue abierta al volver).
 * - PC: dos columnas (invitar, participantes y controles | hilo y adjuntos).
 * - Teléfono: cabecera compacta e hilo a pantalla completa; los participantes en una hoja.
 */
export const LocalRoomScreen: React.FC<LocalRoomScreenProps> = ({ studentName, onShowToast }) => {
  const { session, saved } = useLocalRoom();
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [membersOpen, setMembersOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<SaveTarget | null>(null);
  const [profile] = useState(() => loadRoomProfile(studentName ?? ''));

  const close = useCallback(() => setRoomScreenOpen(false), []);
  useBackButton(close, BACK_PRIORITY.SETTINGS);

  // Al salir de la sala activa se cierran las hojas abiertas (ajuste durante el render, sin efecto)
  const [lastPhase, setLastPhase] = useState(session.phase);
  if (session.phase !== lastPhase) {
    setLastPhase(session.phase);
    if (session.phase !== 'active') {
      setMembersOpen(false);
      setAttachOpen(false);
    }
  }

  const save = async (message: RoomMessage) => {
    const item = message.item;
    if (!item || savingId) return;
    setSavingId(item.id);
    try {
      const payload = await fetchRoomItem(item.id);
      if (payload.kind === 'document') setSaveTarget({ itemId: item.id, kind: 'document', payload });
      else setSaveTarget({ itemId: item.id, kind: 'package', parsed: await parseRoomPackage(payload) });
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'No se pudo abrir el elemento.');
    } finally {
      setSavingId(null);
    }
  };

  const finishSave = (message: string) => {
    if (saveTarget) markRoomItemSaved(saveTarget.itemId);
    setSaveTarget(null);
    onShowToast(message);
  };

  const leave = () => {
    void leaveRoom().catch((err: unknown) => onShowToast(err instanceof Error ? err.message : 'No se pudo salir.'));
  };

  const active = session.phase === 'active' ? session : null;
  const isHost = active?.role === 'host';
  const invite = active && active.role === 'host' ? active.invite : undefined;
  const activeMembers = active ? active.snapshot.members.filter((m) => m.status === 'active').length : 0;
  const pendingCount = active && isHost ? active.snapshot.members.filter((m) => m.status === 'pending').length : 0;

  const title = active ? active.snapshot.info.name : session.phase === 'waiting' ? session.info.name : 'Sala Local';

  return (
    <div
      className="glass-legible fixed inset-0 z-[45] flex flex-col bg-[var(--color-md-surface)] text-[var(--color-md-on-surface)]"
      // Sin margen superior: como la barra de la app, la ventana nativa ya deja el espacio de la barra de estado
      style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Sala de Intercambio Local"
    >
      {/* Cabecera */}
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-[var(--color-md-outline-variant)]/50 bg-[var(--color-md-surface-container)] px-2 sm:px-4">
        <button type="button" className={ROOM_ICON_BUTTON} onClick={close} aria-label="Volver a la agenda (la sala sigue abierta)" title="Volver a la agenda">
          <ArrowLeft aria-hidden="true" />
        </button>
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)] sm:flex">
          <Radio className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-extrabold tracking-tight">{title}</h2>
          {active && (
            <p className="truncate text-xs text-[var(--color-md-on-surface-variant)]">
              {isHost ? 'Eres el anfitrión' : `Anfitrión: ${active.snapshot.info.hostName}`} · {activeMembers} {activeMembers === 1 ? 'persona' : 'personas'}
            </p>
          )}
        </div>
        {active && !isWide && (
          <button type="button" className={`${ROOM_TONAL_BUTTON} relative min-h-10 px-3`} onClick={() => setMembersOpen(true)} aria-label={isHost ? 'Participantes y controles' : 'Participantes'}>
            <UsersRound aria-hidden="true" />
            {activeMembers}
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-10px font-bold text-white" aria-label={`${pendingCount} esperando`}>
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </header>

      {/* Contenido */}
      {(session.phase === 'idle' || session.phase === 'starting') && (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
          <RoomLobby initialProfile={profile} busy={session.phase === 'starting' ? session.role : null} onShowToast={onShowToast} />
        </div>
      )}

      {session.phase === 'waiting' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
            {session.connection === 'online' ? <Hourglass className="h-7 w-7" aria-hidden="true" /> : <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden="true" />}
          </span>
          <div>
            <p className="text-lg font-bold">Esperando a que {session.info.hostName} te acepte</p>
            <p className="mt-1 text-sm text-[var(--color-md-on-surface-variant)]">Entrarás a «{session.info.name}» en cuanto el anfitrión lo apruebe.</p>
          </div>
          <button type="button" className={ROOM_TONAL_BUTTON} onClick={leave}>
            <LogOut aria-hidden="true" />
            Cancelar
          </button>
        </div>
      )}

      {active && (
        <div className="flex min-h-0 flex-1">
          {isWide && (
            <aside className="custom-scrollbar w-[360px] shrink-0 overflow-y-auto overflow-x-hidden border-r border-[var(--color-md-outline-variant)]/50 p-4 xl:w-[400px]" aria-label="Datos de la sala">
              <RoomSidebar snapshot={active.snapshot} invite={invite} onLeave={leave} onShowToast={onShowToast} />
            </aside>
          )}
          <RoomThread
            snapshot={active.snapshot}
            isHost={isHost}
            reconnecting={active.connection === 'reconnecting'}
            saved={saved}
            savingId={savingId}
            onSave={(message) => void save(message)}
            onAttach={() => setAttachOpen(true)}
            onShowToast={onShowToast}
          />
        </div>
      )}

      {session.phase === 'ended' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-md-surface-container-high)] text-[var(--color-md-primary)]">
            <Radio className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold">La sala terminó</p>
            <p className="mt-1 text-sm text-[var(--color-md-on-surface-variant)]">{session.message}</p>
            <p className="mt-1 text-sm text-[var(--color-md-on-surface-variant)]">Lo que guardaste sigue en tu agenda.</p>
          </div>
          <button type="button" className={ROOM_FILLED_BUTTON} onClick={dismissRoomEnd}>
            Entendido
          </button>
        </div>
      )}

      {/* Hojas */}
      {membersOpen && active && !isWide && (
        <Modal isOpen onClose={() => setMembersOpen(false)} title={isHost ? 'Sala y participantes' : 'Participantes'} maxWidth="md">
          <RoomSidebar
            snapshot={active.snapshot}
            invite={invite}
            onLeave={() => {
              setMembersOpen(false);
              leave();
            }}
            onShowToast={onShowToast}
          />
        </Modal>
      )}

      {attachOpen && active && (
        <Suspense fallback={null}>
          <RoomAttachSheet textAllowed={isHost || active.snapshot.rules.textEnabled} onClose={() => setAttachOpen(false)} onShowToast={onShowToast} />
        </Suspense>
      )}

      {saveTarget && (
        <Suspense fallback={null}>
          {saveTarget.kind === 'document' && (
            <RoomDocumentSaveModal
              payload={saveTarget.payload}
              onClose={() => setSaveTarget(null)}
              onSaved={({ subjectName, alreadyHad }) => finishSave(alreadyHad ? `Ya tenías este archivo en ${subjectName}.` : `Archivo guardado en ${subjectName}.`)}
            />
          )}
          {saveTarget.kind === 'package' && saveTarget.parsed.kind === 'note' && (
            <ImportNoteModal
              sharePackage={saveTarget.parsed.sharePackage}
              onClose={() => setSaveTarget(null)}
              onImported={({ title: noteTitle, subjectName }) => finishSave(`«${noteTitle}» se guardó en ${subjectName}.`)}
            />
          )}
          {saveTarget.kind === 'package' && saveTarget.parsed.kind === 'contact' && (
            <ImportProfessorModal sharePackage={saveTarget.parsed.sharePackage} onClose={() => setSaveTarget(null)} onImported={(result) => finishSave(professorImportedMessage(result))} />
          )}
          {saveTarget.kind === 'package' && saveTarget.parsed.kind === 'subject' && (
            <ImportSubjectModal
              sharePackage={saveTarget.parsed.sharePackage}
              onClose={() => setSaveTarget(null)}
              onImported={({ subjectName, summary }) => finishSave(subjectImportedMessage(subjectName, summary))}
            />
          )}
          {saveTarget.kind === 'package' && saveTarget.parsed.kind === 'schedule' && (
            <ImportScheduleModal
              sharePackage={saveTarget.parsed.sharePackage}
              onClose={() => setSaveTarget(null)}
              onImported={({ summary, mode }) => finishSave(scheduleImportedMessage(summary, mode))}
            />
          )}
        </Suspense>
      )}
    </div>
  );
};
