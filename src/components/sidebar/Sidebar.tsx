import { useState, useCallback, useMemo, useRef, useTransition, useEffect } from "react";
import type { AnimeData, SearchAnimeResult } from "@/types/anime";
import { SearchBar } from "./SearchBar";
import { AnimeCard } from "./AnimeCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { jikanClient, JikanRateLimitError } from "@/lib/api/jikan";
import type { CalendarPreferences } from "@/types/preferences";

interface SidebarProps {
  seasonalAnime: AnimeData[];
  selectedIds: number[];
  onAddAnime: (anime: AnimeData) => void;
  onRemoveAnime: (id: number) => void;
  calendarPreferences: CalendarPreferences;
  onCalendarPreferencesChange: (patch: Partial<CalendarPreferences>) => void;
  seasonalError: string | null;
  onRetrySeasonal: () => Promise<void>;
  isSeasonalLoading: boolean;
  seasonalHasNextPage: boolean;
  seasonalCurrentPage: number;
  seasonalTotalPages: number;
  seasonalIsLoadingMore: boolean;
  seasonalLoadMoreError: string | null;
  onLoadMoreSeasonal: () => Promise<void>;
}

const SEARCH_CACHE_KEY = "anime-calendar:search-cache";
const SEARCH_CACHE_DURATION = 10 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 30;

type SearchCacheEntry = SearchAnimeResult & {
  timestamp: number;
};

const loadSearchCache = (): Map<string, SearchCacheEntry> => {
  try {
    const stored = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!stored) return new Map();
    const parsed = JSON.parse(stored) as Record<string, SearchCacheEntry>;
    if (!parsed || typeof parsed !== "object") return new Map();
    const now = Date.now();
    const entries = Object.entries(parsed)
      .filter(([, entry]) => now - entry.timestamp <= SEARCH_CACHE_DURATION)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, SEARCH_CACHE_MAX_ENTRIES);
    return new Map(entries);
  } catch (error) {
    console.error("Failed to load search cache:", error);
    return new Map();
  }
};

const persistSearchCache = (cache: Map<string, SearchCacheEntry>): void => {
  try {
    const serialized: Record<string, SearchCacheEntry> = {};
    cache.forEach((entry, key) => {
      serialized[key] = entry;
    });
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error("Failed to save search cache:", error);
  }
};

const getValidSearchCache = (
  cache: Map<string, SearchCacheEntry>,
  key: string
): SearchCacheEntry | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  const isExpired = Date.now() - entry.timestamp > SEARCH_CACHE_DURATION;
  if (isExpired) {
    cache.delete(key);
    persistSearchCache(cache);
    return null;
  }
  return entry;
};

