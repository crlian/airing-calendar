import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { CalendarEvent } from "@/types/calendar";
import { AnimeEvent } from "./AnimeEvent";

interface CalendarViewProps {
  events: CalendarEvent[];
  onRemoveAnime: (id: number) => void;
}

export function CalendarView({ events, onRemoveAnime }: CalendarViewProps) {
  return (
    <div className="h-full p-4">
      <FullCalendar
        plugins={[timeGridPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "",
        }}
        buttonText={{ today: "Today" }}
        nowIndicator={true}
        scrollTime="08:00:00"
        weekends={true}
        firstDay={1} // Monday
        allDaySlot={false}
        slotMinTime="06:00:00"
        slotMaxTime="13:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00"
        height="100%"
        events={events}
        eventContent={(arg) => {
          return <AnimeEvent event={arg.event} onRemove={onRemoveAnime} />;
        }}
        slotLabelFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        dayHeaderFormat={{
          weekday: "short",
          day: "2-digit",
        }}
      />
    </div>
  );
}
