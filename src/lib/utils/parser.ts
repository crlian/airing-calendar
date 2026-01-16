import type { ParsedBroadcast } from "@/types/anime";

/**
 * Parses a broadcast string from Jikan API
 * Examples:
 * - "Saturdays at 01:00 (JST)"
 * - "Mondays at 23:00 (JST)"
 * - "Fridays at 16:30 (JST)"
 */
export function parseBroadcastString(
  broadcastString: string
): ParsedBroadcast | null {
  if (!broadcastString) return null;

  try {
    // Pattern: "Day at HH:MM (TIMEZONE)"
    const pattern = /^(\w+)\s+at\s+(\d{1,2}:\d{2})/i;
    const match = broadcastString.match(pattern);

    if (!match) return null;

    const [, day, time] = match;

    // Remove trailing 's' if present (Thursdays -> Thursday)
    let dayName = day.replace(/s$/i, '');

    // Capitalize first letter, rest lowercase
    const normalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();

    return {
      day: normalizedDay,
      time: time,
    };
  } catch (error) {
    console.error("Error parsing broadcast string:", broadcastString, error);
    return null;
  }
}

/**
 * Validates if the parsed broadcast has all required fields
 */
export function isValidBroadcast(
  broadcast: ParsedBroadcast | null
): broadcast is ParsedBroadcast {
  return broadcast !== null && Boolean(broadcast.day) && Boolean(broadcast.time);
}
