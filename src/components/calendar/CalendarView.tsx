import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { CalendarEvent } from "@/types/calendar";
import { AnimeEvent } from "./AnimeEvent";

interface CalendarViewProps {
  events: CalendarEvent[];
}

export function CalendarView({ events }: CalendarViewProps) {
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
        firstDay={1} // Monday
        allDaySlot={false}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        height="100%"
        events={events}
        eventContent={(arg) => {
          return <AnimeEvent event={arg.event} />;
        }}
        slotLabelFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        dayHeaderFormat={{
          weekday: "short",
          day: "numeric",
        }}
      />
    </div>
  );
}
