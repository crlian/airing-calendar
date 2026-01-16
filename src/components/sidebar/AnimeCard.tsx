import type { AnimeData } from "@/types/anime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Plus } from "lucide-react";

interface AnimeCardProps {
  anime: AnimeData;
  isSelected: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export function AnimeCard({ anime, isSelected, onAdd, onRemove }: AnimeCardProps) {
  const displayTitle = anime.title_english || anime.title;
  const broadcastInfo = anime.broadcast?.string || "No broadcast info";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="flex-shrink-0">
            <img
              src={anime.images.jpg.small_image_url}
              alt={displayTitle}
              className="h-24 w-16 object-cover rounded border border-black"
              loading="lazy"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm line-clamp-2 mb-1">
              {displayTitle}
            </h3>

            <Badge variant="secondary" className="text-xs mb-2">
              {broadcastInfo}
            </Badge>

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
                onClick={onRemove}
              >
                <Check className="h-4 w-4 mr-1" />
                Added
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                className="w-full"
                onClick={onAdd}
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
