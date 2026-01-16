import { useState, useCallback } from "react";
import type { AnimeData } from "@/types/anime";
import { SearchBar } from "./SearchBar";
import { AnimeCard } from "./AnimeCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { jikanClient } from "@/lib/api/jikan";

interface SidebarProps {
  seasonalAnime: AnimeData[];
  selectedIds: number[];
  onAddAnime: (id: number) => void;
  onRemoveAnime: (id: number) => void;
  isSeasonalLoading: boolean;
}

export function Sidebar({
  seasonalAnime,
  selectedIds,
  onAddAnime,
  onRemoveAnime,
  isSeasonalLoading,
}: SidebarProps) {
  const [searchResults, setSearchResults] = useState<AnimeData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = await jikanClient.searchAnime(query);
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Determine what to display
  const displayAnime = hasSearched ? searchResults : seasonalAnime;
  const isLoading = hasSearched ? isSearching : isSeasonalLoading;

  return (
    <div className="flex flex-col h-screen border-r border-black bg-white">
      {/* Header */}
      <div className="p-4 border-b border-black">
        <h1 className="text-2xl font-bold font-display mb-4">
          Anime Calendar
        </h1>
        <SearchBar onSearch={handleSearch} isLoading={isSearching} />
      </div>

      {/* Results */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="text-center text-gray-600 py-8">
            Loading...
          </div>
        ) : displayAnime.length === 0 ? (
          <div className="text-center text-gray-600 py-8">
            {hasSearched ? "No results found" : "No anime available"}
          </div>
        ) : (
          <div className="space-y-3">
            {displayAnime.map((anime) => (
              <AnimeCard
                key={anime.mal_id}
                anime={anime}
                isSelected={selectedIds.includes(anime.mal_id)}
                onAdd={() => onAddAnime(anime.mal_id)}
                onRemove={() => onRemoveAnime(anime.mal_id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-black text-xs text-gray-600">
        {selectedIds.length} anime selected
      </div>
    </div>
  );
}
