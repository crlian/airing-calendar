import type { AnimeData } from "./anime";

export interface CalendarEvent {
  id: string;
  title: string;
  start?: string; // ISO datetime
  end?: string; // ISO datetime
  daysOfWeek?: number[]; // 0 (Sun) - 6 (Sat)
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  duration?: string; // HH:mm or HH:mm:ss
  extendedProps: {
    animeData: AnimeData;
  };
}

export interface LocalBroadcastTime {
  localDay: string;
  localTime: string;
  localDatetime: Date;
}
