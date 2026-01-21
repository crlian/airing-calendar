import type { EventContentArg } from "@fullcalendar/core";
import { DateTime } from "luxon";
import { AnimeEventPopover } from "./AnimeEventPopover";

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

export function AnimeEvent({ event, timeText, viewType, onRemove }: AnimeEventProps) {
  const animeData = event.extendedProps.animeData;
  const nextOccurrence = event.extendedProps.nextOccurrence;
  const isListView = viewType?.startsWith("list");

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
        <div className="anime-list-thumb">
          <img
            src={animeData.images.jpg.image_url}
            alt={displayTitle}
            loading="lazy"
          />
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
