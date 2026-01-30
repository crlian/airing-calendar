import { DateTime } from "luxon";
import type { LocalBroadcastTime } from "@/types/calendar";

const DAY_MAP: { [key: string]: number } = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Converts JST broadcast time to local timezone
 * @param day - Day of the week in JST (e.g., "Saturday")
 * @param time - Time in JST (e.g., "01:00")
 * @returns LocalBroadcastTime with converted day, time, and datetime
 */
export function convertJSTToLocal(
  day: string,
  time: string
): LocalBroadcastTime | null {
  try {
    // Parse the time (HH:mm format)
    const [hours, minutes] = time.split(":").map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
      console.error("Invalid time format:", time);
      return null;
    }

    // Get the day index
    const dayIndex = DAY_MAP[day];
    if (dayIndex === undefined) {
      console.error("Invalid day:", day);
      return null;
    }

    // Get current week's date for the given day in JST
    const now = DateTime.now().setZone("Asia/Tokyo");
    const currentDayOfWeek = now.weekday % 7; // Luxon uses 1-7, we need 0-6

    // Calculate days difference to get to the target day
    let daysToAdd = dayIndex - currentDayOfWeek;

    // If the day already passed this week, go to next week
    if (daysToAdd < 0) {
      daysToAdd += 7;
    }

    // Create a DateTime in JST for the broadcast time
    const jstDateTime = now
      .plus({ days: daysToAdd })
      .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

    // Convert to local timezone
    const localDateTime = jstDateTime.setZone("local");

    // Get local day name
    const localDayIndex = localDateTime.weekday % 7;
    const localDayName = Object.keys(DAY_MAP).find(
      (key) => DAY_MAP[key] === localDayIndex
    );

    if (!localDayName) {
      console.error("Could not determine local day name");
      return null;
    }

    return {
      localDay: localDayName,
      localTime: localDateTime.toFormat("HH:mm"),
      localDatetime: localDateTime.toJSDate(),
    };
  } catch (error) {
    console.error("Error converting timezone:", error);
    return null;
  }
}

/**
 * Gets the datetime for a specific day and time in the current week
 * @param dayName - Day of the week (e.g., "Saturday")
 * @param time - Time in HH:mm format
 * @returns DateTime object for the specified day and time this week
 */
export function getDateTimeForCurrentWeek(
  dayName: string,
  time: string
): DateTime | null {
  try {
    const dayIndex = DAY_MAP[dayName];
    if (dayIndex === undefined) return null;

    const [hours, minutes] = time.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;

    const now = DateTime.local();
    const currentDayOfWeek = now.weekday % 7;

    // Calculate days to add to get to target day
    let daysToAdd = dayIndex - currentDayOfWeek;

    // If the day already passed this week, go to next week
    if (daysToAdd < 0) {
      daysToAdd += 7;
    }

    // Create DateTime for the target day and time this week
    const targetDateTime = now
      .plus({ days: daysToAdd })
      .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

    return targetDateTime;
  } catch (error) {
    console.error("Error getting datetime for current week:", error);
    return null;
  }
}

/**
 * Formats a DateTime object to ISO string for FullCalendar
 */
export function toISOString(date: DateTime | Date): string {
  if (date instanceof Date) {
    return DateTime.fromJSDate(date).toISO() || "";
  }
  return date.toISO() || "";
}

/**
 * Converts Unix timestamp to local broadcast time
 * @param timestamp - Unix timestamp in seconds (from AniList)
 * @returns LocalBroadcastTime with converted day, time, and datetime
 */
export function convertUnixToLocal(timestamp: number): LocalBroadcastTime | null {
  try {
    // AniList provides Unix timestamp in seconds (UTC)
    const dateTime = DateTime.fromSeconds(timestamp, { zone: "utc" });

    // Convert to local timezone
    const localDateTime = dateTime.setZone("local");

    // Get local day name
    const localDayIndex = localDateTime.weekday % 7;
    const localDayName = Object.keys(DAY_MAP).find(
      (key) => DAY_MAP[key] === localDayIndex
    );

    if (!localDayName) {
      console.error("Could not determine local day name from timestamp");
      return null;
    }

    return {
      localDay: localDayName,
      localTime: localDateTime.toFormat("HH:mm"),
      localDatetime: localDateTime.toJSDate(),
    };
  } catch (error) {
    console.error("Error converting Unix timestamp to local time:", error);
    return null;
  }
}
