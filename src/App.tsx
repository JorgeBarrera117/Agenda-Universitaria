import { useState, useEffect } from 'react';
import { Navbar, type TabType } from './shared/components/Navbar';
import { BottomNav } from './shared/components/BottomNav';
import { ScheduleView } from './features/schedule/components/ScheduleView';
import { SubjectsView } from './features/subjects/components/SubjectsView';
import { ProfessorsView } from './features/professors/components/ProfessorsView';
import { NotesView } from './features/notes/components/NotesView';
import { seedInitialDataIfEmpty } from './shared/db/AppDatabase';
import { useSubjects } from './features/subjects/hooks/useSubjects';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedSubjectForNotes, setSelectedSubjectForNotes] = useState<string | undefined>(undefined);

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

  // Atajo contextual UX: Tomar apunte de la clase activa en el horario
  const handleNavigateToNotesFromSchedule = (subjectId?: string) => {
    if (subjectId) {
      setSelectedSubjectForNotes(subjectId);
    }
    setActiveTab('notes');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col pb-22 md:pb-10 selection:bg-cove-blue selection:text-white">
      {/* Barra de navegación superior de Campus */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'notes') setSelectedSubjectForNotes(undefined);
          setActiveTab(tab);
        }}
        onShowToast={showToast}
        subjectCount={subjects.length}
      />

      {/* Notificación Toast Flotante */}
      {toastMessage && (
        <div className="fixed bottom-22 md:bottom-8 right-6 z-50 bg-cove-navy text-white px-5 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold border border-cove-sky/30 animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cove-gold" />
          {toastMessage}
        </div>
      )}

      {/* Contenedor Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'schedule' && (
          <ScheduleView onNavigateToNotes={handleNavigateToNotesFromSchedule} />
        )}
        {activeTab === 'subjects' && <SubjectsView />}
        {activeTab === 'professors' && <ProfessorsView />}
        {activeTab === 'notes' && (
          <NotesView initialSubjectFilterId={selectedSubjectForNotes} />
        )}
      </main>

      {/* Barra de navegación inferior ergonómica para teléfono */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'notes') setSelectedSubjectForNotes(undefined);
          setActiveTab(tab);
        }}
      />
    </div>
  );
}

export default App;
