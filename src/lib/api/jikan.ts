import type { AnimeData, JikanResponse, SearchAnimeResult } from "@/types/anime";

const BASE_URL = "https://api.jikan.moe/v4";
const RATE_LIMIT_DELAY = 500; // 500ms between requests (2 req/sec)
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const CACHE_MAX_ENTRIES = 100;
const CACHE_STORAGE_KEY = "anime-calendar:jikan-cache";
const RATE_LIMIT_KEY = "anime-calendar:jikan-last-request";
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY = 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const trimSynopsis = (value?: string) => {
  if (!value) return undefined;
  return value.length > 200 ? `${value.slice(0, 200)}...` : value;
};

const sanitizeAnime = (anime: AnimeData): AnimeData => {
  const images = anime.images?.jpg
    ? {
        jpg: {
          image_url: anime.images.jpg.image_url,
          small_image_url: anime.images.jpg.small_image_url,
          large_image_url: anime.images.jpg.large_image_url,
        },
      }
    : {
        jpg: {
          image_url: "",
          small_image_url: "",
          large_image_url: "",
        },
      };

  return {
    mal_id: anime.mal_id,
    title: anime.title,
    title_english: anime.title_english,
    images,
    synopsis: trimSynopsis(anime.synopsis),
    broadcast: anime.broadcast
      ? {
          day: anime.broadcast.day,
          time: anime.broadcast.time,
          timezone: anime.broadcast.timezone,
          string: anime.broadcast.string,
        }
      : undefined,
    url: anime.url,
    score: anime.score,
    status: anime.status ?? "",
  };
};

export class JikanRateLimitError extends Error {
  retryAfter: number | null;

  constructor(retryAfter: number | null) {
    const message = retryAfter
      ? `Rate limit exceeded. Try again in ${retryAfter}s.`
      : "Rate limit exceeded. Please wait a moment and try again.";
    super(message);
    this.name = "JikanRateLimitError";
    this.retryAfter = retryAfter;
  }
}

class JikanClient {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private lastRequestTime = 0;

  constructor() {
    this.loadCacheFromStorage();
  }

  private loadCacheFromStorage(): void {
    try {
      const stored = localStorage.getItem(CACHE_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, CacheEntry<unknown>>;
      if (!parsed || typeof parsed !== "object") return;
      const now = Date.now();
      let hasChanges = false;
      const entries = Object.entries(parsed)
        .filter(([, entry]) => {
          if (!entry || typeof entry.timestamp !== "number") {
            hasChanges = true;
            return false;
          }
          const isExpired = now - entry.timestamp > CACHE_DURATION;
          if (isExpired) hasChanges = true;
          return !isExpired;
        })
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, CACHE_MAX_ENTRIES);

      if (entries.length !== Object.keys(parsed).length) {
        hasChanges = true;
      }

      entries.forEach(([key, entry]) => {
        this.cache.set(key, entry);
      });

      if (hasChanges) {
        this.saveCacheToStorage();
      }
    } catch (error) {
      console.error("Failed to load Jikan cache:", error);
    }
  }

  private saveCacheToStorage(): void {
    try {
      const serialized: Record<string, CacheEntry<unknown>> = {};
      this.cache.forEach((entry, key) => {
        serialized[key] = entry;
      });
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error("Failed to save Jikan cache:", error);
    }
  }

  /**
   * Ensures requests respect rate limiting (2 req/sec)
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    let lastRequestTime = this.lastRequestTime;

    try {
      const stored = localStorage.getItem(RATE_LIMIT_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed)) {
          lastRequestTime = Math.max(lastRequestTime, parsed);
        }
      }
    } catch (error) {
      console.error("Failed to read rate limit timestamp:", error);
    }

    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();

    try {
      localStorage.setItem(RATE_LIMIT_KEY, String(this.lastRequestTime));
    } catch (error) {
      console.error("Failed to store rate limit timestamp:", error);
    }
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
      this.saveCacheToStorage();
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
    if (this.cache.size > CACHE_MAX_ENTRIES) {
      const entries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );
      const overflow = this.cache.size - CACHE_MAX_ENTRIES;
      entries.slice(0, overflow).forEach(([entryKey]) => {
        this.cache.delete(entryKey);
      });
    }
    this.saveCacheToStorage();
  }

  /**
   * Makes a rate-limited request to the Jikan API
   */
  private async request<T>(endpoint: string, transform?: (data: T) => T): Promise<T> {
    const cacheKey = endpoint;
    const cached = this.getCached<T>(cacheKey);

    if (cached) {
      return cached;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      await this.waitForRateLimit();

      try {
        const response = await fetch(`${BASE_URL}${endpoint}`);

        if (response.status === 429) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;
          if (attempt < MAX_RETRIES) {
            const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw new JikanRateLimitError(
            Number.isNaN(retryAfter) ? null : retryAfter
          );
        }

        if (!response.ok) {
          throw new Error(`Jikan API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as T;
        const finalData = transform ? transform(data) : data;
        this.setCache(cacheKey, finalData);

        return finalData;
      } catch (error) {
        if (attempt < MAX_RETRIES) continue;
        console.error("Jikan API request failed:", error);
        throw error;
      }
    }

    throw new Error("Jikan API request failed after retries.");
  }

  /**
   * Gets currently airing anime from the current season with pagination support
   */
  async getSeasonNow(page: number = 1): Promise<SearchAnimeResult> {
    const response = await this.request<JikanResponse<AnimeData[]>>(
      `/seasons/now?page=${page}`,
      (data) => ({
        ...data,
        data: data.data.map(sanitizeAnime),
      })
    );

    // Filter anime that have broadcast information
    const animeWithBroadcast = response.data.filter(
      (anime) => anime.broadcast?.string
    );

    return {
      data: animeWithBroadcast,
      pagination: {
        currentPage: response.pagination?.current_page ?? 1,
        hasNextPage: response.pagination?.has_next_page ?? false,
        lastVisiblePage: response.pagination?.last_visible_page ?? 1,
        totalItems: response.pagination?.items.total ?? 0,
      }
    };
  }

  /**
   * Searches for anime by query with pagination support
   */
  async searchAnime(query: string, page: number = 1): Promise<SearchAnimeResult> {
    if (!query.trim()) {
      return {
        data: [],
        pagination: {
          currentPage: 1,
          hasNextPage: false,
          lastVisiblePage: 1,
          totalItems: 0,
        }
      };
    }

    const encodedQuery = encodeURIComponent(query);
    const response = await this.request<JikanResponse<AnimeData[]>>(
      `/anime?q=${encodedQuery}&status=airing&order_by=popularity&page=${page}`,
      (data) => ({
        ...data,
        data: data.data.map(sanitizeAnime),
      })
    );

    // Filter anime that have broadcast information
    const animeWithBroadcast = response.data.filter(
      (anime) => anime.broadcast?.string
    );

    return {
      data: animeWithBroadcast,
      pagination: {
        currentPage: response.pagination?.current_page ?? 1,
        hasNextPage: response.pagination?.has_next_page ?? false,
        lastVisiblePage: response.pagination?.last_visible_page ?? 1,
        totalItems: response.pagination?.items.total ?? 0,
      }
    };
  }

  /**
   * Gets anime by ID
   */
  async getAnimeById(id: number): Promise<AnimeData | null> {
    try {
      const response = await this.request<JikanResponse<AnimeData>>(
        `/anime/${id}`,
        (data) => ({
          ...data,
          data: sanitizeAnime(data.data),
        })
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
    this.saveCacheToStorage();
  }
}

// Export a singleton instance
export const jikanClient = new JikanClient();
