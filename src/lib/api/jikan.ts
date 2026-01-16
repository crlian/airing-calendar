import type { AnimeData, JikanResponse } from "@/types/anime";

const BASE_URL = "https://api.jikan.moe/v4";
const RATE_LIMIT_DELAY = 500; // 500ms between requests (2 req/sec)
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class JikanClient {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private lastRequestTime = 0;

  /**
   * Ensures requests respect rate limiting (2 req/sec)
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Gets data from cache if available and not expired
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Stores data in cache
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Makes a rate-limited request to the Jikan API
   */
  private async request<T>(endpoint: string): Promise<T> {
    const cacheKey = endpoint;
    const cached = this.getCached<T>(cacheKey);

    if (cached) {
      console.log(`Cache hit for: ${endpoint}`);
      return cached;
    }

    await this.waitForRateLimit();

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`);

      if (!response.ok) {
        throw new Error(`Jikan API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);

      return data as T;
    } catch (error) {
      console.error("Jikan API request failed:", error);
      throw error;
    }
  }

  /**
   * Gets currently airing anime from the current season
   */
  async getSeasonNow(): Promise<AnimeData[]> {
    try {
      const response = await this.request<JikanResponse<AnimeData[]>>(
        "/seasons/now"
      );

      // Filter anime that have broadcast information
      const animeWithBroadcast = response.data.filter(
        (anime) => anime.broadcast?.string
      );

      return animeWithBroadcast;
    } catch (error) {
      console.error("Failed to fetch seasonal anime:", error);
      return [];
    }
  }

  /**
   * Searches for anime by query
   */
  async searchAnime(query: string): Promise<AnimeData[]> {
    if (!query.trim()) return [];

    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await this.request<JikanResponse<AnimeData[]>>(
        `/anime?q=${encodedQuery}&status=airing&order_by=popularity`
      );

      // Filter anime that have broadcast information
      const animeWithBroadcast = response.data.filter(
        (anime) => anime.broadcast?.string
      );

      return animeWithBroadcast;
    } catch (error) {
      console.error("Failed to search anime:", error);
      return [];
    }
  }

  /**
   * Gets anime by ID
   */
  async getAnimeById(id: number): Promise<AnimeData | null> {
    try {
      const response = await this.request<JikanResponse<AnimeData>>(
        `/anime/${id}`
      );

      return response.data;
    } catch (error) {
      console.error(`Failed to fetch anime ${id}:`, error);
      return null;
    }
  }

  /**
   * Clears the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export a singleton instance
export const jikanClient = new JikanClient();
