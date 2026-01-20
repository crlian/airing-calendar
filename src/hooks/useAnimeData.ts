import { useMemo } from "react";
import type { AnimeData } from "@/types/anime";
import type { CalendarEvent } from "@/types/calendar";
import { parseBroadcastString, isValidBroadcast } from "@/lib/utils/parser";
import { convertJSTToLocal } from "@/lib/utils/timezone";

interface UseAnimeDataParams {
  selectedIds: number[];
  animeList: AnimeData[];
}

interface UseAnimeDataReturn {
  calendarEvents: CalendarEvent[];
  selectedAnimeList: AnimeData[];
}

const DAY_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export function useAnimeData({
  selectedIds,
  animeList,
}: UseAnimeDataParams): UseAnimeDataReturn {
  const animeById = useMemo(() => {
    return new Map(animeList.map((anime) => [anime.mal_id, anime]));
  }, [animeList]);

  const selectedAnimeList = useMemo(() => {
    return selectedIds
      .map((id) => animeById.get(id))
      .filter((anime): anime is AnimeData => Boolean(anime));
  }, [selectedIds, animeById]);

  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    for (const anime of selectedAnimeList) {
      // Skip anime without broadcast info
      if (!anime.broadcast?.string) {
        console.warn(`Anime ${anime.title} has no broadcast information`);
        continue;
      }

      // Parse the broadcast string
      const parsed = parseBroadcastString(anime.broadcast.string);
      if (!isValidBroadcast(parsed)) {
        console.warn(`Failed to parse broadcast for ${anime.title}: ${anime.broadcast.string}`);
        continue;
      }

      // Convert JST to local timezone
      const localTime = convertJSTToLocal(parsed.day, parsed.time);
      if (!localTime) {
        console.warn(`Failed to convert timezone for ${anime.title}`);
        continue;
      }

      const dayIndex = DAY_TO_INDEX[localTime.localDay];
      if (dayIndex === undefined) {
        console.warn(`Invalid local day for ${anime.title}: ${localTime.localDay}`);
        continue;
      }

      // Create calendar event
      const event: CalendarEvent = {
        id: `anime-${anime.mal_id}`,
        title: anime.title_english || anime.title,
        daysOfWeek: [dayIndex],
        startTime: localTime.localTime,
        duration: "00:30",
        extendedProps: {
          animeData: anime,
          localDay: localTime.localDay,
          localTime: localTime.localTime,
          nextOccurrence: localTime.localDatetime,
        },
      };

      events.push(event);
    }

    return events;
  }, [selectedAnimeList]);

  return {
    calendarEvents,
    selectedAnimeList,
  };
}
