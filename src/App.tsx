import { Sidebar } from "@/components/sidebar/Sidebar";
import { useSeasonalAnime } from "@/hooks/useSeasonalAnime";
import { useSelectedAnime } from "@/hooks/useSelectedAnime";
import { useAnimeData } from "@/hooks/useAnimeData";
import { useCalendarPreferences } from "@/hooks/useCalendarPreferences";
import { AiringStorage } from "@/lib/storage/airingStorage";
import { anilistClient } from "@/lib/api/anilist";
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
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState("");

  useEffect(() => {
    import("@/components/calendar/CalendarView");
  }, []);
  const {
    data: seasonalAnime,
    airingData,
    isLoading: isSeasonalLoading,
    error: seasonalError,
    hasNextPage: seasonalHasNextPage,
    isLoadingMore: seasonalIsLoadingMore,
    loadMoreError: seasonalLoadMoreError,
    loadMore: loadMoreSeasonal,
    refetch: refetchSeasonal,
  } = useSeasonalAnime();

  // Manage selected anime
  const { selectedIds, selectedAnime, addAnime, removeAnime } =
    useSelectedAnime();
  const { preferences, updatePreferences } = useCalendarPreferences();
  const [hasAddedAnime, setHasAddedAnime] = useState(false);

  // Migration effect: Update old Jikan data to AniList (runs once on mount)
  useEffect(() => {
    const runMigration = async () => {
      // Get current selected IDs from localStorage directly
      const storedIds = JSON.parse(localStorage.getItem('anime-calendar:selected') || '[]');
      if (!Array.isArray(storedIds) || storedIds.length === 0) return;

      // Check which ones need migration (no AniList data)
      const needsMigration = storedIds.filter((id: number) => !AiringStorage.getAiring(id));
      if (needsMigration.length === 0) return;

      setIsMigrating(true);
      setMigrationStatus(`Updating schedules for ${needsMigration.length} anime...`);

      try {
        // Fetch season pages to find the saved anime
        let page = 1;
        let hasNext = true;
        let updatedCount = 0;

        while (hasNext && needsMigration.length > updatedCount) {
          const result = await anilistClient.getSeasonNow(page);

          // Match and collect airing data
          for (const anime of result.data) {
            if (needsMigration.includes(anime.mal_id)) {
              const airingInfo = result.airingData.get(anime.mal_id);
              if (airingInfo) {
                AiringStorage.setAiring(anime.mal_id, airingInfo);
                updatedCount++;
              }
            }
          }

          hasNext = result.pagination.hasNextPage;
          page++;

          // Safety: max 3 pages (~25 anime per page = ~75 anime max)
          if (page > 3) break;
        }

        if (updatedCount > 0) {
          setMigrationStatus(`Updated ${updatedCount} anime schedules!`);
          setTimeout(() => setIsMigrating(false), 1500);
        } else {
          setIsMigrating(false);
        }
      } catch (error) {
        console.error("Migration failed:", error);
        setIsMigrating(false);
      }
    };

    runMigration();
  }, []); // Empty deps - only run once on mount

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
    airingData,
  });

  return (
    <>
      {/* Migration overlay */}
      {isMigrating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-lg bg-white p-6 text-center shadow-lg">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black mx-auto" />
            <p className="text-sm font-medium text-gray-900">{migrationStatus}</p>
            <p className="mt-2 text-xs text-gray-500">This will only take a moment...</p>
          </div>
        </div>
      )}
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
          airingData={airingData}
          onAddAnime={handleAddAnime}
          onRemoveAnime={removeAnime}
          calendarPreferences={preferences}
          onCalendarPreferencesChange={updatePreferences}
          seasonalError={seasonalError ? seasonalError.message : null}
          onRetrySeasonal={refetchSeasonal}
          isSeasonalLoading={isSeasonalLoading}
          seasonalHasNextPage={seasonalHasNextPage}
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
            <div className="text-center max-w-2xl px-4">
              <h1 className="text-2xl font-display font-semibold mb-2 text-black">
                Weekly Anime Airing Schedule in Your Time Zone
              </h1>
              <p className="text-base md:text-lg mb-4">
                Track this week's anime releases, convert airing times to your local timezone, and build your personal watch calendar.
              </p>
              <ol className="text-sm text-gray-500 space-y-1 mb-5">
                <li>1. Browse seasonal anime or search by title.</li>
                <li>2. Click Add to include it in your schedule.</li>
                <li>3. See weekly airings automatically converted to your timezone.</li>
              </ol>

              <div className="rounded-lg border border-gray-200 bg-white p-4 text-left mb-4">
                <h2 className="font-semibold text-black mb-2">Helpful pages</h2>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                  <li><a className="text-blue-600 hover:underline" href="/anime-airing-schedule-spring-2026/">Spring 2026 anime airing schedule</a></li>
                  <li><a className="text-blue-600 hover:underline" href="/anime-release-calendar-this-week/">Anime release calendar this week</a></li>
                  <li><a className="text-blue-600 hover:underline" href="/anime-timezone-schedule-converter/">Anime timezone schedule converter</a></li>
                  <li><a className="text-blue-600 hover:underline" href="/anime-airing-schedule-this-weekend/">Anime airing schedule this weekend</a></li>
                  <li><a className="text-blue-600 hover:underline" href="/new-season-anime-calendar/">New season anime calendar</a></li>
                </ul>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
                <h2 className="font-semibold text-black mb-2">FAQ</h2>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="font-medium text-gray-900">How do I see anime airing times in my local timezone?</dt>
                    <dd className="text-gray-600">AniSeason converts weekly airing times automatically based on your device timezone.</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-900">Can I build a personal anime watch schedule?</dt>
                    <dd className="text-gray-600">Yes. Add anime titles from browse/search and your weekly calendar updates instantly.</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-900">Does AniSeason update with seasonal anime releases?</dt>
                    <dd className="text-gray-600">Yes. Seasonal data updates and you can browse current releases week by week.</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        ) : (
          <Suspense fallback={<span className="sr-only">Loading calendar...</span>}>
            <CalendarView
              events={calendarEvents}
              onRemoveAnime={removeAnime}
              preferences={preferences}
              selectedCount={selectedIds.length}
            />
          </Suspense>
        )}
      </div>
        <FeedbackWidget hasAddedAnime={hasAddedAnime} onSubmit={handleFeedbackSubmit} />
      </div>
    </>
  );
}

export default App;
