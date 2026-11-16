import { useMemo } from 'react';
import { formatClockTime, formatTimeRange } from '../../../shared/utils/timeFormat';
import { useAppSettings } from './useAppSettings';

/** Formateadores de hora según Ajustes → General (24 h o 12 h); se actualizan al cambiar el ajuste. */
export function useTimeFormatter() {
  const { settings } = useAppSettings();
  const format = settings.timeFormat ?? '24h';
  return useMemo(
    () => ({
      format,
      time: (time: string) => formatClockTime(time, format),
      range: (start: string, end: string, separator?: string) => formatTimeRange(start, end, format, separator),
    }),
    [format]
  );
}
