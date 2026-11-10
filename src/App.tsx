/**
 * ==============================================================================
 * Agenda Universitaria PWA
 * ==============================================================================
 * App desarrollada por Jorge I. Barrera V.
 * Eslogan: "POR Y PARA LOS ESTUDIANTES"
 * ==============================================================================
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Navbar, type TabType } from './shared/components/Navbar';
import { BottomNav } from './shared/components/BottomNav';
import { ContextualToast } from './shared/components/ContextualToast';
import { AppWallpaper } from './shared/components/AppWallpaper';
import { BackgroundSyncManager } from './shared/components/BackgroundSyncManager';
import { ViewSkeleton } from './shared/components/ViewSkeleton';
import { ScheduleView } from './features/schedule/components/ScheduleView';
import { seedInitialDataIfEmpty } from './shared/db/AppDatabase';
import { useAppSettings } from './features/settings/hooks/useAppSettings';
import { applyTheme, applyCardSurface, applyPerformanceMode, setupSystemThemeListener } from './shared/utils/theme';
import { useBackButton, BACK_PRIORITY } from './shared/hooks/useBackButton';
import { useSwipeNavigation } from './shared/hooks/useSwipeNavigation';
import { useTabCounts } from './shared/hooks/useTabCounts';
import { backButtonManager } from './shared/services/backButtonManager';

const TAB_ORDER: TabType[] = ['schedule', 'subjects', 'professors', 'notes', 'documents'];

// El Horario es la vista crítica de arranque y se importa de forma estática.
// Las demás se cargan bajo demanda y se precargan cuando el navegador queda ocioso.
const loadSubjectsView = () => import('./features/subjects/components/SubjectsView');
const loadProfessorsView = () => import('./features/professors/components/ProfessorsView');
const loadNotesView = () => import('./features/notes/components/NotesView');
const loadDocumentsView = () => import('./features/documents/components/DocumentsView');
const loadSettingsView = () => import('./features/settings/components/SettingsView');

const SubjectsView = lazy(() => loadSubjectsView().then((m) => ({ default: m.SubjectsView })));
const ProfessorsView = lazy(() => loadProfessorsView().then((m) => ({ default: m.ProfessorsView })));
const NotesView = lazy(() => loadNotesView().then((m) => ({ default: m.NotesView })));
const DocumentsView = lazy(() => loadDocumentsView().then((m) => ({ default: m.DocumentsView })));
const SettingsView = lazy(() => loadSettingsView().then((m) => ({ default: m.SettingsView })));

const SECONDARY_VIEW_LOADERS = [
  loadSubjectsView,
  loadProfessorsView,
  loadNotesView,
  loadDocumentsView,
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
  const [selectedSubjectForNotes, setSelectedSubjectForNotes] = useState<string | undefined>(undefined);
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

  const { subjectCount, professorsCount, notesCount, documentsCount } = useTabCounts();
  const { settings } = useAppSettings();

  useEffect(() => preloadSecondaryViewsWhenIdle(), []);

  // Sincronizar tema de apariencia (claro, oscuro o sistema) y paleta dinámica Material You
  useEffect(() => {
    applyTheme(settings.theme, settings.colorPalette);
    const cleanup = setupSystemThemeListener(settings.theme, settings.colorPalette, () => {
      applyTheme('system', settings.colorPalette);
    });
    return cleanup;
  }, [settings.theme, settings.colorPalette]);

  // Acabado de tarjetas antes del primer pintado para que no parpadeen de sólido a cristal
  useLayoutEffect(() => {
    applyCardSurface(settings.cardSurfaceStyle);
  }, [settings.cardSurfaceStyle]);

  // Modo Ultra Fluidez, también antes del primer pintado
  useLayoutEffect(() => {
    applyPerformanceMode(settings.performanceMode);
  }, [settings.performanceMode]);


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
  }, []);

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

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3500);
  };

  const handleTabChange = useCallback((tab: TabType) => {
    if (tab !== 'notes') {
      setSelectedSubjectForNotes(undefined);
    }
    setActiveTab((prevTab) => {
      const prevIndex = TAB_ORDER.indexOf(prevTab);
      const nextIndex = TAB_ORDER.indexOf(tab);
      setTabDirection(nextIndex >= prevIndex ? 'right' : 'left');
      return tab;
    });
    setActiveEditorTab(null);
    setIsSettingsOpen(false);
  }, []);

  // Atajo contextual UX: Tomar apunte de la clase activa en el horario
  const handleNavigateToNotesFromSchedule = useCallback((subjectId?: string) => {
    if (subjectId) {
      setSelectedSubjectForNotes(subjectId);
    }
    setActiveTab((prevTab) => {
      const prevIndex = TAB_ORDER.indexOf(prevTab);
      const nextIndex = TAB_ORDER.indexOf('notes');
      setTabDirection(nextIndex >= prevIndex ? 'right' : 'left');
      return 'notes';
    });
    setIsSettingsOpen(false);
  }, []);

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

      {/* Sincronización de notificaciones y widget Android, aislada del árbol visual */}
      <BackgroundSyncManager />

      {/* Barra de navegación superior de Campus (Oculta al crear apuntes, formularios o en Ajustes) */}
      {!isAnyEditorActive && !isSettingsOpen && (
        <Navbar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenSettings={() => setIsSettingsOpen(true)}
          studentName={settings.studentName}
          studentAvatarUrl={settings.studentAvatarUrl}
          studentStatusMode={settings.studentStatusMode}
          studentCustomStatus={settings.studentCustomStatus}
          subjectCount={subjectCount}
          professorsCount={professorsCount}
          notesCount={notesCount}
          documentsCount={documentsCount}
        />
      )}

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
        className={`relative z-10 flex-1 flex flex-col w-full mx-auto overflow-x-hidden touch-pan-y ${
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
                onBack={() => setIsSettingsOpen(false)}
                onShowToast={showToast}
              />
            </Suspense>
          </div>
        ) : (
          <div className="flex-1 w-full min-w-0">
            <div className={activeTab === 'schedule' ? tabEnterClass : 'hidden'}>
              <ScheduleView
                onNavigateToNotes={handleNavigateToNotesFromSchedule}
                onEditorActiveChange={handleScheduleEditorChange}
                isActive={activeTab === 'schedule'}
              />
            </div>
            <div className={activeTab === 'subjects' ? tabEnterClass : 'hidden'}>
              {mountedTabs.has('subjects') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <SubjectsView
                    onNavigateToNotes={handleNavigateToNotesFromSchedule}
                    onEditorActiveChange={handleSubjectsEditorChange}
                    isActive={activeTab === 'subjects'}
                  />
                </Suspense>
              )}
            </div>
            <div className={activeTab === 'professors' ? tabEnterClass : 'hidden'}>
              {mountedTabs.has('professors') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <ProfessorsView
                    onEditorActiveChange={handleProfessorsEditorChange}
                    isActive={activeTab === 'professors'}
                  />
                </Suspense>
              )}
            </div>
            <div className={activeTab === 'notes' ? tabEnterClass : 'hidden'}>
              {mountedTabs.has('notes') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <NotesView
                    initialSubjectFilterId={selectedSubjectForNotes}
                    onEditorActiveChange={handleNotesEditorChange}
                    isActive={activeTab === 'notes'}
                  />
                </Suspense>
              )}
            </div>
            <div className={activeTab === 'documents' ? tabEnterClass : 'hidden'}>
              {mountedTabs.has('documents') && (
                <Suspense fallback={<ViewSkeleton />}>
                  <DocumentsView
                    isActive={activeTab === 'documents'}
                    onEditorActiveChange={handleDocumentsEditorChange}
                  />
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
          onTabChange={handleTabChange}
          subjectCount={subjectCount}
          professorsCount={professorsCount}
          notesCount={notesCount}
          documentsCount={documentsCount}
        />
      )}
    </div>
  );
}

export default App;
