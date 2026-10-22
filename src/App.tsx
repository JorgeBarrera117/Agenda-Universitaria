/**
 * ==============================================================================
 * Agenda Universitaria PWA
 * ==============================================================================
 * App desarrollada por Jorge I. Barrera V.
 * Eslogan: "POR Y PARA LOS ESTUDIANTES"
 * ==============================================================================
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar, type TabType } from './shared/components/Navbar';
import { BottomNav } from './shared/components/BottomNav';
import { ContextualToast } from './shared/components/ContextualToast';
import { ScheduleView } from './features/schedule/components/ScheduleView';
import { SubjectsView } from './features/subjects/components/SubjectsView';
import { ProfessorsView } from './features/professors/components/ProfessorsView';
import { NotesView } from './features/notes/components/NotesView';
import { DocumentsView } from './features/documents/components/DocumentsView';
import { SettingsView } from './features/settings/components/SettingsView';
import { seedInitialDataIfEmpty } from './shared/db/AppDatabase';
import { useSubjects } from './features/subjects/hooks/useSubjects';
import { useSubjectDocuments } from './features/subjects/hooks/useSubjectDocuments';
import { useSchedule } from './features/schedule/hooks/useSchedule';
import { useProfessors } from './features/professors/hooks/useProfessors';
import { useNotes } from './features/notes/hooks/useNotes';
import { useAppSettings } from './features/settings/hooks/useAppSettings';
import { NotificationService } from './shared/services/notificationService';
import { applyTheme, setupSystemThemeListener } from './shared/utils/theme';
import { useBackButton, BACK_PRIORITY } from './shared/hooks/useBackButton';
import { useSwipeNavigation } from './shared/hooks/useSwipeNavigation';
import { backButtonManager } from './shared/services/backButtonManager';
import { WidgetSyncService } from './shared/services/widgetSyncService';

const TAB_ORDER: TabType[] = ['schedule', 'subjects', 'professors', 'notes', 'documents'];

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
  const handleNotesEditorChange = useCallback(
    (active: boolean) => handleEditorActiveChange('notes', active),
    [handleEditorActiveChange]
  );

  const isAnyEditorActive = activeEditorTab === activeTab;

  const { subjects } = useSubjects();
  const { slots } = useSchedule();
  const { professors } = useProfessors();
  const { notes } = useNotes();
  const { documents: allDocuments } = useSubjectDocuments();
  const { settings } = useAppSettings();

  // Sincronizar tema de apariencia (claro, oscuro o sistema) y paleta dinámica Material You
  useEffect(() => {
    applyTheme(settings.theme, settings.colorPalette);
    const cleanup = setupSystemThemeListener(settings.theme, settings.colorPalette, () => {
      applyTheme('system', settings.colorPalette);
    });
    return cleanup;
  }, [settings.theme, settings.colorPalette]);


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

    // Inicializar canal de notificaciones nativas en Android
    NotificationService.init().catch(console.warn);

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

  // Sincronizar automáticamente recordatorios locales (con debounce de 600ms para agrupar cargas reactivas)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (settings.notificationsEnabled && slots.length > 0) {
        NotificationService.syncScheduleNotifications(slots, subjects, settings).catch(console.warn);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [
    slots,
    subjects,
    settings.notificationsEnabled,
    settings.notify15MinBefore,
    settings.notifyAtClassStart,
    settings.notificationSound,
  ]);

  // Sincronizar automáticamente el Widget de la Pantalla de Inicio de Android (con debounce de 600ms para optimizar CPU y batería)
  useEffect(() => {
    const timer = setTimeout(() => {
      WidgetSyncService.syncWidgetData(slots, subjects, professors, notes).catch(console.warn);
    }, 600);
    return () => clearTimeout(timer);
  }, [slots, subjects, professors, notes]);

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
      className={`min-h-screen bg-[var(--color-md-surface)] text-[var(--color-md-on-surface)] flex flex-col selection:bg-[var(--color-md-primary-container)] selection:text-[var(--color-md-on-primary-container)] transition-colors duration-200 ${
        isAnyEditorActive && activeTab === 'notes'
          ? 'pb-0'
          : isAnyEditorActive || isSettingsOpen
            ? 'pb-4'
            : 'pb-22 md:pb-10'
      }`}
    >

      {/* Barra de navegación superior de Campus (Oculta al crear apuntes, formularios o en Ajustes) */}
      {!isAnyEditorActive && !isSettingsOpen && (
        <Navbar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenSettings={() => setIsSettingsOpen(true)}
          subjectCount={subjects.length}
          documentsCount={allDocuments.length}
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
        className={`flex-1 flex flex-col w-full mx-auto overflow-x-hidden touch-pan-y ${
          isAnyEditorActive && activeTab === 'notes'
            ? 'p-0'
            : isAnyEditorActive || isSettingsOpen
              ? 'px-3 sm:px-6 lg:px-8 2xl:px-10 pt-1 sm:pt-3'
              : 'px-3 sm:px-6 lg:px-8 2xl:px-10 pt-3 sm:pt-5 pb-36 sm:pb-32 md:pb-8'
        }`}
      >
        {isSettingsOpen ? (
          <div className="m3-view-enter flex-1">
            <SettingsView
              onBack={() => setIsSettingsOpen(false)}
              onShowToast={showToast}
            />
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
              <SubjectsView
                onNavigateToNotes={handleNavigateToNotesFromSchedule}
                onEditorActiveChange={handleSubjectsEditorChange}
                isActive={activeTab === 'subjects'}
              />
            </div>
            <div className={activeTab === 'professors' ? tabEnterClass : 'hidden'}>
              <ProfessorsView
                onEditorActiveChange={handleProfessorsEditorChange}
                isActive={activeTab === 'professors'}
              />
            </div>
            <div className={activeTab === 'notes' ? tabEnterClass : 'hidden'}>
              <NotesView
                initialSubjectFilterId={selectedSubjectForNotes}
                onEditorActiveChange={handleNotesEditorChange}
                isActive={activeTab === 'notes'}
              />
            </div>
            <div className={activeTab === 'documents' ? tabEnterClass : 'hidden'}>
              <DocumentsView isActive={activeTab === 'documents'} />
            </div>
          </div>
        )}
      </main>

      {/* Barra de navegación inferior ergonómica para teléfono (Oculta al crear apuntes, formularios o en Ajustes) */}
      {!isAnyEditorActive && !isSettingsOpen && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          subjectCount={subjects.length}
          documentsCount={allDocuments.length}
        />
      )}
    </div>
  );
}

export default App;
