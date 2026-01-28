const DEFAULT_EPISODE_MINUTES = 24;

export const getEpisodeMinutes = (value?: string | null): number => {
  if (!value) return DEFAULT_EPISODE_MINUTES;

  const normalized = value.toLowerCase();
  const hoursMatch = normalized.match(/(\d+)\s*hr/);
  const minutesMatch = normalized.match(/(\d+)\s*min/);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;

  if (Number.isNaN(hours) || Number.isNaN(minutes) || (hours === 0 && minutes === 0)) {
    return DEFAULT_EPISODE_MINUTES;
  }

  return hours * 60 + minutes;
};

export const formatMinutes = (totalMinutes: number): string => {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};
