import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { CalendarEvent } from "@/types/calendar";
import type { CalendarPreferences } from "@/types/preferences";
import type { EventContentArg } from "@fullcalendar/core";
import { AnimeEvent } from "./AnimeEvent";
import { useCallback } from "react";
import { DateTime } from "luxon";

interface CalendarViewProps {
  events: CalendarEvent[];
  onRemoveAnime: (id: number) => void;
  preferences: CalendarPreferences;
}

const padHour = (value: number) => value.toString().padStart(2, "0");

export function CalendarView({ events, onRemoveAnime, preferences }: CalendarViewProps) {
  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      return <AnimeEvent event={arg.event} onRemove={onRemoveAnime} />;
    },
    [onRemoveAnime]
  );
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offsetLabel = DateTime.now().setZone(localTimeZone).toFormat("ZZ");

  return (
    <div className="h-full p-4 flex flex-col">
      <div className="pb-2 text-xs text-gray-500">
        Time zone: {localTimeZone} (GMT{offsetLabel})
      </div>
      <div className="flex-1 min-h-0">
        <FullCalendar
          plugins={[timeGridPlugin, listPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridWeek,listWeek",
          }}
          buttonText={{ today: "Today", timeGridWeek: "Week", listWeek: "List" }}
          nowIndicator={true}
          scrollTime="08:00:00"
          weekends={true}
          firstDay={preferences.weekStart}
          allDaySlot={false}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00"
          height="100%"
          events={events}
          eventContent={renderEventContent}
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: preferences.timeFormat === "12h",
          }}
          scrollTime={`${padHour(preferences.startHour)}:00:00`}
          dayHeaderFormat={{
            weekday: "short",
            day: "2-digit",
          }}
        />
      </div>
    </div>
  );
}
