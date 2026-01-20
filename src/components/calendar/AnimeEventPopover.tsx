import { useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AnimeData } from "@/types/anime";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DateTime } from "luxon";

interface AnimeEventPopoverProps {
  anime: AnimeData;
  children: ReactNode;
  nextOccurrence?: Date;
  onRemove: (id: number) => void;
}

export function AnimeEventPopover({
  anime,
  children,
  nextOccurrence,
  onRemove,
}: AnimeEventPopoverProps) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 50);
  };

  const displayTitle = anime.title_english || anime.title;
  const synopsis = anime.synopsis
    ? anime.synopsis.length > 200
      ? anime.synopsis.substring(0, 200) + "..."
      : anime.synopsis
    : "No synopsis available";
  const broadcastLabel = (() => {
    const raw = anime.broadcast?.string;
    if (!raw) return null;
    const match = raw.match(/^(\w+)s?\s+at\s+(\d{1,2}:\d{2})\s+\(([^)]+)\)/i);
    if (!match) return raw;
    const [, day, time, tz] = match;
    const normalizedDay = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
    return `${normalizedDay} • ${time} ${tz}`;
  })();
  const nextEpisodeLabel = nextOccurrence
    ? DateTime.fromJSDate(nextOccurrence).toFormat("ccc, LLL dd • HH:mm")
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={() => {
            clearCloseTimeout();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 overflow-hidden"
        onMouseEnter={() => {
          clearCloseTimeout();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
      >
        <div className="relative h-[360px]">
          <img
            src={anime.images.jpg.large_image_url}
            alt={displayTitle}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/45 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.35)_25%,rgba(0,0,0,0)_55%)]" />

          <div className="absolute inset-0 flex flex-col gap-3 p-4 text-white">
            <div className="space-y-2 rounded-md border border-white/10 bg-black/40 p-2 backdrop-blur-[10px]">
              <h3 className="font-display font-semibold text-lg leading-tight">
                {displayTitle}
              </h3>
              {broadcastLabel && (
                <div className="text-xs text-white/85">
                  {broadcastLabel}
                </div>
              )}
              {nextEpisodeLabel && (
                <div className="text-xs text-white/85">
                  Next episode • {nextEpisodeLabel}
                </div>
              )}
            </div>

            <div className="rounded-md bg-black/55 p-2 text-sm text-white/85 leading-relaxed">
              {synopsis}
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 text-sm text-white/90">
              {anime.score && (
                <div className="flex items-center gap-1">
                  <span>★</span>
                  <span className="font-semibold">{anime.score}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/90 hover:text-white hover:bg-white/10 focus-visible:ring-0 focus-visible:ring-offset-0"
                  onClick={() => onRemove(anime.mal_id)}
                >
                  Remove
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-white/90 hover:text-white hover:bg-white/10"
                >
                  <a
                    href={anime.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open MAL
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
