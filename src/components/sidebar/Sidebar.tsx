import { useState, useCallback, useTransition } from "react";
import type { AnimeData } from "@/types/anime";
import { SearchBar } from "./SearchBar";
import { AnimeCard } from "./AnimeCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { jikanClient } from "@/lib/api/jikan";

interface SidebarProps {
  seasonalAnime: AnimeData[];
  selectedIds: number[];
  onAddAnime: (id: number) => void;
  onRemoveAnime: (id: number) => void;
  isSeasonalLoading: boolean;
  seasonalHasNextPage: boolean;
  seasonalCurrentPage: number;
  seasonalTotalPages: number;
  seasonalIsLoadingMore: boolean;
  onLoadMoreSeasonal: () => Promise<void>;
}

export function Sidebar({
  seasonalAnime,
  selectedIds,
  onAddAnime,
  onRemoveAnime,
  isSeasonalLoading,
  seasonalHasNextPage,
  seasonalCurrentPage,
  seasonalTotalPages,
  seasonalIsLoadingMore,
  onLoadMoreSeasonal,
}: SidebarProps) {
  const [searchResults, setSearchResults] = useState<AnimeData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Pagination state
  const [currentQuery, setCurrentQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setCurrentQuery("");
      setCurrentPage(1);
      setHasNextPage(false);
      setTotalPages(1);
      setIsSearching(false);
      return;
    }

    // Fase 1: Búsqueda local (instantánea, sin bloqueo)
    const localResults = seasonalAnime.filter((anime) =>
      anime.title.toLowerCase().includes(query.toLowerCase()) ||
      anime.title_english?.toLowerCase().includes(query.toLowerCase()) ||
      anime.title_japanese?.toLowerCase().includes(query.toLowerCase())
    );

    setSearchResults(localResults);
    setHasSearched(true);
    setCurrentQuery(query);
    setCurrentPage(1);
    setHasNextPage(false);
    setTotalPages(1);
    setIsSearching(localResults.length === 0);

    // Fase 2: Si no hay resultados locales, buscar en API (en background, sin bloqueo)
    if (localResults.length === 0) {
      startTransition(() => {
        jikanClient.searchAnime(query, 1).then((result) => {
          setSearchResults(result.data);
          setHasNextPage(result.pagination.hasNextPage);
          setTotalPages(result.pagination.lastVisiblePage);
          setIsSearching(false);
        }).catch((error) => {
          console.error("Search failed:", error);
          setSearchResults([]);
          setHasNextPage(false);
          setTotalPages(1);
          setIsSearching(false);
        });
      });
    }
    if (localResults.length > 0) {
      setIsSearching(false);
    }
  }, [seasonalAnime]);

  const handleLoadMore = useCallback(async () => {
    if (!hasNextPage || isLoadingMore || !currentQuery) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const result = await jikanClient.searchAnime(currentQuery, nextPage);

      // Append results, do not replace
      setSearchResults(prev => [...prev, ...result.data]);
      setCurrentPage(nextPage);
      setHasNextPage(result.pagination.hasNextPage);
    } catch (error) {
      console.error("Load more failed:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasNextPage, isLoadingMore, currentQuery, currentPage]);

  // Determine what to display
  const displayAnime = hasSearched ? searchResults : seasonalAnime;
  const isLoading = hasSearched ? isPending || isSearching : isSeasonalLoading;

  return (
    <div className="flex flex-col h-screen border-r border-black bg-white">
      {/* Header */}
      <div className="p-4 border-b border-black">
        <h1 className="text-2xl font-bold font-display mb-4">
          Anime Calendar
        </h1>
        <SearchBar onSearch={handleSearch} isLoading={isPending} />
      </div>

      {/* Results */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="text-center text-gray-600 py-8">
            Loading...
          </div>
        ) : displayAnime.length === 0 ? (
          <div className="text-center text-gray-600 py-8">
            {hasSearched
              ? (isSearching ? "Searching..." : "No results found")
              : "No anime available"}
          </div>
        ) : (
          <>
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

            {/* Load More Button - visible when searching OR when viewing seasonal anime with more pages */}
            {(hasSearched ? hasNextPage : seasonalHasNextPage) && (
              <div className="mt-4 space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={hasSearched ? handleLoadMore : onLoadMoreSeasonal}
                  disabled={hasSearched ? isLoadingMore : seasonalIsLoadingMore}
                >
                  {(hasSearched ? isLoadingMore : seasonalIsLoadingMore)
                    ? "Loading..."
                    : "Load More"}
                </Button>

                {/* Pagination info */}
                <div className="text-xs text-center text-gray-500">
                  Page {hasSearched ? currentPage : seasonalCurrentPage} of{" "}
                  {hasSearched ? totalPages : seasonalTotalPages}
                </div>
              </div>
            )}
          </>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-black text-xs text-gray-600">
        {selectedIds.length} anime selected
      </div>
    </div>
  );
}
