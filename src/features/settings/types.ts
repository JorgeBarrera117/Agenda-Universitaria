export interface AppSettings {
  semesterName: string;
  defaultScheduleView: 'weekly' | 'daily';
  imageQuality: 'balanced' | 'high';
  visibleDays: 'mon-fri' | 'mon-sat' | 'all';
}

export const DEFAULT_SETTINGS: AppSettings = {
  semesterName: 'Semestre 2026-I',
  defaultScheduleView: 'weekly',
  imageQuality: 'balanced',
  visibleDays: 'mon-fri',
};
