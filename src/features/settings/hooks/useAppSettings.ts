import { useState, useEffect } from 'react';
import { DEFAULT_SETTINGS, type AppSettings } from '../types';

const SETTINGS_STORAGE_KEY = 'agenda_universitaria_settings';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Error reading settings from localStorage:', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [storageEstimate, setStorageEstimate] = useState<{
    usedMB: number;
    quotaMB: number;
    percent: number;
  }>({ usedMB: 0, quotaMB: 0, percent: 0 });

  // Guardar en localStorage ante cambios y notificar a todas las instancias
  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(
          new CustomEvent('agenda_settings_updated', { detail: updated })
        );
      } catch (e) {
        console.error('Error saving settings to localStorage:', e);
      }
      return updated;
    });
  };

  // Escuchar actualizaciones reactivas entre componentes y pestañas
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<AppSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        try {
          const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
          if (stored) {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
          }
        } catch (err) {
          console.warn('Error reading updated settings from localStorage:', err);
        }
      }
    };

    window.addEventListener('agenda_settings_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('agenda_settings_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Calcular uso real del almacenamiento IndexedDB
  const refreshStorageEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = (estimate.usage || 0) / (1024 * 1024);
        const quota = (estimate.quota || 0) / (1024 * 1024);
        const percent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
        setStorageEstimate({
          usedMB: Number(used.toFixed(2)),
          quotaMB: Number(quota.toFixed(0)),
          percent,
        });
      } catch (e) {
        console.warn('Could not estimate storage:', e);
      }
    }
  };

  useEffect(() => {
    refreshStorageEstimate();
  }, []);

  return {
    settings,
    updateSettings,
    storageEstimate,
    refreshStorageEstimate,
  };
}
