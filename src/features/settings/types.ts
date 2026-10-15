export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  semesterName: string;
  defaultScheduleView: 'weekly' | 'daily';
  imageQuality: 'balanced' | 'high';
  visibleDays: 'mon-fri' | 'mon-sat' | 'all';
  // Notificaciones y Recordatorios de Cátedras
  notificationsEnabled: boolean;
  notifyAtClassStart: boolean;
  notify15MinBefore: boolean;
  notificationSound: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  semesterName: 'Semestre 2026-I',
  defaultScheduleView: 'weekly',
  imageQuality: 'balanced',
  visibleDays: 'mon-fri',
  notificationsEnabled: true,
  notifyAtClassStart: true,
  notify15MinBefore: true,
  notificationSound: true,
};


