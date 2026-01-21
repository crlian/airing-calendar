import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { CalendarEvent } from "@/types/calendar";
import type { CalendarPreferences } from "@/types/preferences";
import type { EventContentArg } from "@fullcalendar/core";
import { AnimeEvent } from "./AnimeEvent";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

interface CalendarViewProps {
  events: CalendarEvent[];
  onRemoveAnime: (id: number) => void;
  preferences: CalendarPreferences;
}

const padHour = (value: number) => value.toString().padStart(2, "0");

export function CalendarView({ events, onRemoveAnime, preferences }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [isMobile, setIsMobile] = useState(false);
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
    calendarApi.changeView(isMobile ? "listWeek" : "timeGridWeek");
  }, [isMobile]);

  return (
    <div className="h-full p-4 flex flex-col">
      <div className="pb-2 text-xs text-gray-500">
        Time zone: {localTimeZone} (GMT{offsetLabel})
      </div>
      <div className="flex-1 min-h-0">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, listPlugin]}
          initialView={isMobile ? "listWeek" : "timeGridWeek"}
          headerToolbar={
            isMobile
              ? { left: "", center: "title", right: "" }
              : { left: "prev,next today", center: "title", right: "timeGridWeek,listWeek" }
          }
          buttonText={{ today: "Today", timeGridWeek: "Week", listWeek: "List" }}
          nowIndicator={true}
          weekends={true}
          firstDay={preferences.weekStart}
          allDaySlot={false}
          slotMinTime={startTime}
          slotMaxTime="24:00:00"
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
