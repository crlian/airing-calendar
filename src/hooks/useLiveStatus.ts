import { useState, useEffect, useCallback } from "react";
import { DateTime } from "luxon";
import type { CalendarEvent } from "@/types/calendar";

const DAY_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

interface LiveStatus {
  [eventId: string]: boolean;
}

/**
 * Hook to check which anime are currently airing
 * Refreshes every minute
 */
export function useLiveStatus(events: CalendarEvent[]): LiveStatus {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({});

  const checkLiveStatus = useCallback(() => {
    const now = DateTime.now();
    const newStatus: LiveStatus = {};

    events.forEach((event) => {
      if (!event.startTime || !event.extendedProps?.animeData) {
        newStatus[event.id] = false;
        return;
      }

      const todayIndex = now.weekday % 7;
      let isToday = true;

      if (Array.isArray(event.daysOfWeek) && event.daysOfWeek.length > 0) {
        isToday = event.daysOfWeek.includes(todayIndex);
      } else {
        const localDay = event.extendedProps?.localDay;
        if (localDay && DAY_TO_INDEX[localDay] !== undefined) {
          isToday = DAY_TO_INDEX[localDay] === todayIndex;
        }
      }

      if (!isToday) {
        newStatus[event.id] = false;
        return;
      }

      // Parse the event start time (HH:mm format)
      const [hours, minutes] = event.startTime.split(":").map(Number);
      
      // Create a DateTime for today at the event's start time
      const eventStart = now.set({
        hour: hours,
        minute: minutes,
        second: 0,
        millisecond: 0,
      });

      // Calculate end time (default 24 minutes if no duration)
      const duration = event.duration || "00:24";
      const [durationHours, durationMinutes] = duration.split(":").map(Number);
      const totalMinutes = (durationHours || 0) * 60 + (durationMinutes || 24);
      const eventEnd = eventStart.plus({ minutes: totalMinutes });

      // Check if currently airing (same day, between start and end)
      const isAiring = now >= eventStart && now <= eventEnd;
      newStatus[event.id] = isAiring;
    });

    setLiveStatus(newStatus);
  }, [events]);

  // Check immediately and then every minute
  useEffect(() => {
    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 60000); // Every minute
    return () => clearInterval(interval);
  }, [checkLiveStatus]);

  return liveStatus;
}

/**
 * Standalone function to check if a specific calendar event is airing now
 */
export function isEventAiringNow(event: CalendarEvent): boolean {
  if (!event.startTime) return false;

  const now = DateTime.now();
  const todayIndex = now.weekday % 7;

  let isToday = true;
  if (Array.isArray(event.daysOfWeek) && event.daysOfWeek.length > 0) {
    isToday = event.daysOfWeek.includes(todayIndex);
  } else {
    const localDay = event.extendedProps?.localDay;
    if (localDay && DAY_TO_INDEX[localDay] !== undefined) {
      isToday = DAY_TO_INDEX[localDay] === todayIndex;
    }
  }

  if (!isToday) {
    return false;
  }

  const [hours, minutes] = event.startTime.split(":").map(Number);
  
  const eventStart = now.set({
    hour: hours,
    minute: minutes,
    second: 0,
    millisecond: 0,
  });

  const duration = event.duration || "00:24";
  const [durationHours, durationMinutes] = duration.split(":").map(Number);
  const totalMinutes = (durationHours || 0) * 60 + (durationMinutes || 24);
  const eventEnd = eventStart.plus({ minutes: totalMinutes });

  return now >= eventStart && now <= eventEnd;
}
