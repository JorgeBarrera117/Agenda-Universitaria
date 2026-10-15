import { useState, useEffect } from 'react';
import { Navbar, type TabType } from './shared/components/Navbar';
import { BottomNav } from './shared/components/BottomNav';
import { ScheduleView } from './features/schedule/components/ScheduleView';
import { SubjectsView } from './features/subjects/components/SubjectsView';
import { ProfessorsView } from './features/professors/components/ProfessorsView';
import { NotesView } from './features/notes/components/NotesView';
import { SettingsModal } from './features/settings/components/SettingsModal';
import { seedInitialDataIfEmpty } from './shared/db/AppDatabase';
import { useSubjects } from './features/subjects/hooks/useSubjects';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedSubjectForNotes, setSelectedSubjectForNotes] = useState<string | undefined>(undefined);
  const [isNoteEditorActive, setIsNoteEditorActive] = useState(false);

  const { subjects } = useSubjects();

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
  }, []);

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
    setActiveTab(tab);
  };

  // Atajo contextual UX: Tomar apunte de la clase activa en el horario
  const handleNavigateToNotesFromSchedule = (subjectId?: string) => {
    if (subjectId) {
      setSelectedSubjectForNotes(subjectId);
    }
    setActiveTab('notes');
  };

  return (
    <div
      className={`min-h-screen bg-slate-100/70 text-slate-900 flex flex-col selection:bg-cove-blue selection:text-white transition-all ${
        isNoteEditorActive ? 'pb-4' : 'pb-22 md:pb-10'
      }`}
    >
      {/* Barra de navegación superior de Campus (Oculta al crear/editar apuntes) */}
      {!isNoteEditorActive && (
        <Navbar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenSettings={() => setIsSettingsOpen(true)}
          subjectCount={subjects.length}
        />
      )}

      {/* Modal de Configuración (Opción A) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onShowToast={showToast}
      />

      {/* Notificación Toast Flotante */}
      {toastMessage && (
        <div
          className={`fixed right-6 z-50 bg-cove-navy text-white px-5 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold border border-cove-sky/30 animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2 ${
            isNoteEditorActive ? 'bottom-6' : 'bottom-22 md:bottom-8'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cove-gold" />
          {toastMessage}
        </div>
      )}

      {/* Contenedor Principal */}
      <main
        className={`flex-1 max-w-7xl w-full mx-auto ${
          isNoteEditorActive ? 'px-3 sm:px-6 lg:px-8 pt-1 sm:pt-3' : 'px-4 sm:px-6 lg:px-8 pt-6'
        }`}
      >
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
      </main>

      {/* Barra de navegación inferior ergonómica para teléfono (Oculta al crear/editar apuntes) */}
      {!isNoteEditorActive && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}
    </div>
  );
}

export default App;
