import { Sidebar } from "@/components/sidebar/Sidebar";
import { useSeasonalAnime } from "@/hooks/useSeasonalAnime";
import { useSelectedAnime } from "@/hooks/useSelectedAnime";
import { useAnimeData } from "@/hooks/useAnimeData";
import { useCalendarPreferences } from "@/hooks/useCalendarPreferences";
import type { AnimeData } from "@/types/anime";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import "./App.css";

const CalendarView = lazy(() =>
  import("@/components/calendar/CalendarView").then((module) => ({
    default: module.CalendarView,
  }))
);

function App() {
  const [mobileTab, setMobileTab] = useState<"calendar" | "browse">("calendar");
  useEffect(() => {
    import("@/components/calendar/CalendarView");
  }, []);
  // Fetch seasonal anime
  const {
    data: seasonalAnime,
    isLoading: isSeasonalLoading,
    error: seasonalError,
    hasNextPage: seasonalHasNextPage,
    currentPage: seasonalCurrentPage,
    totalPages: seasonalTotalPages,
    isLoadingMore: seasonalIsLoadingMore,
    loadMoreError: seasonalLoadMoreError,
    loadMore: loadMoreSeasonal,
    refetch: refetchSeasonal,
  } = useSeasonalAnime();

  // Manage selected anime
  const { selectedIds, selectedAnime, addAnime, removeAnime } = useSelectedAnime();
  const { preferences, updatePreferences } = useCalendarPreferences();
  const [hasAddedAnime, setHasAddedAnime] = useState(false);

  const handleAddAnime = useCallback(
    (anime: AnimeData) => {
      setHasAddedAnime(true);
      addAnime(anime);
    },
    [addAnime]
  );

  const handleFeedbackSubmit = useCallback(
    async (submission: {
      message: string;
      honeypot: string;
      turnstileToken?: string | null;
    }) => {
      const payload = {
        message: submission.message,
        honeypot: submission.honeypot,
        turnstileToken: submission.turnstileToken ?? null,
        path: window.location.pathname,
        userAgent: window.navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }
    },
    []
  );

  const availableAnime = useMemo(() => {
    const map = new Map<number, AnimeData>();
    seasonalAnime.forEach((anime) => map.set(anime.mal_id, anime));
    selectedAnime.forEach((anime) => map.set(anime.mal_id, anime));
    return Array.from(map.values());
  }, [seasonalAnime, selectedAnime]);

  // Transform to calendar events
  const { calendarEvents } = useAnimeData({
    selectedIds,
    animeList: availableAnime,
  });

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
      <div className="flex items-center gap-2 border-b border-black bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab("calendar")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
            mobileTab === "calendar"
              ? "border-black bg-black text-white"
              : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          Calendar
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("browse")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition ${
            mobileTab === "browse"
              ? "border-black bg-black text-white"
              : "border-gray-200 bg-white text-gray-700"
          }`}
        >
          Browse
        </button>
      </div>
      {/* Sidebar */}
      <div
        className={`order-2 w-full lg:order-none lg:w-[400px] lg:flex-shrink-0 ${
          mobileTab === "browse" ? "block" : "hidden"
        } lg:block`}
      >
        <Sidebar
          seasonalAnime={seasonalAnime}
          selectedIds={selectedIds}
          calendarEvents={calendarEvents}
          onAddAnime={handleAddAnime}
          onRemoveAnime={removeAnime}
          calendarPreferences={preferences}
          onCalendarPreferencesChange={updatePreferences}
          seasonalError={seasonalError ? seasonalError.message : null}
          onRetrySeasonal={refetchSeasonal}
          isSeasonalLoading={isSeasonalLoading}
          seasonalHasNextPage={seasonalHasNextPage}
          seasonalCurrentPage={seasonalCurrentPage}
          seasonalTotalPages={seasonalTotalPages}
          seasonalIsLoadingMore={seasonalIsLoadingMore}
          seasonalLoadMoreError={seasonalLoadMoreError}
          onLoadMoreSeasonal={loadMoreSeasonal}
        />
      </div>

      {/* Calendar */}
      <div
        className={`order-1 w-full lg:order-none lg:flex-1 lg:overflow-hidden ${
          mobileTab === "calendar" ? "block" : "hidden"
        } lg:block`}
      >
        {selectedIds.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <h2 className="text-2xl font-display font-semibold mb-2">
                Welcome to Anime Season
              </h2>
              <p className="text-lg mb-4">
                Search for anime and add them to your calendar to get started
              </p>
              <ol className="text-sm text-gray-500 space-y-1">
                <li>1. Browse seasonal anime or search by title.</li>
                <li>2. Click Add to include it in your schedule.</li>
                <li>3. See the weekly airings in your time zone.</li>
              </ol>
            </div>
          </div>
        ) : (
          <Suspense fallback={<span className="sr-only">Loading calendar...</span>}>
            <CalendarView
              events={calendarEvents}
              onRemoveAnime={removeAnime}
              preferences={preferences}
            />
          </Suspense>
        )}
      </div>
      <FeedbackWidget hasAddedAnime={hasAddedAnime} onSubmit={handleFeedbackSubmit} />
    </div>
  );
}

export default App;
