import type { CalendarEvent } from "@/types/calendar";
import { DateTime } from "luxon";

interface ICSOptions {
  title?: string;
  description?: string;
}

/**
 * Generates an ICS (iCalendar) file from calendar events
 * Supports both download and clipboard copy
 */
export function generateICS(
  events: CalendarEvent[],
  options: ICSOptions = {}
): { content: string; filename: string } {
  const { title = "Anime Schedule", description = "My anime airing schedule" } = options;

  const now = DateTime.now().toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Anime Season//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(title)}`,
    `X-WR-CALDESC:${escapeICS(description)}`,
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Tokyo",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  events.forEach((event) => {
    const animeData = event.extendedProps?.animeData;
    if (!animeData) return;

    // Use nextOccurrence or start date
    const startDate = event.extendedProps?.nextOccurrence || event.start;
    if (!startDate) return;

    const start = DateTime.fromJSDate(
      typeof startDate === "string" ? new Date(startDate) : startDate
    ).setZone("Asia/Tokyo");

    // Calculate end time based on duration (default 24 minutes if not specified)
    const durationMinutes = parseDuration(animeData.duration);
    const end = start.plus({ minutes: durationMinutes });

    const uid = `${animeData.mal_id}-${start.toFormat("yyyyMMdd")}@aniseason.com`;
    const dtstart = start.toFormat("yyyyMMdd'T'HHmmss");
    const dtend = end.toFormat("yyyyMMdd'T'HHmmss");

    // Build description
    let eventDesc = "";
    if (animeData.synopsis) {
      eventDesc += `Synopsis: ${animeData.synopsis}\n\n`;
    }
    eventDesc += `MAL: ${animeData.url}`;

    icsContent.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=Asia/Tokyo:${dtstart}`,
      `DTEND;TZID=Asia/Tokyo:${dtend}`,
      `SUMMARY:${escapeICS(animeData.title_english || animeData.title)}`,
      `DESCRIPTION:${escapeICS(eventDesc)}`,
      `URL:${animeData.url}`,
      "RRULE:FREQ=WEEKLY",
      "END:VEVENT"
    );
  });

  icsContent.push("END:VCALENDAR");

  return {
    content: icsContent.join("\r\n"),
    filename: "anime-schedule.ics",
  };
}

/**
 * Downloads the ICS file
 */
export function downloadICS(events: CalendarEvent[], options?: ICSOptions): void {
  const { content, filename } = generateICS(events, options);

  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Copies ICS content to clipboard
 */
export async function copyICSToClipboard(
  events: CalendarEvent[],
  options?: ICSOptions
): Promise<boolean> {
  try {
    const { content } = generateICS(events, options);
    await navigator.clipboard.writeText(content);
    return true;
  } catch (error) {
    console.error("Failed to copy ICS to clipboard:", error);
    return false;
  }
}

/**
 * Escapes special characters for ICS format
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/**
 * Parses duration string to minutes
 * Handles formats like "24 min per ep" or "24min"
 */
function parseDuration(duration?: string): number {
  if (!duration) return 24; // Default 24 minutes

  const match = duration.match(/(\d+)/);
  if (match) {
    const minutes = parseInt(match[1], 10);
    return minutes > 0 && minutes < 180 ? minutes : 24;
  }

  return 24;
}