export function Sidebar({
  seasonalAnime,
  selectedIds,
  onAddAnime,
  onRemoveAnime,
  calendarPreferences,
  onCalendarPreferencesChange,
  seasonalError,
  onRetrySeasonal,
  isSeasonalLoading,
  seasonalHasNextPage,
  seasonalCurrentPage,
  seasonalTotalPages,
  seasonalIsLoadingMore,
  seasonalLoadMoreError,
  onLoadMoreSeasonal,
}: SidebarProps) {
  const [searchResults, setSearchResults] = useState<AnimeData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchCacheRef = useRef<Map<string, SearchCacheEntry>>(new Map());
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [startHourInput, setStartHourInput] = useState(
    () => `${calendarPreferences.startHour}`
  );

  // Pagination state
  const [currentQuery, setCurrentQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const seasonalSearchIndex = useMemo(() => {
    return seasonalAnime.map((anime) => {
      const haystack = [
        anime.title,
        anime.title_english,
        anime.title_japanese,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return { anime, haystack };
    });
  }, [seasonalAnime]);

  const handleAddAnime = useCallback(
    (anime: AnimeData) => {
      onAddAnime(anime);
    },
    [onAddAnime]
  );

  const handleRemoveAnime = useCallback(
    (id: number) => {
      onRemoveAnime(id);
    },
    [onRemoveAnime]
  );

  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setCurrentQuery("");
      setCurrentPage(1);
      setHasNextPage(false);
      setTotalPages(1);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    // Phase 1: Local search (instant, non-blocking)
    setSearchError(null);
    const normalizedQuery = query.toLowerCase();
    const localResults = seasonalSearchIndex
      .filter(({ haystack }) => haystack.includes(normalizedQuery))
      .map(({ anime }) => anime);

    setSearchResults(localResults);
    setHasSearched(true);
    setCurrentQuery(query);
    setCurrentPage(1);
    setHasNextPage(false);
    setTotalPages(1);
    setIsSearching(localResults.length === 0);

    // Phase 2: If no local results, search the API (background, non-blocking)
    if (localResults.length === 0) {
      const cacheKey = `${query.toLowerCase()}|1`;
      const cached = getValidSearchCache(searchCacheRef.current, cacheKey);
      if (cached) {
        setSearchResults(cached.data);
        setHasNextPage(cached.pagination.hasNextPage);
        setTotalPages(cached.pagination.lastVisiblePage);
        setIsSearching(false);
        return;
      }

      startTransition(() => {
        jikanClient.searchAnime(query, 1).then((result) => {
          searchCacheRef.current.set(cacheKey, {
            ...result,
            timestamp: Date.now(),
          });
          persistSearchCache(searchCacheRef.current);
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
          setSearchError(
            error instanceof JikanRateLimitError
              ? error.message
              : "Search failed. Try again."
          );
        });
      });
    }
    if (localResults.length > 0) {
      setIsSearching(false);
    }
  }, [seasonalSearchIndex]);

  useEffect(() => {
    setStartHourInput(`${calendarPreferences.startHour}`);
  }, [calendarPreferences.startHour]);

  useEffect(() => {
    searchCacheRef.current = loadSearchCache();
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!hasNextPage || isLoadingMore || !currentQuery) return;

    setIsLoadingMore(true);
    setSearchError(null);
    const nextPage = currentPage + 1;

    try {
      const cacheKey = `${currentQuery.toLowerCase()}|${nextPage}`;
      const cached = getValidSearchCache(searchCacheRef.current, cacheKey);
      const result = cached ?? await jikanClient.searchAnime(currentQuery, nextPage);
      if (!cached) {
        searchCacheRef.current.set(cacheKey, {
          ...result,
          timestamp: Date.now(),
        });
        persistSearchCache(searchCacheRef.current);
      }

      // Append results, do not replace
      setSearchResults(prev => [...prev, ...result.data]);
      setCurrentPage(nextPage);
      setHasNextPage(result.pagination.hasNextPage);
    } catch (error) {
      console.error("Load more failed:", error);
      setSearchError(
        error instanceof JikanRateLimitError
          ? error.message
          : "Failed to load more results."
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasNextPage, isLoadingMore, currentQuery, currentPage]);

  // Determine what to display
  const displayAnime = hasSearched ? searchResults : seasonalAnime;
  const isLoading = hasSearched ? isPending || isSearching : isSeasonalLoading;
  const showSeasonalError = !hasSearched && seasonalError;
  const showSearchError = hasSearched && searchError;

  return (
    <div className="flex flex-col h-screen border-r border-black bg-white">
      {/* Header */}
      <div className="p-4 border-b border-black">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold font-display">Anime Season</h1>
          <button
            type="button"
            className="text-xs font-medium text-gray-600 underline underline-offset-4"
            onClick={() => setShowHowItWorks((prev) => !prev)}
            aria-expanded={showHowItWorks}
            aria-controls="how-it-works"
          >
            How it works
          </button>
        </div>
        {showHowItWorks && (
          <div
            id="how-it-works"
            className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
          >
            <p className="font-medium text-gray-700">Quick steps</p>
            <ol className="mt-2 space-y-1">
              <li>1. Search or browse the seasonal list.</li>
              <li>2. Tap Add to include a show.</li>
              <li>3. Check the calendar for local air times.</li>
            </ol>
          </div>
        )}
        <SearchBar onSearch={handleSearch} isLoading={isPending} />
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-gray-600">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">
              Time format
            </span>
            <select
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800"
              value={calendarPreferences.timeFormat}
              onChange={(event) =>
                onCalendarPreferencesChange({
                  timeFormat: event.target.value as CalendarPreferences["timeFormat"],
                })
              }
            >
              <option value="24h">24h</option>
              <option value="12h">12h</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">
              Week starts
            </span>
            <select
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800"
              value={calendarPreferences.weekStart}
              onChange={(event) =>
                onCalendarPreferencesChange({
                  weekStart: Number(event.target.value),
                })
              }
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">
              Start hour
            </span>
            <input
              type="number"
              min={0}
              max={23}
              value={startHourInput}
              onChange={(event) => {
                const { value } = event.target;
                setStartHourInput(value);
                if (value.trim() === "") return;
                const parsed = Number(value);
                if (Number.isNaN(parsed)) return;
                const clamped = Math.min(23, Math.max(0, parsed));
                onCalendarPreferencesChange({ startHour: clamped });
              }}
              onBlur={() => {
                if (startHourInput.trim() === "") {
                  setStartHourInput(`${calendarPreferences.startHour}`);
                  return;
                }
                const parsed = Number(startHourInput);
                if (Number.isNaN(parsed)) {
                  setStartHourInput(`${calendarPreferences.startHour}`);
                  return;
                }
                const clamped = Math.min(23, Math.max(0, parsed));
                if (clamped !== calendarPreferences.startHour) {
                  onCalendarPreferencesChange({ startHour: clamped });
                }
                setStartHourInput(`${clamped}`);
              }}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800"
            />
          </label>
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="text-center text-gray-600 py-8">
            Loading...
          </div>
        ) : showSeasonalError && displayAnime.length === 0 ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div>Failed to load seasonal anime.</div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onRetrySeasonal}
            >
              Retry
            </Button>
          </div>
        ) : displayAnime.length === 0 ? (
          <div className="text-center text-gray-600 py-8">
            {hasSearched
              ? (isSearching ? "Searching..." : "No results found")
              : "No anime available"}
          </div>
        ) : (
          <>
            {showSearchError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <div>{searchError}</div>
                {currentQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleSearch(currentQuery)}
                  >
                    Retry
                  </Button>
                )}
              </div>
            )}
            {showSeasonalError && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <div>{seasonalError}</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={onRetrySeasonal}
                >
                  Retry
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {displayAnime.map((anime) => (
                <AnimeCard
                  key={anime.mal_id}
                  anime={anime}
                  isSelected={selectedIds.includes(anime.mal_id)}
                  onAddAnime={handleAddAnime}
                  onRemoveAnime={handleRemoveAnime}
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
                {!hasSearched && seasonalLoadMoreError && (
                  <div className="text-xs text-center text-red-600">
                    {seasonalLoadMoreError}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-black text-xs text-gray-600">
        <div>{selectedIds.length} anime selected</div>
        <div className="mt-2 text-[11px] text-gray-500">
          Data via Jikan (unofficial MAL API). Not affiliated with MyAnimeList.
        </div>
      </div>
    </div>
  );
}
