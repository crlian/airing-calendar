import type { EventContentArg } from "@fullcalendar/core";
import { DateTime } from "luxon";
import { AnimeEventPopover } from "./AnimeEventPopover";
import { LiveBadge } from "@/components/LiveBadge";

interface AnimeEventProps {
  event: EventContentArg["event"];
  timeText?: string;
  viewType?: string;
  onRemove: (id: number) => void;
}

const buildTimeLabel = (date: Date | null | undefined) => {
  if (!date) return null;
  return DateTime.fromJSDate(date).toFormat("ccc • HH:mm");
};

/**
 * Simple check if event is airing now based on calendar time
 * Uses the event's start/end times from FullCalendar (which are already in local timezone)
 */
function checkIfAiring(eventStart: Date | null, eventEnd: Date | null): boolean {
  if (!eventStart || !eventEnd) return false;
  
  const now = DateTime.now();
  const start = DateTime.fromJSDate(eventStart);
  const end = DateTime.fromJSDate(eventEnd);
  
  // Check if it's the same day and within time range
  return now.hasSame(start, 'day') && now >= start && now <= end;
}

export function AnimeEvent({ event, timeText: _timeText, viewType, onRemove }: AnimeEventProps) {
  const animeData = event.extendedProps.animeData;
  const nextOccurrence = event.extendedProps.nextOccurrence;
  const isListView = viewType?.startsWith("list");

  // Check if anime is currently airing using FullCalendar's event times (already in local timezone)
  const airing = checkIfAiring(event.start, event.end);

  if (!animeData) {
    return (
      <div className="px-2 flex items-center h-full">
        <div className="text-xs font-medium truncate">{event.title}</div>
      </div>
    );
  }

  if (isListView) {
    const listTimeLabel = buildTimeLabel(event.start) ?? buildTimeLabel(nextOccurrence);
    const displayTitle = animeData.title_english || animeData.title;
    return (
      <div className="anime-list-card">
        <div className="anime-list-thumb relative">
          <img
            src={animeData.images.jpg.image_url}
            alt={displayTitle}
            loading="lazy"
          />
          {airing && (
            <div className="absolute -top-1 -right-1">
              <LiveBadge className="scale-75" />
            </div>
          )}
        </div>
        <div className="anime-list-body">
          <div className="anime-list-title">{displayTitle}</div>
          {animeData.title && animeData.title !== displayTitle && (
            <div className="anime-list-subtitle">({animeData.title})</div>
          )}
          <div className="anime-list-meta">
            {listTimeLabel && <span>{listTimeLabel}</span>}
            {animeData.score && (
              <span className="anime-list-score">★ {animeData.score}</span>
            )}
            {airing && <LiveBadge className="ml-1 scale-75" />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimeEventPopover
      anime={animeData}
      nextOccurrence={nextOccurrence}
      onRemove={onRemove}
    >
      <div className="anime-event-card flex items-center gap-1 h-full w-full cursor-pointer hover:bg-gray-50 px-1 py-0.5">
        <span className="anime-event-dot h-2 w-2 rounded-full flex-shrink-0" />
        <span className="text-[11px] font-semibold text-black truncate">{event.title}</span>
      </div>
    </AnimeEventPopover>
  );
}
