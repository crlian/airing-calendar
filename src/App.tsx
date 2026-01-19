import { Sidebar } from "@/components/sidebar/Sidebar";
import { CalendarView } from "@/components/calendar/CalendarView";
import { useSeasonalAnime } from "@/hooks/useSeasonalAnime";
import { useSelectedAnime } from "@/hooks/useSelectedAnime";
import { useAnimeData } from "@/hooks/useAnimeData";
import type { AnimeData } from "@/types/anime";
import { useMemo } from "react";
import "./App.css";

function App() {
  // Fetch seasonal anime
  const {
    data: seasonalAnime,
    isLoading: isSeasonalLoading,
    hasNextPage: seasonalHasNextPage,
    currentPage: seasonalCurrentPage,
    totalPages: seasonalTotalPages,
    isLoadingMore: seasonalIsLoadingMore,
    loadMore: loadMoreSeasonal,
  } = useSeasonalAnime();

  // Manage selected anime
  const { selectedIds, selectedAnime, addAnime, removeAnime } = useSelectedAnime();

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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-[400px] flex-shrink-0">
        <Sidebar
          seasonalAnime={seasonalAnime}
          selectedIds={selectedIds}
          onAddAnime={addAnime}
          onRemoveAnime={removeAnime}
          isSeasonalLoading={isSeasonalLoading}
          seasonalHasNextPage={seasonalHasNextPage}
          seasonalCurrentPage={seasonalCurrentPage}
          seasonalTotalPages={seasonalTotalPages}
          seasonalIsLoadingMore={seasonalIsLoadingMore}
          onLoadMoreSeasonal={loadMoreSeasonal}
        />
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-hidden">
        {selectedIds.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <h2 className="text-2xl font-display font-semibold mb-2">
                Welcome to Anime Calendar
              </h2>
              <p className="text-lg">
                Search for anime and add them to your calendar to get started
              </p>
            </div>
          </div>
        ) : (
          <CalendarView events={calendarEvents} onRemoveAnime={removeAnime} />
        )}
      </div>
    </div>
  );
}

export default App;
