import type {
  AnimeData,
  SearchAnimeResult,
  AiringScheduleData,
} from "@/types/anime";

export type DataSource = "anilist" | "jikan";

// Extended result that includes airing schedule data and source
export interface AniListAnimeResult extends SearchAnimeResult {
  airingData: Map<number, AiringScheduleData>;
  source: DataSource;
}

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX_ENTRIES = 100;
const CACHE_STORAGE_KEY = "anime-calendar:anilist-cache";

export class AniListRateLimitError extends Error {
  retryAfter: number | null;

  constructor(retryAfter: number | null) {
    const message = retryAfter
      ? `Rate limit exceeded. Try again in ${retryAfter}s.`
      : "Rate limit exceeded. Please wait a moment and try again.";
    super(message);
    this.name = "AniListRateLimitError";
    this.retryAfter = retryAfter;
  }
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface ProxyListResponse {
  data: AnimeData[];
  pagination: {
    currentPage: number;
    hasNextPage: boolean;
    lastVisiblePage: number;
    totalItems: number;
  };
  airingData: Record<number, { nextEpisode: number; airingAt: number }>;
  source: DataSource;
}

interface ProxySingleResponse {
  data: AnimeData | null;
  source: DataSource;
}

class AnimeApiClient {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

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
      console.error("Failed to load cache:", error);
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
      console.error("Failed to save cache:", error);
    }
  }

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

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
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

  private toAiringMap(raw: unknown): Map<number, AiringScheduleData> {
    const map = new Map<number, AiringScheduleData>();
    if (!raw || typeof raw !== "object") return map;
    // Handle both Map instances (in-memory cache) and plain objects (localStorage)
    const entries = raw instanceof Map ? raw.entries() : Object.entries(raw);
    for (const [key, value] of entries) {
      if (value && typeof value === "object" && "airingAt" in value) {
        map.set(Number(key), {
          nextEpisode: (value as AiringScheduleData).nextEpisode,
          airingAt: (value as AiringScheduleData).airingAt,
          lastFetched: (value as AiringScheduleData).lastFetched ?? Date.now(),
        });
      }
    }
    return map;
  }

  private parseListResponse(json: ProxyListResponse): AniListAnimeResult {
    return {
      data: json.data,
      pagination: json.pagination,
      airingData: this.toAiringMap(json.airingData),
      source: json.source,
    };
  }

  /**
   * Gets currently airing anime from the current season
   */
  async getSeasonNow(page: number = 1): Promise<AniListAnimeResult> {
    const cacheKey = `seasonal:${page}`;
    const cached = this.getCached<AniListAnimeResult>(cacheKey);
    if (cached) {
      cached.airingData = this.toAiringMap(cached.airingData);
      return cached;
    }

    const response = await fetch(`/api/anime?action=seasonal&page=${page}`);

    if (response.status === 429) {
      throw new AniListRateLimitError(null);
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const json: ProxyListResponse = await response.json();
    const result = this.parseListResponse(json);
    this.setCache(cacheKey, {
      ...result,
      airingData: Object.fromEntries(result.airingData),
    });
    return result;
  }

  /**
   * Searches for anime by query
   */
  async searchAnime(query: string, page: number = 1): Promise<AniListAnimeResult> {
    if (!query.trim()) {
      return {
        data: [],
        pagination: { currentPage: 1, hasNextPage: false, lastVisiblePage: 1, totalItems: 0 },
        airingData: new Map(),
        source: "anilist",
      };
    }

    const cacheKey = `search:${query.toLowerCase()}:${page}`;
    const cached = this.getCached<AniListAnimeResult>(cacheKey);
    if (cached) {
      cached.airingData = this.toAiringMap(cached.airingData);
      return cached;
    }

    const params = new URLSearchParams({ action: "search", q: query, page: String(page) });
    const response = await fetch(`/api/anime?${params}`);

    if (response.status === 429) {
      throw new AniListRateLimitError(null);
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const json: ProxyListResponse = await response.json();
    const result = this.parseListResponse(json);
    this.setCache(cacheKey, {
      ...result,
      airingData: Object.fromEntries(result.airingData),
    });
    return result;
  }

  /**
   * Gets anime by MAL ID
   */
  async getAnimeById(malId: number): Promise<AnimeData | null> {
    const cacheKey = `anime:${malId}`;
    const cached = this.getCached<AnimeData | null>(cacheKey);
    if (cached !== null) return cached;

    const response = await fetch(`/api/anime?action=getById&malId=${malId}`);

    if (!response.ok) {
      console.error(`Failed to fetch anime ${malId}`);
      return null;
    }

    const json: ProxySingleResponse = await response.json();
    this.setCache(cacheKey, json.data);
    return json.data;
  }

  /**
   * Clears the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.saveCacheToStorage();
  }
}

// Export a singleton instance (keep the same export name for compatibility)
export const anilistClient = new AnimeApiClient();
