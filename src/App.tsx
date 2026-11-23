/**
 * ==============================================================================
 * Agenda Universitaria PWA
 * ==============================================================================
 * App desarrollada por Jorge I. Barrera V.
 * Eslogan: "POR Y PARA LOS ESTUDIANTES"
 * ==============================================================================
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, memo, Suspense } from 'react';
import { StudyTimerHost } from './features/study/components/StudyTimerHost';
import { STUDY_OPEN_EVENT, useStudyTimer } from './features/study/state/studyTimerStore';
import { Navbar, type TabType } from './shared/components/Navbar';
import { BottomNav } from './shared/components/BottomNav';
import { ContextualToast } from './shared/components/ContextualToast';
import { AppWallpaper } from './shared/components/AppWallpaper';
import { SeasonalEffects } from './shared/seasons/SeasonalEffects';
import { BackgroundSyncManager } from './shared/components/BackgroundSyncManager';
import { ViewSkeleton } from './shared/components/ViewSkeleton';
import { ScheduleView as ScheduleViewComponent } from './features/schedule/components/ScheduleView';
import { seedInitialDataIfEmpty } from './shared/db/AppDatabase';
import { useAppSettings } from './features/settings/hooks/useAppSettings';
import { useAppLock } from './features/security/hooks/useAppLock';
import { AppLockScreen } from './features/security/components/AppLockScreen';
import { applyTheme, applyCardSurface, applyPerformanceMode, applyTextScale, setupSystemThemeListener } from './shared/utils/theme';
import { useBackButton, BACK_PRIORITY } from './shared/hooks/useBackButton';
import { useSwipeNavigation } from './shared/hooks/useSwipeNavigation';
import { Capacitor } from '@capacitor/core';
import { useTabCounts } from './shared/hooks/useTabCounts';
import { useScrolledAttribute } from './shared/hooks/useScrolledAttribute';
import { isPerformanceModeOn } from './shared/utils/deviceProfile';
import { backButtonManager } from './shared/services/backButtonManager';
import { useLocalRoom } from './features/localRoom/hooks/useLocalRoom';
import { useIncomingSharedFile } from './shared/hooks/useIncomingSharedFile';
import { DETAIL_TAB, type DetailRequest, type DetailReturn, type DetailTarget } from './shared/navigation/detailNavigation';
import {
  NAV_TAB_OF,
  SECTION_ORDER,
  loadLastSections,
  saveLastSections,
  type LastSections,
  type NavTabId,
} from './shared/navigation/sections';
import { SectionSwitcher } from './shared/components/SectionSwitcher';
import { professorImportedMessage } from './features/professors/utils/importMessage';
import { scheduleImportedMessage, subjectImportedMessage } from './features/schedule/utils/importMessages';
import type { UpdateInfo } from './shared/services/updateService';
import type { ChangelogEntry } from './shared/constants/changelog';
import type { SettingsCategory } from './features/settings/components/SettingsView';
import type { AgendaFocusRequest } from './features/agenda/components/AgendaView';

const TAB_ORDER = SECTION_ORDER;

// El Horario es la vista crítica de arranque y se importa de forma estática.
// Las demás se cargan bajo demanda y se precargan cuando el navegador queda ocioso.
const loadAgendaView = () => import('./features/agenda/components/AgendaView');
const loadSubjectsView = () => import('./features/subjects/components/SubjectsView');
const loadProfessorsView = () => import('./features/professors/components/ProfessorsView');
import type { NotesIntent, NotesRequest } from './features/notes/types/notesRequest';
const loadNotesView = () => import('./features/notes/components/NotesView');
const loadDocumentsView = () => import('./features/documents/components/DocumentsView');
const loadStudyView = () => import('./features/study/components/StudyView');
const loadSettingsView = () => import('./features/settings/components/SettingsView');

/*
 * Las pestañas van memorizadas (memo): al cambiar de pestaña solo se vuelven a dibujar la que se
 * oculta y la que se muestra (cambia su isActive), no las cinco. Sus callbacks son estables
 * (useCallback), así que la memorización funciona.
 */
