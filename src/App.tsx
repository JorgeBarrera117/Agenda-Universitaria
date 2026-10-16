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
import { SettingsView } from './features/settings/components/SettingsView';
import { seedInitialDataIfEmpty } from './shared/db/AppDatabase';
import { useSubjects } from './features/subjects/hooks/useSubjects';
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
  const [isNoteEditorActive, setIsNoteEditorActive] = useState(false);

  const { subjects } = useSubjects();
  const { slots } = useSchedule();
  const { professors } = useProfessors();
  const { notes } = useNotes();
  const { settings } = useAppSettings();

  // Sincronizar tema de apariencia (claro, oscuro o sistema)
  useEffect(() => {
    applyTheme(settings.theme);
    const cleanup = setupSystemThemeListener(settings.theme, () => {
      applyTheme('system');
    });
    return cleanup;
  }, [settings.theme]);


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

  // Sincronizar automáticamente recordatorios locales al cambiar materias, horarios o configuración
  useEffect(() => {
    if (settings.notificationsEnabled && slots.length > 0) {
      NotificationService.syncScheduleNotifications(slots, subjects, settings).catch(console.warn);
    }
  }, [
    slots,
    subjects,
    settings.notificationsEnabled,
    settings.notify15MinBefore,
    settings.notifyAtClassStart,
    settings.notificationSound,
  ]);

  // Sincronizar automáticamente el Widget de la Pantalla de Inicio de Android (Horario y Apuntes)
  useEffect(() => {
    WidgetSyncService.syncWidgetData(slots, subjects, professors, notes).catch(console.warn);
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
      setIsNoteEditorActive(false);
    }
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
      className={`min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-cove-blue selection:text-white transition-colors duration-200 ${
        isNoteEditorActive || isSettingsOpen ? 'pb-4' : 'pb-22 md:pb-10'
      }`}
    >

      {/* Barra de navegación superior de Campus (Oculta al crear apuntes o en Ajustes) */}
      {!isNoteEditorActive && !isSettingsOpen && (
        <Navbar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenSettings={() => setIsSettingsOpen(true)}
          subjectCount={subjects.length}
        />
      )}

      {/* Notificación Toast Flotante */}
      {toastMessage && (
        <div
          className={`fixed right-6 z-50 bg-cove-navy text-white px-5 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold border border-cove-sky/30 animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2 ${
            isNoteEditorActive || isSettingsOpen ? 'bottom-6' : 'bottom-22 md:bottom-8'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cove-gold" />
          {toastMessage}
        </div>
      )}

      {/* Contenedor Principal */}
      <main
        className={`flex-1 max-w-[1750px] w-full mx-auto ${
          isNoteEditorActive || isSettingsOpen
            ? 'px-3 sm:px-6 lg:px-8 pt-1 sm:pt-3'
            : 'px-4 sm:px-6 lg:px-8 2xl:px-10 pt-6'
        }`}
      >
        {isSettingsOpen ? (
          <SettingsView
            onBack={() => setIsSettingsOpen(false)}
            onShowToast={showToast}
          />
        ) : (
          <>
            {activeTab === 'schedule' && (
              <ScheduleView onNavigateToNotes={handleNavigateToNotesFromSchedule} />
            )}
            {activeTab === 'subjects' && (
              <SubjectsView onNavigateToNotes={handleNavigateToNotesFromSchedule} />
            )}
            {activeTab === 'professors' && <ProfessorsView />}
            {activeTab === 'notes' && (
              <NotesView
                initialSubjectFilterId={selectedSubjectForNotes}
                onEditorActiveChange={setIsNoteEditorActive}
              />
            )}
          </>
        )}
      </main>

      {/* Barra de navegación inferior ergonómica para teléfono (Oculta al crear apuntes o en Ajustes) */}
      {!isNoteEditorActive && !isSettingsOpen && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </div>
  );
}

export default App;
