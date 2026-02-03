import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { CalendarEvent } from "@/types/calendar";
import type { CalendarPreferences } from "@/types/preferences";
import type { EventContentArg } from "@fullcalendar/core";
import { AnimeEvent } from "./AnimeEvent";
import { ExportButton } from "@/components/sidebar/ExportButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarViewProps {
  events: CalendarEvent[];
  onRemoveAnime: (id: number) => void;
  preferences: CalendarPreferences;
  selectedCount: number;
}

const padHour = (value: number) => value.toString().padStart(2, "0");

export function CalendarView({ events, onRemoveAnime, preferences, selectedCount }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [currentTitle, setCurrentTitle] = useState("This week");
  const [currentView, setCurrentView] = useState<"timeGridWeek" | "listWeek">("timeGridWeek");
  
  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      return (
        <AnimeEvent
          event={arg.event}
          timeText={arg.timeText}
          viewType={arg.view.type}
          onRemove={onRemoveAnime}
        />
      );
    },
    [onRemoveAnime]
  );
  
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offsetLabel = DateTime.now().setZone(localTimeZone).toFormat("ZZ");
  const startTime = useMemo(
    () => `${padHour(preferences.startHour)}:00:00`,
    [preferences.startHour]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateView = () => setIsMobile(mediaQuery.matches);
    updateView();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateView);
      return () => mediaQuery.removeEventListener("change", updateView);
    }
    mediaQuery.addListener(updateView);
    return () => mediaQuery.removeListener(updateView);
  }, []);

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;
    calendarApi.setOption("slotMinTime", startTime);
    calendarApi.setOption("scrollTime", startTime);
  }, [startTime]);

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;
    queueMicrotask(() => {
      calendarApi.changeView(isMobile ? "listWeek" : "timeGridWeek");
    });
  }, [isMobile]);

  // Update title when dates change
  const handleDatesSet = useCallback((arg: { view: { title: string } }) => {
    setCurrentTitle(arg.view.title);
  }, []);

  const handlePrev = useCallback(() => {
    calendarRef.current?.getApi()?.prev();
  }, []);

  const handleNext = useCallback(() => {
    calendarRef.current?.getApi()?.next();
  }, []);

  const handleToday = useCallback(() => {
    calendarRef.current?.getApi()?.today();
  }, []);

  const handleViewChange = useCallback((view: "timeGridWeek" | "listWeek") => {
    setCurrentView(view);
    calendarRef.current?.getApi()?.changeView(view);
  }, []);

  return (
    <div className="h-full p-4 flex flex-col">
      {/* Custom Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-2">
        {/* Left: Navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrev}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition hover:border-black hover:text-black"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition hover:border-black hover:text-black"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="ml-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-black hover:text-black"
          >
            Today
          </button>
        </div>

        {/* Center: Title + Export */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">{currentTitle}</h2>
          <ExportButton events={events} selectedCount={selectedCount} />
        </div>

        {/* Right: View Toggle */}
        {!isMobile && (
          <div className="flex items-center rounded-md border border-gray-200 p-0.5">
            <button
              type="button"
              onClick={() => handleViewChange("timeGridWeek")}
              className={`rounded-sm px-3 py-1 text-xs font-medium transition ${
                currentView === "timeGridWeek"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("listWeek")}
              className={`rounded-sm px-3 py-1 text-xs font-medium transition ${
                currentView === "listWeek"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              List
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pb-2">
        <div className="text-xs text-gray-500">
          Time zone: {localTimeZone} (GMT{offsetLabel})
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, listPlugin]}
          initialView={isMobile ? "listWeek" : "timeGridWeek"}
          headerToolbar={false}
          datesSet={handleDatesSet}
          nowIndicator={true}
          weekends={true}
          firstDay={preferences.weekStart}
          allDaySlot={false}
          slotMinTime={startTime}
          slotMaxTime="24:30:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00"
          height={isMobile ? "auto" : "100%"}
          events={events}
          eventContent={renderEventContent}
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: preferences.timeFormat === "12h",
          }}
          scrollTime={startTime}
          dayHeaderFormat={{
            weekday: "short",
            day: "2-digit",
          }}
        />
      </div>
    </div>
  );
}
