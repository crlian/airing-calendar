import type { EventContentArg } from "@fullcalendar/core";
import { AnimeEventPopover } from "./AnimeEventPopover";

interface AnimeEventProps {
  event: EventContentArg["event"];
  timeText?: string;
  onRemove: (id: number) => void;
}

export function AnimeEvent({ event, timeText, onRemove }: AnimeEventProps) {
  const animeData = event.extendedProps.animeData;
  const nextOccurrence = event.extendedProps.nextOccurrence;

  if (!animeData) {
    return (
      <div className="px-2 flex items-center h-full">
        <div className="text-xs font-medium truncate">{event.title}</div>
      </div>
    );
  }

  return (
    <AnimeEventPopover
      anime={animeData}
      nextOccurrence={nextOccurrence}
      onRemove={onRemove}
    >
      <div className="anime-event-card flex items-center gap-2 px-3 h-full w-full cursor-pointer hover:opacity-80 transition-opacity">
        <span className="anime-event-dot h-2 w-2 rounded-full flex-shrink-0" />
        <div className="min-w-0 flex-1 leading-tight">
          {timeText && (
            <div className="anime-event-time text-[10px] uppercase tracking-wide">
              {timeText}
            </div>
          )}
          <div className="text-xs font-semibold line-clamp-1">{event.title}</div>
        </div>
      </div>
    </AnimeEventPopover>
  );
}
