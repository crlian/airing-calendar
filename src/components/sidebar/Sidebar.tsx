import { useState, useCallback, useMemo, useRef, useTransition, useEffect } from "react";
import type { AnimeData, SearchAnimeResult } from "@/types/anime";
import type { CalendarEvent } from "@/types/calendar";
import { SearchBar } from "./SearchBar";
import { AnimeCard } from "./AnimeCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { jikanClient, JikanRateLimitError } from "@/lib/api/jikan";
import { formatMinutes, getEpisodeMinutes } from "@/lib/utils/duration";
import type { CalendarPreferences } from "@/types/preferences";
import { changelogEntries } from "@/data/changelog";
import { DateTime } from "luxon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, Settings } from "lucide-react";

interface SidebarProps {
  seasonalAnime: AnimeData[];
  selectedIds: number[];
  calendarEvents: CalendarEvent[];
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
const LAST_SEEN_UPDATE_KEY = "anime-calendar:last-seen-update";
const CHANGELOG_DATE_FORMAT = "MMM dd, yyyy";

type SearchCacheEntry = SearchAnimeResult & {
  timestamp: number;
};

const parseChangelogDate = (value: string): DateTime | null => {
  const parsed = DateTime.fromFormat(value, CHANGELOG_DATE_FORMAT, { locale: "en" });
  return parsed.isValid ? parsed : null;
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
  calendarEvents,
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
  const [showChangelog, setShowChangelog] = useState(false);
  const [lastSeenUpdate, setLastSeenUpdate] = useState<DateTime | null>(() => {
    try {
      const stored = localStorage.getItem(LAST_SEEN_UPDATE_KEY);
      if (!stored) return null;
      const parsed = DateTime.fromISO(stored, { locale: "en" });
      return parsed.isValid ? parsed : null;
    } catch (error) {
      console.error("Failed to load changelog state:", error);
      return null;
    }
  });
  const [startHourInput, setStartHourInput] = useState(
    () => `${calendarPreferences.startHour}`
  );
  const visibleChangelog = changelogEntries.slice(0, 4);
  const latestChangelogDate = useMemo(() => {
    return changelogEntries.reduce<DateTime | null>((latest, entry) => {
      const parsed = parseChangelogDate(entry.date);
      if (!parsed) return latest;
      if (!latest || parsed.toMillis() > latest.toMillis()) return parsed;
      return latest;
    }, null);
  }, [changelogEntries]);
  const unseenUpdateCount = useMemo(() => {
    if (!lastSeenUpdate) return changelogEntries.length;
    return changelogEntries.reduce((count, entry) => {
      const parsed = parseChangelogDate(entry.date);
      if (!parsed) return count;
      return parsed.toMillis() > lastSeenUpdate.toMillis() ? count + 1 : count;
    }, 0);
  }, [changelogEntries, lastSeenUpdate]);
  const displayUnseenUpdateCount = Math.min(unseenUpdateCount, 2);
  const weeklySummary = useMemo(() => {
    const now = DateTime.local().setLocale("en");
    const currentDayIndex = now.weekday % 7;
    const daysToSubtract =
      (currentDayIndex - calendarPreferences.weekStart + 7) % 7;
    const weekStart = now.startOf("day").minus({ days: daysToSubtract });
    const weekEnd = weekStart.plus({ days: 7 });

    const eventsWithDate = calendarEvents
      .map((event) => {
        const nextOccurrence = event.extendedProps?.nextOccurrence;
        if (!nextOccurrence) return null;
        return {
          event,
          dateTime: DateTime.fromJSDate(nextOccurrence).setLocale("en"),
        };
      })
      .filter((entry): entry is { event: CalendarEvent; dateTime: DateTime } => Boolean(entry));

    const weeklyEvents = eventsWithDate.filter(({ dateTime }) => {
      const time = dateTime.toMillis();
      return time >= weekStart.toMillis() && time < weekEnd.toMillis();
    });

    const weeklyCount = weeklyEvents.length;

    const remainingMinutesThisWeek = weeklyEvents.reduce((total, { event }) => {
      return total + getEpisodeMinutes(event.extendedProps?.animeData?.duration);
    }, 0);


    const nextEvent = eventsWithDate
      .filter(({ dateTime }) => dateTime.toMillis() >= now.toMillis())
      .sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis())[0];

    const nextLabel = nextEvent
      ? `${nextEvent.dateTime.toFormat("ccc HH:mm")} - ${nextEvent.event.title}`
      : "-";

    return {
      weeklyCount,
      nextLabel,
      weeklyRemainingLabel: formatMinutes(remainingMinutesThisWeek),
    };
  }, [calendarEvents, calendarPreferences.weekStart]);

