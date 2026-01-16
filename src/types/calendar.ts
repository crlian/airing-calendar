import type { AnimeData } from "./anime";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  extendedProps: {
    animeData: AnimeData;
  };
}

export interface LocalBroadcastTime {
  localDay: string;
  localTime: string;
  localDatetime: Date;
}
