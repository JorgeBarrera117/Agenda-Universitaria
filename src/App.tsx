/**
 * ==============================================================================
 * Agenda Universitaria PWA
 * ==============================================================================
 * App desarrollada por Jorge I. Barrera V.
 * Eslogan: "POR Y PARA LOS ESTUDIANTES"
 * ==============================================================================
 */
import { useState, useEffect } from 'react';
import { Navbar, type TabType } from './shared/components/Navbar';
import { BottomNav } from './shared/components/BottomNav';
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
import { backButtonManager } from './shared/services/backButtonManager';
import { WidgetSyncService } from './shared/services/widgetSyncService';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedSubjectForNotes, setSelectedSubjectForNotes] = useState<string | undefined>(undefined);
  const [activeEditorTab, setActiveEditorTab] = useState<TabType | null>(null);

  const handleEditorActiveChange = (tab: TabType, isActive: boolean) => {
    if (isActive) {
      setActiveEditorTab(tab);
    } else if (activeEditorTab === tab) {
      setActiveEditorTab(null);
    }
  };

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
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleTabChange = (tab: TabType) => {
    if (tab !== 'notes') {
      setSelectedSubjectForNotes(undefined);
    }
    setActiveEditorTab(null);
    setIsSettingsOpen(false);
    setActiveTab(tab);
  };

  // Atajo contextual UX: Tomar apunte de la clase activa en el horario
  const handleNavigateToNotesFromSchedule = (subjectId?: string) => {
    if (subjectId) {
      setSelectedSubjectForNotes(subjectId);
    }
    setIsSettingsOpen(false);
    setActiveTab('notes');
  };

  return (
    <div
      className={`min-h-screen bg-[var(--color-md-surface)] text-[var(--color-md-on-surface)] flex flex-col selection:bg-[var(--color-md-primary-container)] selection:text-[var(--color-md-on-primary-container)] transition-colors duration-200 ${
        isAnyEditorActive || isSettingsOpen ? 'pb-4' : 'pb-22 md:pb-10'
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

      {/* Notificación Toast Flotante */}
      {toastMessage && (
        <div
          className={`fixed right-6 z-50 bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)] px-5 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold border border-[var(--color-md-outline-variant)] animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2 ${
            isAnyEditorActive || isSettingsOpen ? 'bottom-6' : 'bottom-24 md:bottom-8'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cove-gold" />
          {toastMessage}
        </div>
      )}

      {/* Contenedor Principal (100% del ancho disponible en PC y Móvil) */}
      <main
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
        className={`flex-1 w-full mx-auto ${
          isAnyEditorActive || isSettingsOpen
            ? 'px-3 sm:px-6 lg:px-8 2xl:px-10 pt-1 sm:pt-3'
            : 'px-3 sm:px-6 lg:px-8 2xl:px-10 pt-3 sm:pt-5 pb-36 sm:pb-32 md:pb-8'
        }`}
      >
        {isSettingsOpen ? (
          <SettingsView
            onBack={() => setIsSettingsOpen(false)}
            onShowToast={showToast}
          />
        ) : (
          <div className="w-full">
            <div className={activeTab === 'schedule' ? 'block animate-in fade-in duration-150' : 'hidden'}>
              <ScheduleView
                onNavigateToNotes={handleNavigateToNotesFromSchedule}
                onEditorActiveChange={(active) => handleEditorActiveChange('schedule', active)}
                isActive={activeTab === 'schedule'}
              />
            </div>
            <div className={activeTab === 'subjects' ? 'block animate-in fade-in duration-150' : 'hidden'}>
              <SubjectsView
                onNavigateToNotes={handleNavigateToNotesFromSchedule}
                onEditorActiveChange={(active) => handleEditorActiveChange('subjects', active)}
                isActive={activeTab === 'subjects'}
              />
            </div>
            <div className={activeTab === 'professors' ? 'block animate-in fade-in duration-150' : 'hidden'}>
              <ProfessorsView
                onEditorActiveChange={(active) => handleEditorActiveChange('professors', active)}
                isActive={activeTab === 'professors'}
              />
            </div>
            <div className={activeTab === 'notes' ? 'block animate-in fade-in duration-150' : 'hidden'}>
              <NotesView
                initialSubjectFilterId={selectedSubjectForNotes}
                onEditorActiveChange={(active) => handleEditorActiveChange('notes', active)}
                isActive={activeTab === 'notes'}
              />
            </div>
            <div className={activeTab === 'documents' ? 'block animate-in fade-in duration-150' : 'hidden'}>
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
