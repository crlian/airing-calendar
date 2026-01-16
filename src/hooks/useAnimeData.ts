import { useMemo } from "react";
import type { AnimeData } from "@/types/anime";
import type { CalendarEvent } from "@/types/calendar";
import { parseBroadcastString, isValidBroadcast } from "@/lib/utils/parser";
import { convertJSTToLocal, getDateTimeForCurrentWeek, toISOString } from "@/lib/utils/timezone";

interface UseAnimeDataParams {
  selectedIds: number[];
  seasonalAnime: AnimeData[];
}

interface UseAnimeDataReturn {
  calendarEvents: CalendarEvent[];
  selectedAnimeList: AnimeData[];
}

export function useAnimeData({
  selectedIds,
  seasonalAnime,
}: UseAnimeDataParams): UseAnimeDataReturn {
  const selectedAnimeList = useMemo(() => {
    return seasonalAnime.filter((anime) => selectedIds.includes(anime.mal_id));
  }, [selectedIds, seasonalAnime]);

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

      // Get datetime for the current week
      const startDateTime = getDateTimeForCurrentWeek(
        localTime.localDay,
        localTime.localTime
      );

      if (!startDateTime) {
        console.warn(`Failed to get datetime for ${anime.title}`);
        continue;
      }

      // Assume 30-minute episodes
      const endDateTime = startDateTime.plus({ minutes: 30 });

      // Create calendar event
      const event: CalendarEvent = {
        id: `anime-${anime.mal_id}`,
        title: anime.title_english || anime.title,
        start: toISOString(startDateTime),
        end: toISOString(endDateTime),
        extendedProps: {
          animeData: anime,
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
