/** "45 min", "1 h", "1 h 05 min" o "menos de 1 min". */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 1) return 'menos de 1 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')} min`;
}
