import type { EventContentArg } from "@fullcalendar/core";
import { AnimeEventPopover } from "./AnimeEventPopover";

interface AnimeEventProps {
  event: EventContentArg["event"];
}

export function AnimeEvent({ event }: AnimeEventProps) {
  const animeData = event.extendedProps.animeData;

  if (!animeData) {
    return (
      <div className="px-1 py-0.5">
        <div className="text-xs font-medium truncate">{event.title}</div>
      </div>
    );
  }

  return (
    <AnimeEventPopover anime={animeData}>
      <div className="flex items-center gap-2 px-1 py-0.5 cursor-pointer hover:opacity-80 transition-opacity h-full">
        <img
          src={animeData.images.jpg.small_image_url}
          alt={event.title}
          className="h-12 w-8 object-cover rounded border border-black/20 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium line-clamp-2">{event.title}</div>
        </div>
      </div>
    </AnimeEventPopover>
  );
}
