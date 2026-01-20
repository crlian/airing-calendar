import type { CalendarPreferences, TimeFormat } from "@/types/preferences";

const STORAGE_KEY = "anime-calendar:calendar-preferences";

const DEFAULT_PREFERENCES: CalendarPreferences = {
  timeFormat: "24h",
  weekStart: 1,
  startHour: 8,
};

const isValidTimeFormat = (value: unknown): value is TimeFormat =>
  value === "24h" || value === "12h";

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const sanitizePreferences = (
  preferences: Partial<CalendarPreferences> | null
): CalendarPreferences => {
  if (!preferences) return DEFAULT_PREFERENCES;

  const timeFormat = isValidTimeFormat(preferences.timeFormat)
    ? preferences.timeFormat
    : DEFAULT_PREFERENCES.timeFormat;
  const weekStart = Number.isFinite(preferences.weekStart)
    ? clampNumber(preferences.weekStart as number, 0, 6)
    : DEFAULT_PREFERENCES.weekStart;
  const startHour = Number.isFinite(preferences.startHour)
    ? clampNumber(preferences.startHour as number, 0, 23)
    : DEFAULT_PREFERENCES.startHour;

  return { timeFormat, weekStart, startHour };
};

export const CalendarPreferencesStorage = {
  getPreferences(): CalendarPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_PREFERENCES;

      const parsed = JSON.parse(stored);
      if (typeof parsed !== "object" || parsed === null) {
        return DEFAULT_PREFERENCES;
      }

      return sanitizePreferences(parsed as Partial<CalendarPreferences>);
    } catch (error) {
      console.error("Error reading calendar preferences:", error);
      return DEFAULT_PREFERENCES;
    }
  },

  setPreferences(preferences: CalendarPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Error saving calendar preferences:", error);
    }
  },
};