const ScheduleView = memo(ScheduleViewComponent);
const AgendaView = lazy(() => loadAgendaView().then((m) => ({ default: memo(m.AgendaView) })));
const SubjectsView = lazy(() => loadSubjectsView().then((m) => ({ default: memo(m.SubjectsView) })));
const ProfessorsView = lazy(() => loadProfessorsView().then((m) => ({ default: memo(m.ProfessorsView) })));
const NotesView = lazy(() => loadNotesView().then((m) => ({ default: memo(m.NotesView) })));
// Solo se carga si hay una versión nueva que anunciar
// Solo se carga si hay novedades sin ver tras actualizar
const BackupReminderModal = lazy(() =>
  import('./shared/components/BackupReminderModal').then((m) => ({ default: m.BackupReminderModal }))
);
const WhatsNewModal = lazy(() =>
  import('./shared/components/WhatsNewModal').then((m) => ({ default: m.WhatsNewModal }))
);
const UpdateModal = lazy(() =>
  import('./shared/components/UpdateModal').then((m) => ({ default: m.UpdateModal }))
);
// Solo se carga cuando llega un apunte compartido (.agnote) desde otra app
const ImportNoteModal = lazy(() =>
  import('./features/notes/components/ImportNoteModal').then((m) => ({ default: m.ImportNoteModal }))
);
// Solo se carga cuando llega un contacto de catedrático compartido (.agcontact)
const ImportProfessorModal = lazy(() =>
  import('./features/professors/components/ImportProfessorModal').then((m) => ({ default: m.ImportProfessorModal }))
);
// Solo se cargan cuando llega una materia (.agclass) o un horario completo (.agschedule)
const ImportSubjectModal = lazy(() =>
  import('./features/subjects/components/ImportSubjectModal').then((m) => ({ default: m.ImportSubjectModal }))
);
const ImportScheduleModal = lazy(() =>
  import('./features/schedule/components/ImportScheduleModal').then((m) => ({ default: m.ImportScheduleModal }))
);
const LocalRoomScreen = lazy(() =>
  import('./features/localRoom/components/LocalRoomScreen').then((m) => ({ default: m.LocalRoomScreen }))
);
const DocumentsView = lazy(() => loadDocumentsView().then((m) => ({ default: memo(m.DocumentsView) })));
const StudyView = lazy(() => loadStudyView().then((m) => ({ default: memo(m.StudyView) })));
const SettingsView = lazy(() => loadSettingsView().then((m) => ({ default: m.SettingsView })));

const SECONDARY_VIEW_LOADERS = [
  loadAgendaView,
  loadSubjectsView,
  loadProfessorsView,
  loadNotesView,
  loadDocumentsView,
  loadStudyView,
  loadSettingsView,
];

