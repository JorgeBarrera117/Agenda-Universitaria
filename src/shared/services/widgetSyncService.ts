import { Capacitor } from '@capacitor/core';
import type { ScheduleSlot } from '../../features/schedule/types';
import { DAY_NAMES, SHORT_DAY_NAMES } from '../../features/schedule/types';
import type { Subject } from '../../features/subjects/types';
import type { Professor } from '../../features/professors/types';
import type { Note } from '../../features/notes/types';
import type { CustomPaletteSettings, MaterialColorTheme, ThemeMode } from '../../features/settings/types';
import { MATERIAL_COLOR_PALETTES, isValidCustomPalette } from '../utils/theme';
import { WidgetBridge } from '../plugins/widgetBridge';

export interface WidgetThemeTokens {
  isDark: boolean;
  palette: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  surface: string;
  cardBg: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
}

export class WidgetSyncService {
  private static lastWidgetHash = '';

  /**
   * Sincroniza el horario diario y semanal, apuntes recientes y el tema visual Material You con el Widget de Android
   */
  public static async syncWidgetData(
    slots: ScheduleSlot[],
    subjects: Subject[],
    professors: Professor[],
    notes: Note[],
    themeSettings?: { theme: ThemeMode; colorPalette: MaterialColorTheme; customPalette?: CustomPaletteSettings }
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    // Obtener configuración de tema (de argumentos o de localStorage como respaldo)
    let themeMode: ThemeMode = themeSettings?.theme || 'system';
    let paletteName: MaterialColorTheme = themeSettings?.colorPalette || 'default';
    let customPalette: CustomPaletteSettings | undefined = themeSettings?.customPalette;

    if (!themeSettings && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('agenda_universitaria_settings');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.theme) themeMode = parsed.theme;
          if (parsed.colorPalette) paletteName = parsed.colorPalette;
          if (parsed.customPalette) customPalette = parsed.customPalette;
        }
      } catch {
        // Fallback a valores por defecto
      }
    }

    const isDark =
      themeMode === 'dark' ||
      (themeMode === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    // La paleta propia (si es válida) también colorea el widget; si no, la predefinida o la default
    const paletteDef =
      paletteName === 'custom' && isValidCustomPalette(customPalette)
        ? customPalette
        : (paletteName !== 'custom' && MATERIAL_COLOR_PALETTES[paletteName]) || MATERIAL_COLOR_PALETTES.default;
    const tokens = isDark ? paletteDef.dark : paletteDef.light;

    const themePayload: WidgetThemeTokens = {
      isDark,
      palette: paletteName,
      primary: tokens.primary,
      onPrimary: tokens.onPrimary,
      primaryContainer: tokens.primaryContainer,
      onPrimaryContainer: tokens.onPrimaryContainer,
      secondaryContainer: tokens.secondaryContainer,
      onSecondaryContainer: tokens.onSecondaryContainer,
      surface: tokens.surface,
      cardBg: tokens.cardBg,
      surfaceContainer: tokens.surfaceContainer,
      surfaceContainerHigh: tokens.surfaceContainerHigh,
      onSurface: tokens.onSurface,
      onSurfaceVariant: tokens.onSurfaceVariant,
      outline: tokens.outline,
    };

    // Guard de rendimiento: Si el contenido ni el tema han variado, evitar serialización JSON y bridge IPC
    const todayDay = (() => {
      const d = new Date().getDay();
      return (d === 0 ? 7 : d); // 1 = Lunes ... 7 = Domingo
    })();

    const currentHash = `${todayDay}_${isDark ? 'dark' : 'light'}_${paletteName}_${slots.length}:${slots.map((s) => `${s.id}_${s.dayOfWeek}_${s.startTime}`).join(',')}|${subjects.length}:${subjects.map((s) => s.id).join(',')}|${professors.length}|${notes.length}:${notes.slice(0, 10).map((n) => `${n.id}_${n.updatedAt}`).join(',')}`;
    if (currentHash === this.lastWidgetHash) {
      return;
    }
    this.lastWidgetHash = currentHash;

    try {
      const subjectMap = new Map<string, Subject>();
      subjects.forEach((s) => subjectMap.set(s.id, s));

      const professorMap = new Map<string, Professor>();
      professors.forEach((p) => professorMap.set(p.id, p));

      // Orden de los días de la semana empezando por HOY
      const dayOrder = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
        let d = todayDay + offset;
        if (d > 7) d -= 7;
        return d;
      });

      // Ordenar todas las clases de la semana: primero las de hoy, luego las de días futuros
      const sortedSlots = [...slots].sort((a, b) => {
        const orderA = dayOrder.indexOf(a.dayOfWeek);
        const orderB = dayOrder.indexOf(b.dayOfWeek);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.startTime.localeCompare(b.startTime);
      });

      const scheduleData = sortedSlots.map((slot) => {
        const subject = subjectMap.get(slot.subjectId);
        const professorId = slot.professorId || subject?.professorId;
        const prof = professorId ? professorMap.get(professorId) : undefined;
        const isToday = slot.dayOfWeek === todayDay;

        const detailsParts: string[] = [];
        if (!isToday) {
          detailsParts.push(DAY_NAMES[slot.dayOfWeek]);
        }

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

        const badge = isToday
          ? 'HOY'
          : (SHORT_DAY_NAMES[slot.dayOfWeek] || 'CLASE').toUpperCase();

        return {
          id: slot.id,
          title: subject ? subject.name : 'Clase Universitaria',
          timeOrDate: `${slot.startTime} - ${slot.endTime}`,
          details: detailsParts.length > 0 ? detailsParts.join(' • ') : (isToday ? 'Clase de hoy' : DAY_NAMES[slot.dayOfWeek]),
          color: subject ? subject.color : '#3b82f6',
          badge,
          isToday,
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

          // Fragmento limpio de texto sin etiquetas HTML ni caracteres markdown (Truncado previo para proteger CPU)
          const snippetSource = note.content ? note.content.slice(0, 200) : '';
          const cleanSnippet = snippetSource
            .replace(/<[^>]*>/g, ' ')
            .replace(/[#*`_~>\-[\]\n\r]/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 50)
            .trim();

          const badge = subject && subject.name.length > 0
            ? subject.name.slice(0, 4).toUpperCase()
            : 'NOTA';

          return {
            id: note.id,
            title: note.title || 'Sin título',
            timeOrDate: dateStr,
            details: subject
              ? `${subject.name}${cleanSnippet ? ' • ' + cleanSnippet : ''}`
              : (cleanSnippet || 'Apunte universitario'),
            color: subject ? subject.color : '#10b981',
            badge,
            isToday: false,
          };
        });

      // Agrupar clases por cada día de la semana (1 = Lunes ... 7 = Domingo) para el Widget de Horario por Día
      const scheduleByDay: Record<number, any[]> = {};
      for (let dayNum = 1; dayNum <= 7; dayNum++) {
        const daySlots = slots
          .filter((s) => s.dayOfWeek === dayNum)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        scheduleByDay[dayNum] = daySlots.map((slot) => {
          const subject = subjectMap.get(slot.subjectId);
          const professorId = slot.professorId || subject?.professorId;
          const prof = professorId ? professorMap.get(professorId) : undefined;
          const isToday = dayNum === todayDay;

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

          const badge = isToday
            ? 'HOY'
            : (SHORT_DAY_NAMES[slot.dayOfWeek] || 'CLASE').toUpperCase();

          return {
            id: slot.id,
            title: subject ? subject.name : 'Clase Universitaria',
            timeOrDate: `${slot.startTime} - ${slot.endTime}`,
            details: detailsParts.length > 0 ? detailsParts.join(' • ') : (isToday ? 'Clase de hoy' : DAY_NAMES[slot.dayOfWeek]),
            color: subject ? subject.color : '#3b82f6',
            badge,
            isToday,
          };
        });
      }

      const payload = {
        theme: themePayload,
        schedule: scheduleData,
        notes: recentNotes,
        scheduleByDay,
      };

      await WidgetBridge.updateWidgetData({
        dataJson: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('Error al sincronizar con el Widget de Android:', err);
    }
  }
}
