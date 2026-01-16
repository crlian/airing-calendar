import { Sidebar } from "@/components/sidebar/Sidebar";
import { CalendarView } from "@/components/calendar/CalendarView";
import { useSeasonalAnime } from "@/hooks/useSeasonalAnime";
import { useSelectedAnime } from "@/hooks/useSelectedAnime";
import { useAnimeData } from "@/hooks/useAnimeData";

function App() {
  // Fetch seasonal anime
  const { data: seasonalAnime, isLoading: isSeasonalLoading } = useSeasonalAnime();

  // Manage selected anime
  const { selectedIds, addAnime, removeAnime } = useSelectedAnime();

  // Transform to calendar events
  const { calendarEvents } = useAnimeData({
    selectedIds,
    seasonalAnime,
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
          <CalendarView events={calendarEvents} />
        )}
      </div>
    </div>
  );
}

export default App;