function preloadSecondaryViewsWhenIdle(): () => void {
  const preload = () => {
    for (const load of SECONDARY_VIEW_LOADERS) {
      load().catch(() => undefined);
    }
  };
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(preload, { timeout: 4000 });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = setTimeout(preload, 1500);
  return () => clearTimeout(timer);
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [tabDirection, setTabDirection] = useState<'right' | 'left'>('right');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notesRequest, setNotesRequest] = useState<NotesRequest | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<TabType | null>(null);

  const handleEditorActiveChange = useCallback((tab: TabType, isActive: boolean) => {
    setActiveEditorTab((prev) => {
      if (isActive) return tab;
      return prev === tab ? null : prev;
    });
  }, []);

  const handleScheduleEditorChange = useCallback(
    (active: boolean) => handleEditorActiveChange('schedule', active),
    [handleEditorActiveChange]
  );
  const handleSubjectsEditorChange = useCallback(
    (active: boolean) => handleEditorActiveChange('subjects', active),
    [handleEditorActiveChange]
  );
  const handleProfessorsEditorChange = useCallback(
    (active: boolean) => handleEditorActiveChange('professors', active),
    [handleEditorActiveChange]
  );
  const handleDocumentsEditorChange = useCallback(
    (active: boolean) => handleEditorActiveChange('documents', active),
    [handleEditorActiveChange]
  );

  const handleAgendaEditorChange = useCallback(
    (active: boolean) => handleEditorActiveChange('agenda', active),
    [handleEditorActiveChange]
  );

  const handleNotesEditorChange = useCallback(
    (active: boolean) => handleEditorActiveChange('notes', active),
    [handleEditorActiveChange]
  );

  const isAnyEditorActive = activeEditorTab === activeTab;

  // Pestañas ya visitadas: se montan la primera vez que se abren y luego se conservan
  // ocultas (patrón Keep-Alive) para no perder su estado al cambiar de pestaña.
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<TabType>>(() => new Set<TabType>(['schedule']));
  if (!mountedTabs.has(activeTab)) {
    setMountedTabs(new Set(mountedTabs).add(activeTab));
  }

  const { subjectCount, professorsCount, notesCount, documentsCount, agendaDueCount } = useTabCounts();
  const { settings } = useAppSettings();
  // Sala de Intercambio Local: su pantalla se abre desde la barra superior o desde «Pasar datos»
  const localRoom = useLocalRoom();
  // Bloqueo con PIN o huella (Ajustes → Bloqueo de la app): tapa la app hasta desbloquear
  const appLock = useAppLock();

  useEffect(() => preloadSecondaryViewsWhenIdle(), []);

  // Sincronizar tema de apariencia (claro, oscuro o sistema) y paleta dinámica Material You
  useEffect(() => {
    applyTheme(settings.theme, settings.colorPalette, settings.customPalette);
    return setupSystemThemeListener(settings.theme, settings.colorPalette, undefined, settings.customPalette);
  }, [settings.theme, settings.colorPalette, settings.customPalette]);

  // Acabado de tarjetas antes del primer pintado para que no parpadeen de sólido a cristal
  useLayoutEffect(() => {
    applyCardSurface(settings.cardSurfaceStyle);
  }, [settings.cardSurfaceStyle]);

  // Una sola marca de desplazamiento para toda la app (variante CSS scrolled:)
  useScrolledAttribute();

  // Plataforma en :root (p. ej. menos efectos costosos en Android, ver index.css)
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-platform', Capacitor.getPlatform());
  }, []);

  // Tamaño del texto (accesibilidad), antes del primer pintado
  useLayoutEffect(() => {
    applyTextScale(settings.textScale);
  }, [settings.textScale]);

  // Modo Ultra Fluidez, también antes del primer pintado
  useLayoutEffect(() => {
    // Activado de fábrica en equipos modestos mientras el estudiante no elija otra cosa
    applyPerformanceMode(isPerformanceModeOn(settings));
  }, [settings]);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    // Si la base de datos local está vacía, sembrar ejemplos universitarios
    seedInitialDataIfEmpty().catch(console.error);

    // Solicitar persistencia duradera del almacenamiento al navegador
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((isPersisted) => {
        if (isPersisted) {
          console.log('Almacenamiento persistente concedido por el navegador.');
        }
      });
    }

    // Inicializar gestor centralizado del botón de retroceso (Android y Web)
    backButtonManager.init({
      onExitPrompt: () => {
        showToast('Presiona de nuevo para salir de la aplicación');
      },
    });
  }, [showToast]);

  // Al estar en cualquier pestaña secundaria (Materias, Profesores o Apuntes),
  // presionar "Atrás" regresa al Horario principal en lugar de cerrar la app.
  useBackButton(() => {
    if (activeTab !== 'schedule') {
      setTabDirection('left');
      setActiveTab('schedule');
      return true;
    }
    return false;
  }, BACK_PRIORITY.TAB, activeTab !== 'schedule' && !isSettingsOpen);

  // Apunte, contacto, materia u horario compartido abierto desde WhatsApp u otra app (Android):
  // se ofrece importarlo con su modal
  const { incoming, clearIncoming } = useIncomingSharedFile(showToast);

  // Aviso "Lo nuevo" tras actualizar: una sola vez por versión. El historial y el servicio se
  // cargan poco después del arranque y solo se monta el modal si hay algo que contar
  const [whatsNew, setWhatsNew] = useState<ChangelogEntry[]>([]);
  const [settingsInitialView, setSettingsInitialView] = useState<SettingsCategory | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void import('./shared/services/whatsNewService').then(({ getUnseenChangelog }) => {
        const entries = getUnseenChangelog();
        if (!cancelled && entries.length > 0) setWhatsNew(entries);
      });
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);
  const closeWhatsNew = useCallback(() => setWhatsNew([]), []);
  const openChangelogFromWhatsNew = useCallback(() => {
    setWhatsNew([]);
    setSettingsInitialView('changelog');
    setIsSettingsOpen(true);
  }, []);

  // Aviso de nueva versión: 3 s después de abrir (sin competir con el arranque), solo con
  // conexión y si el usuario no lo pospuso hoy para esa misma versión. El servicio se carga
  // de forma diferida para no sumar peso al arranque.
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!navigator.onLine) return;
      void import('./shared/services/updateService').then(async (updates) => {
        const result = await updates.checkForUpdates();
        if (
          result.status === 'available' &&
          updates.updateUrlFor(result.info) &&
          !updates.isUpdateDismissedToday(result.info.latestVersion)
        ) {
          setPendingUpdate(result.info);
        }
      });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, []);

  // Copias de seguridad: 6 s después de abrir, la copia automática semanal si está activa (Android
  // y Windows); si no, un recordatorio cuando pasan 14 días sin copia. El servicio se carga diferido.
  const [backupReminder, setBackupReminder] = useState<{ daysWithoutBackup: number | null } | null>(null);
  const backupSettingsRef = useRef(settings);
  useEffect(() => {
    backupSettingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import('./shared/services/backupScheduleService').then(async (backup) => {
        const current = backupSettingsRef.current;
        try {
          const saved = await backup.runAutoBackupIfDue(current);
          if (saved) {
            showToast(`Copia de seguridad semanal guardada en ${saved.location}.`);
            return;
          }
        } catch (err) {
          console.warn('No se pudo hacer la copia automática:', err);
        }
        const reminder = await backup.getBackupReminder(current);
        if (reminder) setBackupReminder(reminder);
      });
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [showToast]);
  const closeBackupReminder = useCallback(() => {
    void import('./shared/services/backupScheduleService').then((backup) => backup.markBackupReminderShown());
    setBackupReminder(null);
  }, []);
  const openBackupFromReminder = useCallback(() => {
    closeBackupReminder();
    setSettingsInitialView('backup');
    setIsSettingsOpen(true);
  }, [closeBackupReminder]);

  const closeUpdateForToday = useCallback(() => {
    if (pendingUpdate) {
      const version = pendingUpdate.latestVersion;
      void import('./shared/services/updateService').then((updates) => updates.dismissUpdateForToday(version));
    }
    setPendingUpdate(null);
  }, [pendingUpdate]);

  const downloadPendingUpdate = useCallback(() => {
    if (!pendingUpdate) return;
    const info = pendingUpdate;
    // Tras abrir la descarga tampoco se insiste hoy: el usuario puede estar instalándola
    closeUpdateForToday();
    void import('./shared/services/updateService').then(async (updates) => {
      const url = updates.updateUrlFor(info);
      if (!url) return;
      try {
        await updates.openDownloadUrl(url);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'No se pudo abrir la descarga.');
      }
    });
  }, [pendingUpdate, closeUpdateForToday, showToast]);

  // Sección que se vio por última vez en cada pestaña de la barra (Materias → Materias o
  // Profesores; Biblioteca → Apuntes o Archivos): al volver a esa pestaña se abre la misma
  const lastSectionsRef = useRef<LastSections | null>(null);
  const rememberSection = useCallback((section: TabType) => {
    const last = (lastSectionsRef.current ??= loadLastSections());
    const navTab = NAV_TAB_OF[section];
    if (last[navTab] === section) return;
    lastSectionsRef.current = { ...last, [navTab]: section };
    saveLastSections(lastSectionsRef.current);
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    rememberSection(tab);
    setActiveTab((prevTab) => {
      const prevIndex = TAB_ORDER.indexOf(prevTab);
      const nextIndex = TAB_ORDER.indexOf(tab);
      setTabDirection(nextIndex >= prevIndex ? 'right' : 'left');
      return tab;
    });
    setActiveEditorTab(null);
    setIsSettingsOpen(false);
  }, [rememberSection]);

  const handleNavTabChange = useCallback(
    (navTab: NavTabId) => {
      const last = (lastSectionsRef.current ??= loadLastSections());
      handleTabChange(last[navTab]);
    },
    [handleTabChange]
  );

  // Fichas de detalle entre pestañas (Horario → materia → catedrático → …). La petición lleva
  // a dónde volver; la pestaña destino la atiende y, al cerrar la ficha, llama a returnFromDetail
  const [detailRequest, setDetailRequest] = useState<DetailRequest | null>(null);
  const detailNonceRef = useRef(0);
  const openDetail = useCallback(
    (target: DetailTarget, returnTo?: DetailReturn) => {
      detailNonceRef.current += 1;
      setDetailRequest({ ...target, nonce: detailNonceRef.current, returnTo });
      handleTabChange(DETAIL_TAB[target.kind]);
    },
    [handleTabChange]
  );
  const returnFromDetail = useCallback(
    (to: DetailReturn) => {
      // Si se venía de otra ficha, se reabre (con su propio "volver"); si no, solo la pestaña
      if (to.request) openDetail({ kind: to.request.kind, id: to.request.id }, to.request.returnTo);
      else handleTabChange(to.tab);
    },
    [openDetail, handleTabChange]
  );
  const openSubjectDetail = useCallback(
    (subjectId: string, from?: DetailReturn) => openDetail({ kind: 'subject', id: subjectId }, from),
    [openDetail]
  );
  const openProfessorDetail = useCallback(
    (professorId: string, from?: DetailReturn) => openDetail({ kind: 'professor', id: professorId }, from),
    [openDetail]
  );
  const openSubjectDetailFromSchedule = useCallback(
    (subjectId: string) => openDetail({ kind: 'subject', id: subjectId }, { tab: 'schedule' }),
    [openDetail]
  );

  // "Próximos en tu agenda" (Horario): abre la Agenda en ese día
  const [agendaFocus, setAgendaFocus] = useState<AgendaFocusRequest | null>(null);
  const openAgendaDay = useCallback(
    (day: string) => {
      setAgendaFocus((prev) => ({ day, nonce: (prev?.nonce ?? 0) + 1 }));
      handleTabChange('agenda');
    },
    [handleTabChange]
  );
  const openAgenda = useCallback(() => handleTabChange('agenda'), [handleTabChange]);

  // Modo estudio: «Estudiar» en una ficha pide abrir la pestaña Estudio; el punto verde de la
  // barra indica que hay una sesión empezada
  const studyTimerState = useStudyTimer();
  const studyActive = studyTimerState.running || studyTimerState.focusStartedAt !== null;
  useEffect(() => {
    const openStudy = () => handleTabChange('study');
    window.addEventListener(STUDY_OPEN_EVENT, openStudy);
    return () => window.removeEventListener(STUDY_OPEN_EVENT, openStudy);
  }, [handleTabChange]);
  const openSubjectDetailFromAgenda = useCallback(
    (subjectId: string) => openDetail({ kind: 'subject', id: subjectId }, { tab: 'agenda' }),
    [openDetail]
  );

  // «Tomar apunte» (abre el editor con la materia elegida) o «Ver apuntes» (lista filtrada)
  const handleNavigateToNotesFromSchedule = useCallback((subjectId?: string, intent: NotesIntent = 'browse') => {
    rememberSection('notes');
    setNotesRequest((prev) => ({ subjectId, intent, nonce: (prev?.nonce ?? 0) + 1 }));
    setActiveTab((prevTab) => {
      const prevIndex = TAB_ORDER.indexOf(prevTab);
      const nextIndex = TAB_ORDER.indexOf('notes');
      setTabDirection(nextIndex >= prevIndex ? 'right' : 'left');
      return 'notes';
    });
    setIsSettingsOpen(false);
  }, [rememberSection]);

  const tabEnterClass = tabDirection === 'right' ? 'block m3-tab-enter-right' : 'block m3-tab-enter-left';

  // Navegación por deslizamiento táctil horizontal estilo WhatsApp (ViewPager2)
  const swipeContainerRef = useSwipeNavigation({
    activeTab,
    tabOrder: TAB_ORDER,
    onTabChange: handleTabChange,
    enabled: !isAnyEditorActive && !isSettingsOpen,
  });

  return (
    <div
      className={`relative min-h-screen bg-[var(--color-md-surface)] text-[var(--color-md-on-surface)] flex flex-col selection:bg-[var(--color-md-primary-container)] selection:text-[var(--color-md-on-primary-container)] transition-colors duration-200 ${
        isAnyEditorActive && activeTab === 'notes'
          ? 'pb-0'
          : isAnyEditorActive || isSettingsOpen
            ? 'pb-4'
            : 'pb-22 md:pb-10'
      }`}
    >
      {/* Papel Tapiz Adaptativo al Tema (Fijo en GPU, z-0) */}
      <AppWallpaper />
      <SeasonalEffects />

      {/* Sincronización de notificaciones y widget Android, aislada del árbol visual */}
      <BackgroundSyncManager />

      {/* Barra de navegación superior de Campus (Oculta al crear apuntes, formularios o en Ajustes) */}
      {!isAnyEditorActive && !isSettingsOpen && (
        <Navbar
          activeTab={activeTab}
          onNavTabChange={handleNavTabChange}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenProfile={() => {
            setSettingsInitialView('profile');
            setIsSettingsOpen(true);
          }}
          studentName={settings.studentName}
          studentAvatarUrl={settings.studentAvatarUrl}
          studentStatusMode={settings.studentStatusMode}
          studentCustomStatus={settings.studentCustomStatus}
          subjectCount={subjectCount}
          notesCount={notesCount}
          documentsCount={documentsCount}
          agendaDueCount={agendaDueCount}
          studyActive={studyActive}
        />
      )}

      {/* Modo estudio: vigila el temporizador aunque su pantalla esté cerrada */}
      <StudyTimerHost />

      {whatsNew.length > 0 && !incoming && (
        <Suspense fallback={null}>
          <WhatsNewModal entries={whatsNew} onClose={closeWhatsNew} onOpenAll={openChangelogFromWhatsNew} />
        </Suspense>
      )}

      {/* El aviso de nueva versión espera a que se cierre "Lo nuevo" */}
      {pendingUpdate && !incoming && whatsNew.length === 0 && (
        <Suspense fallback={null}>
          <UpdateModal info={pendingUpdate} onDownload={downloadPendingUpdate} onLater={closeUpdateForToday} />
        </Suspense>
      )}

      {/* El recordatorio de copia espera a que no haya otro aviso abierto */}
      {backupReminder && !incoming && whatsNew.length === 0 && !pendingUpdate && (
        <Suspense fallback={null}>
          <BackupReminderModal
            daysWithoutBackup={backupReminder.daysWithoutBackup}
            onBackupNow={openBackupFromReminder}
            onLater={closeBackupReminder}
          />
        </Suspense>
      )}

      {incoming?.kind === 'note' && (
        <Suspense fallback={null}>
          <ImportNoteModal
            key={`${incoming.sharePackage.exportedAt}-${incoming.sharePackage.note.title}`}
            sharePackage={incoming.sharePackage}
            onClose={clearIncoming}
            onImported={({ title, subjectName }) => {
              clearIncoming();
              handleTabChange('notes');
              showToast(`«${title}» se guardó en ${subjectName}.`);
            }}
          />
        </Suspense>
      )}

      {incoming?.kind === 'contact' && (
        <Suspense fallback={null}>
          <ImportProfessorModal
            key={`${incoming.sharePackage.exportedAt}-${incoming.sharePackage.professor.name}`}
            sharePackage={incoming.sharePackage}
            onClose={clearIncoming}
            onImported={(result) => {
              clearIncoming();
              handleTabChange('professors');
              showToast(professorImportedMessage(result));
            }}
          />
        </Suspense>
      )}

      {incoming?.kind === 'subject' && (
        <Suspense fallback={null}>
          <ImportSubjectModal
            key={`${incoming.sharePackage.exportedAt}-${incoming.sharePackage.subject.name}`}
            sharePackage={incoming.sharePackage}
            onClose={clearIncoming}
            onImported={({ subjectName, summary }) => {
              clearIncoming();
              handleTabChange('subjects');
              showToast(subjectImportedMessage(subjectName, summary));
            }}
          />
        </Suspense>
      )}

      {incoming?.kind === 'schedule' && (
        <Suspense fallback={null}>
          <ImportScheduleModal
            key={incoming.sharePackage.exportedAt}
            sharePackage={incoming.sharePackage}
            onClose={clearIncoming}
            onImported={({ summary, mode }) => {
              clearIncoming();
              handleTabChange('schedule');
              showToast(scheduleImportedMessage(summary, mode));
            }}
          />
        </Suspense>
      )}

      {localRoom.screenOpen && (
        <Suspense fallback={null}>
          <LocalRoomScreen studentName={settings.studentName} studentPhoto={settings.studentAvatarUrl} onShowToast={showToast} />
        </Suspense>
      )}

      {appLock.locked && <AppLockScreen onUnlock={appLock.unlock} />}

      {/* Notificación Toast Contextual Centrada y Translúcida */}
      <ContextualToast
        message={toastMessage}
        bottomOffset={isAnyEditorActive || isSettingsOpen ? 'compact' : 'nav'}
        onClose={() => setToastMessage(null)}
      />

      {/* Contenedor Principal (100% del ancho y alto útil disponible en PC y Móvil) */}
      <main
        ref={swipeContainerRef}
        style={
          isAnyEditorActive && activeTab === 'notes'
            ? undefined
            : {
                paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
              }
        }
        // overflow-x-clip (no hidden): recorta el desborde horizontal sin crear un contenedor de
        // scroll, que anularía el position: sticky de las barras de búsqueda (StickyToolbar)
        className={`relative z-10 flex-1 flex flex-col w-full mx-auto overflow-x-clip touch-pan-y ${
          isAnyEditorActive && activeTab === 'notes'
            ? 'p-0'
            : isAnyEditorActive || isSettingsOpen
              ? 'px-3 sm:px-6 lg:px-8 2xl:px-10 pt-1 sm:pt-3'
              : 'px-3 sm:px-6 lg:px-8 2xl:px-10 pt-3 sm:pt-5 pb-36 sm:pb-32 md:pb-8'
        }`}
      >
        {isSettingsOpen ? (
          <div className="m3-view-enter flex-1">
            <Suspense fallback={<ViewSkeleton />}>
              <SettingsView
                initialSubView={settingsInitialView}
                onBack={() => {
                  setIsSettingsOpen(false);
                  setSettingsInitialView(undefined);
                }}
                onShowToast={showToast}
              />
            </Suspense>
          </div>
        ) : (
          // En monitores muy anchos el contenido no pasa de 1600 px: sin estirarse de lado a lado
          <div className="mx-auto w-full min-w-0 max-w-[1600px] flex-1">
            {/* Materias | Profesores y Apuntes | Archivos: se oculta en fichas, formularios y editores */}
            {!isAnyEditorActive && (
              <SectionSwitcher
                activeSection={activeTab}
                onChange={handleTabChange}
                counts={{ subjects: subjectCount, professors: professorsCount, notes: notesCount, documents: documentsCount }}
              />
            )}
            <div className={activeTab === 'schedule' ? tabEnterClass : 'tab-hidden'}>
              <ScheduleView
                onNavigateToNotes={handleNavigateToNotesFromSchedule}
                onOpenSubjectDetail={openSubjectDetailFromSchedule}
                onEditorActiveChange={handleScheduleEditorChange}
                onOpenAgendaDay={openAgendaDay}
                onOpenAgenda={openAgenda}
                isActive={activeTab === 'schedule'}
              />
            </div>
            <div className={activeTab === 'agenda' ? tabEnterClass : 'tab-hidden'}>
              {mountedTabs.has('agenda') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <AgendaView
                    focusRequest={agendaFocus}
                    onOpenSubjectDetail={openSubjectDetailFromAgenda}
                    onEditorActiveChange={handleAgendaEditorChange}
                    isActive={activeTab === 'agenda'}
                  />
                </Suspense>
              )}
            </div>
            <div className={activeTab === 'subjects' ? tabEnterClass : 'tab-hidden'}>
              {mountedTabs.has('subjects') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <SubjectsView
                    onNavigateToNotes={handleNavigateToNotesFromSchedule}
                    detailRequest={detailRequest?.kind === 'subject' ? detailRequest : null}
                    onOpenProfessorDetail={openProfessorDetail}
                    onReturnFromDetail={returnFromDetail}
                    onEditorActiveChange={handleSubjectsEditorChange}
                    isActive={activeTab === 'subjects'}
                  />
                </Suspense>
              )}
            </div>
            <div className={activeTab === 'professors' ? tabEnterClass : 'tab-hidden'}>
              {mountedTabs.has('professors') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <ProfessorsView
                    detailRequest={detailRequest?.kind === 'professor' ? detailRequest : null}
                    onOpenSubjectDetail={openSubjectDetail}
                    onReturnFromDetail={returnFromDetail}
                    onEditorActiveChange={handleProfessorsEditorChange}
                    isActive={activeTab === 'professors'}
                  />
                </Suspense>
              )}
            </div>
            <div className={activeTab === 'notes' ? tabEnterClass : 'tab-hidden'}>
              {mountedTabs.has('notes') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <NotesView
                    request={notesRequest}
                    onEditorActiveChange={handleNotesEditorChange}
                    isActive={activeTab === 'notes'}
                  />
                </Suspense>
              )}
            </div>
            <div className={activeTab === 'documents' ? tabEnterClass : 'tab-hidden'}>
              {mountedTabs.has('documents') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <DocumentsView
                    isActive={activeTab === 'documents'}
                    onEditorActiveChange={handleDocumentsEditorChange}
                  />
                </Suspense>
              )}
            </div>
            <div className={activeTab === 'study' ? tabEnterClass : 'tab-hidden'}>
              {mountedTabs.has('study') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <StudyView isActive={activeTab === 'study'} />
                </Suspense>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Barra de navegación inferior ergonómica para teléfono (Oculta al crear apuntes, formularios o en Ajustes) */}
      {!isAnyEditorActive && !isSettingsOpen && (
        <BottomNav
          activeTab={activeTab}
          onNavTabChange={handleNavTabChange}
          subjectCount={subjectCount}
          notesCount={notesCount}
          documentsCount={documentsCount}
          agendaDueCount={agendaDueCount}
          studyActive={studyActive}
        />
      )}
    </div>
  );
}

export default App;
