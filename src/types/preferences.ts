export type TimeFormat = "24h" | "12h";

export interface CalendarPreferences {
  timeFormat: TimeFormat;
  weekStart: number; // 0 (Sunday) - 6 (Saturday)
  startHour: number; // 0 - 23
}
