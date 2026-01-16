import { useState } from "react";
import type { ReactNode } from "react";
import type { AnimeData } from "@/types/anime";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface AnimeEventPopoverProps {
  anime: AnimeData;
  children: ReactNode;
}

export function AnimeEventPopover({ anime, children }: AnimeEventPopoverProps) {
  const [open, setOpen] = useState(false);

  const displayTitle = anime.title_english || anime.title;
  const synopsis = anime.synopsis
    ? anime.synopsis.length > 200
      ? anime.synopsis.substring(0, 200) + "..."
      : anime.synopsis
    : "No synopsis available";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-3">
          {/* Image */}
          <img
            src={anime.images.jpg.large_image_url}
            alt={displayTitle}
            className="w-full h-48 object-cover rounded border border-black"
          />

          {/* Title */}
          <h3 className="font-display font-semibold text-lg leading-tight">
            {displayTitle}
          </h3>

          {/* Broadcast Info */}
          {anime.broadcast?.string && (
            <Badge variant="default">{anime.broadcast.string}</Badge>
          )}

          {/* Score */}
          {anime.score && (
            <div className="text-sm">
              <span className="font-semibold">Score:</span> {anime.score}/10
            </div>
          )}

          {/* Synopsis */}
          <p className="text-sm text-gray-600 leading-relaxed">{synopsis}</p>

          {/* Link */}
          <a
            href={anime.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline hover:no-underline"
          >
            View on MyAnimeList
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
