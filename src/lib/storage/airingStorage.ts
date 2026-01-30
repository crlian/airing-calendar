import type { AiringScheduleData } from "@/types/anime";

const STORAGE_KEY = "anime-calendar:airing-schedule";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const AiringStorage = {
  /**
   * Gets airing data for a specific anime by MAL ID
   */
  getAiring(malId: number): AiringScheduleData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored) as Record<string, AiringScheduleData>;
      const airing = data[malId];

      if (!airing) return null;

      // Check if cache is still valid
      const now = Date.now();
      if (now - airing.lastFetched > CACHE_TTL_MS) {
        return null;
      }

      return airing;
    } catch (error) {
      console.error("Error reading airing data from localStorage:", error);
      return null;
    }
  },

  /**
   * Gets airing data for multiple anime IDs
   */
  getMultiple(malIds: number[]): Record<number, AiringScheduleData> {
    const result: Record<number, AiringScheduleData> = {};

    for (const malId of malIds) {
      const airing = this.getAiring(malId);
      if (airing) {
        result[malId] = airing;
      }
    }

    return result;
  },

  /**
   * Saves airing data for a specific anime
   */
  setAiring(malId: number, data: AiringScheduleData): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allData: Record<string, AiringScheduleData> = stored
        ? JSON.parse(stored)
        : {};

      allData[malId] = {
        ...data,
        lastFetched: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
    } catch (error) {
      console.error("Error saving airing data to localStorage:", error);
    }
  },

  /**
   * Removes airing data for a specific anime
   */
  removeAiring(malId: number): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const allData = JSON.parse(stored) as Record<string, AiringScheduleData>;
      delete allData[malId];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
    } catch (error) {
      console.error("Error removing airing data from localStorage:", error);
    }
  },

  /**
   * Gets all stale airing data (expired cache)
   */
  getStaleIds(malIds: number[]): number[] {
    const now = Date.now();
    const stale: number[] = [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return malIds; // All are stale if no cache
      }

      const data = JSON.parse(stored) as Record<string, AiringScheduleData>;

      for (const malId of malIds) {
        const airing = data[malId];
        if (!airing || now - airing.lastFetched > CACHE_TTL_MS) {
          stale.push(malId);
        }
      }
    } catch (error) {
      console.error("Error checking stale airing data:", error);
      return malIds; // Assume all stale on error
    }

    return stale;
  },

  /**
   * Clears all airing data
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Error clearing airing storage:", error);
    }
  },
};
