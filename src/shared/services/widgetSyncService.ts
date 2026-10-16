import { registerPlugin, Capacitor } from '@capacitor/core';
import type { ScheduleSlot } from '../../features/schedule/types';
import type { Subject } from '../../features/subjects/types';
import type { Professor } from '../../features/professors/types';
import type { Note } from '../../features/notes/types';

interface WidgetBridgePlugin {
  updateWidgetData(options: { dataJson: string }): Promise<{ success: boolean }>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export class WidgetSyncService {
  /**
   * Sincroniza las clases de hoy y los apuntes más recientes con el Widget de Android
   */
  public static async syncWidgetData(
    slots: ScheduleSlot[],
    subjects: Subject[],
    professors: Professor[],
    notes: Note[]
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const todayDay = (() => {
        const d = new Date().getDay();
        return (d === 0 ? 7 : d); // 1 = Lunes ... 7 = Domingo
      })();

      const subjectMap = new Map<string, Subject>();
      subjects.forEach((s) => subjectMap.set(s.id, s));

      const professorMap = new Map<string, Professor>();
      professors.forEach((p) => professorMap.set(p.id, p));

      // Filtrar y ordenar clases de hoy
      const todaySlots = slots
        .filter((slot) => slot.dayOfWeek === todayDay)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      const scheduleData = todaySlots.map((slot) => {
        const subject = subjectMap.get(slot.subjectId);
        const professorId = slot.professorId || subject?.professorId;
        const prof = professorId ? professorMap.get(professorId) : undefined;

        const detailsParts: string[] = [];
        if (slot.classroom) {
          detailsParts.push(`Aula ${slot.classroom}`);
        } else if (slot.building) {
          detailsParts.push(slot.building);
        } else if (subject?.classroomDefault) {
          detailsParts.push(`Aula ${subject.classroomDefault}`);
        }

        if (prof) {
          detailsParts.push(prof.name);
        }

        return {
          id: slot.id,
          subjectName: subject ? subject.name : 'Clase Universitaria',
          subjectColor: subject ? subject.color : '#3b82f6',
          time: `${slot.startTime} - ${slot.endTime}`,
          details: detailsParts.length > 0 ? detailsParts.join(' • ') : 'Campus Universitario',
        };
      });

      // Ordenar apuntes por última modificación (más recientes primero)
      const recentNotes = [...notes]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 20)
        .map((note) => {
          const subject = note.subjectId ? subjectMap.get(note.subjectId) : undefined;
          const dateObj = new Date(note.updatedAt);
          const dateStr = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

          // Fragmento limpio de texto sin etiquetas HTML ni markdown
          const cleanSnippet = note.content
            ? note.content.replace(/[#*`_~>\-[\]]/g, '').slice(0, 60).trim()
            : '';

          return {
            id: note.id,
            title: note.title || 'Sin título',
            subjectName: subject ? subject.name : 'General',
            subjectColor: subject ? subject.color : '#10b981',
            date: dateStr,
            details: subject
              ? `${subject.name}${cleanSnippet ? ' • ' + cleanSnippet : ''}`
              : `Apunte${cleanSnippet ? ' • ' + cleanSnippet : ''}`,
          };
        });

      const payload = {
        schedule: scheduleData,
        notes: recentNotes,
      };

      await WidgetBridge.updateWidgetData({
        dataJson: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('Error al sincronizar con el Widget de Android:', err);
    }
  }
}
