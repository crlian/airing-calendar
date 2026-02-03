import { memo } from "react";
import type { AnimeData } from "@/types/anime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveBadge } from "@/components/LiveBadge";
import { Check, Plus } from "lucide-react";

interface AnimeCardProps {
  anime: AnimeData;
  isSelected: boolean;
  broadcastLabel?: string;
  isAiringNow?: boolean;
  onAddAnime: (anime: AnimeData) => void;
  onRemoveAnime: (id: number) => void;
}

function AnimeCardComponent({ anime, isSelected, broadcastLabel, isAiringNow: airing, onAddAnime, onRemoveAnime }: AnimeCardProps) {
  const displayTitle = anime.title_english || anime.title;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="flex-shrink-0 relative">
            <img
              src={anime.images.jpg.small_image_url}
              alt={displayTitle}
              className="h-24 w-16 object-cover rounded border border-black"
              loading="lazy"
            />
            {airing && (
              <div className="absolute -top-1 -left-1">
                <LiveBadge className="scale-75" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm line-clamp-2 mb-1">
              {displayTitle}
            </h3>
            {anime.title && anime.title !== displayTitle && (
              <div className="text-xs italic text-gray-500 line-clamp-1 mb-1">
                ({anime.title})
              </div>
            )}

            <div className="flex items-center gap-2 mb-2">
              {broadcastLabel && (
                <Badge variant="secondary" className="text-xs">
                  {broadcastLabel}
                </Badge>
              )}
              {airing && <LiveBadge className="scale-75" />}
            </div>

            {anime.synopsis && (
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                {anime.synopsis}
              </p>
            )}

            {/* Action Button */}
            {isSelected ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onRemoveAnime(anime.mal_id)}
              >
                <Check className="h-4 w-4 mr-1" />
                Added
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                className="w-full"
                onClick={() => onAddAnime(anime)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const AnimeCard = memo(AnimeCardComponent);