  useEffect(() => {
    if (!showChangelog || !latestChangelogDate) return;
    try {
      const nextValue = latestChangelogDate.toISODate();
      if (!nextValue) return;
      localStorage.setItem(LAST_SEEN_UPDATE_KEY, nextValue);
      setLastSeenUpdate(latestChangelogDate);
    } catch (error) {
      console.error("Failed to save changelog state:", error);
    }
  }, [showChangelog, latestChangelogDate]);

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
    <div className="flex flex-col border-b border-black bg-white lg:h-screen lg:border-b-0 lg:border-r">
      {/* Header */}
      <div className="p-4 border-b border-black">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold font-display whitespace-nowrap">Anime Season</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="whitespace-nowrap text-xs font-medium text-gray-600 underline underline-offset-4"
              onClick={() => setShowHowItWorks((prev) => !prev)}
              aria-expanded={showHowItWorks}
              aria-controls="how-it-works"
            >
              How it works
            </button>
            <button
              type="button"
              className="inline-flex items-baseline gap-0.5 whitespace-nowrap text-xs font-medium text-gray-600 underline underline-offset-4"
              onClick={() => setShowChangelog((prev) => !prev)}
              aria-expanded={showChangelog}
              aria-controls="whats-new"
            >
              <span>What's new</span>
              {displayUnseenUpdateCount > 0 && (
                <span className="text-[10px] leading-none text-gray-600">
                  ({displayUnseenUpdateCount})
                </span>
              )}
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition hover:border-black hover:text-black"
                  aria-label="Open calendar settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[23rem]">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Calendar settings
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-gray-500">
                      Time format
                    </span>
                    <select
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-black focus:outline-none"
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
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-black focus:outline-none"
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
                      className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-800 focus:border-black focus:outline-none"
                    />
                  </label>
                </div>
              </PopoverContent>
            </Popover>
          </div>
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
            <p className="mt-2 text-[11px] text-gray-500">
              Updating this daily. Got feedback?
            </p>
          </div>
        )}
        {showChangelog && (
          <div
            id="whats-new"
            className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
          >
            <p className="font-medium text-gray-700">Latest updates</p>
            <ol className="mt-2 space-y-2">
              {visibleChangelog.map((entry) => (
                <li key={`${entry.date}-${entry.title}`} className="space-y-1">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">
                    {entry.date}
                  </div>
                  <div>{entry.title}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
        <SearchBar onSearch={handleSearch} isLoading={isPending} />
        <div className="mt-4 text-[11px] text-gray-500">
          <div>
            Remaining this week: {weeklySummary.weeklyCount} {weeklySummary.weeklyCount === 1 ? "episode" : "episodes"}
          </div>
          <div>
            Watch time remaining: {weeklySummary.weeklyRemainingLabel}
            <span
              className="relative ml-1 inline-flex items-center text-gray-400 group"
              aria-label="Estimated based on average episode length."
              tabIndex={0}
            >
              <Info className="relative top-[2px] h-3 w-3" aria-hidden="true" />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded bg-black px-2 py-1 text-[10px] text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                Estimated based on average episode length.
              </span>
            </span>
          </div>
          <div>Next: {weeklySummary.nextLabel}</div>
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
        <div className="flex items-center justify-between gap-3">
          <div>{selectedIds.length} anime selected</div>
          <a
            href="https://github.com/crlian/airing-calendar"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-black hover:text-black"
            aria-label="View the project on GitHub"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="currentColor"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.483 0-.238-.009-.868-.013-1.703-2.782.604-3.369-1.34-3.369-1.34-.455-1.157-1.111-1.466-1.111-1.466-.908-.62.069-.607.069-.607 1.004.071 1.532 1.032 1.532 1.032.892 1.529 2.341 1.087 2.91.832.091-.647.35-1.087.636-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.682-.103-.253-.447-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.57 9.57 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.698 1.028 1.591 1.028 2.682 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .268.18.58.688.481A10.02 10.02 0 0 0 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            GitHub
          </a>
        </div>
        <div className="mt-2 text-[11px] text-gray-500">
          Data via Jikan (unofficial MAL API). Not affiliated with MyAnimeList.
        </div>
      </div>
    </div>
  );
}
