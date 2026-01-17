import type { EventContentArg } from "@fullcalendar/core";
import { AnimeEventPopover } from "./AnimeEventPopover";

interface AnimeEventProps {
  event: EventContentArg["event"];
}

export function AnimeEvent({ event }: AnimeEventProps) {
  const animeData = event.extendedProps.animeData;

  if (!animeData) {
    return (
      <div className="px-2 flex items-center h-full">
        <div className="text-xs font-medium truncate">{event.title}</div>
      </div>
    );
  }

  return (
    <AnimeEventPopover anime={animeData}>
      <div className="flex items-center gap-2 px-2 h-full cursor-pointer hover:opacity-80 transition-opacity">
        <span className="h-2 w-2 rounded-full bg-white/80 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium line-clamp-1">{event.title}</div>
        </div>
      </div>
    </AnimeEventPopover>
  );
}
