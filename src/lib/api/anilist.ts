import type {
  AnimeData,
  SearchAnimeResult,
  AiringScheduleData,
} from "@/types/anime";

// Extended result that includes airing schedule data
export interface AniListAnimeResult extends SearchAnimeResult {
  airingData: Map<number, AiringScheduleData>;
}

const ANILIST_URL = "https://graphql.anilist.co";
const RATE_LIMIT_DELAY = 700; // 700ms between requests
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX_ENTRIES = 100;
const CACHE_STORAGE_KEY = "anime-calendar:anilist-cache";
const RATE_LIMIT_KEY = "anime-calendar:anilist-last-request";
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY = 1000;

// AniList GraphQL Types
interface AniListPageInfo {
  hasNextPage: boolean;
  total: number;
  currentPage: number;
  lastPage: number;
}

interface AniListMediaTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

interface AniListMediaCoverImage {
  large: string | null;
  medium: string | null;
}

interface AniListAiringSchedule {
  episode: number;
  airingAt: number;
}

interface AniListMedia {
  id: number;
  idMal: number | null;
  title: AniListMediaTitle;
  description: string | null;
  coverImage: AniListMediaCoverImage | null;
  duration: number | null;
  episodes: number | null;
  status: string | null;
  averageScore: number | null;
  nextAiringEpisode: AniListAiringSchedule | null;
}

interface AniListPageResponse {
  data: {
    Page: {
      pageInfo: AniListPageInfo;
      media: AniListMedia[];
    };
  };
}

interface AniListMediaResponse {
  data: {
    Media: AniListMedia | null;
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

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

/**
 * Convert AniList duration (minutes int) to Jikan-style string
 */
function formatDuration(minutes: number | null): string | undefined {
  if (!minutes) return undefined;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

/**
 * Convert AniList score (0-100) to Jikan-style (0-10)
 */
function formatScore(score: number | null): number | undefined {
  if (!score) return undefined;
  return Math.round((score / 10) * 10) / 10; // 85 → 8.5
}

/**
 * Sanitize HTML description
 */
function sanitizeDescription(desc: string | null): string | undefined {
  if (!desc) return undefined;
  // Remove HTML tags and truncate
  const plain = desc.replace(/<[^>]*>/g, "");
  return plain.length > 200 ? `${plain.slice(0, 200)}...` : plain;
}

/**
 * Transform AniList media to AnimeData format
 */
function transformAniListToAnimeData(media: AniListMedia): AnimeData | null {
  if (!media.idMal) {
    console.warn(`Skipping anime without MAL ID: ${media.title.romaji}`);
    return null;
  }

  return {
    mal_id: media.idMal,
    title: media.title.romaji || media.title.native || "Unknown",
    title_english: media.title.english || undefined,
    images: {
      jpg: {
        image_url: media.coverImage?.medium || "",
        small_image_url: media.coverImage?.medium || "",
        large_image_url: media.coverImage?.large || "",
      },
    },
    synopsis: sanitizeDescription(media.description),
    duration: formatDuration(media.duration),
    // No broadcast field needed - we use nextAiringEpisode
    url: `https://myanimelist.net/anime/${media.idMal}`,
    score: formatScore(media.averageScore),
    status: media.status || "",
  };
}

class AniListClient {
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
      console.error("Failed to load AniList cache:", error);
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
      console.error("Failed to save AniList cache:", error);
    }
  }

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

  private async request<T>(
    query: string,
    variables: Record<string, unknown>,
    cacheKey: string
  ): Promise<T> {
    const cached = this.getCached<T>(cacheKey);
    if (cached) {
      return cached;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      await this.waitForRateLimit();

      try {
        const response = await fetch(ANILIST_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ query, variables }),
        });

        // Check rate limit headers
        const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
        if (rateLimitRemaining === "0") {
          const retryAfter = response.headers.get("Retry-After");
          if (attempt < MAX_RETRIES) {
            const delay = retryAfter
              ? Number(retryAfter) * 1000
              : RETRY_BASE_DELAY * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw new AniListRateLimitError(
            retryAfter ? Number(retryAfter) : null
          );
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          if (attempt < MAX_RETRIES) {
            const delay = retryAfter
              ? Number(retryAfter) * 1000
              : RETRY_BASE_DELAY * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw new AniListRateLimitError(
            retryAfter ? Number(retryAfter) : null
          );
        }

        if (!response.ok) {
          throw new Error(
            `AniList API error: ${response.status} ${response.statusText}`
          );
        }

        const data = (await response.json()) as T;
        this.setCache(cacheKey, data);
        return data;
      } catch (error) {
        if (attempt < MAX_RETRIES) continue;
        console.error("AniList API request failed:", error);
        throw error;
      }
    }

    throw new Error("AniList API request failed after retries.");
  }

  /**
   * Gets currently airing anime from the current season
   */
  async getSeasonNow(page: number = 1): Promise<AniListAnimeResult> {
    const { season, year } = this.getCurrentSeason();

    const query = `
      query SeasonalAnime($season: MediaSeason!, $year: Int!, $page: Int, $perPage: Int = 25) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            hasNextPage
            total
            currentPage
            lastPage
          }
          media(
            season: $season
            seasonYear: $year
            type: ANIME
            status: RELEASING
            sort: POPULARITY_DESC
          ) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              medium
            }
            duration
            episodes
            status
            averageScore
            nextAiringEpisode {
              episode
              airingAt
            }
          }
        }
      }
    `;

    const cacheKey = `seasonal:${season}:${year}:${page}`;

    try {
      const response = await this.request<AniListPageResponse>(
        query,
        { season, year, page, perPage: 25 },
        cacheKey
      );

      // Extract anime data and airing schedules
      // Filter: only include anime with both MAL ID AND airing schedule
      const airingData = new Map<number, AiringScheduleData>();
      const animeWithAiring: AnimeData[] = [];

      for (const media of response.data.Page.media) {
        // Skip if no MAL ID (can't match with our storage) or no airing schedule
        if (!media.idMal || !media.nextAiringEpisode) {
          continue;
        }

        const anime = transformAniListToAnimeData(media);
        if (anime) {
          animeWithAiring.push(anime);
          airingData.set(media.idMal, {
            nextEpisode: media.nextAiringEpisode.episode,
            airingAt: media.nextAiringEpisode.airingAt,
            lastFetched: Date.now(),
          });
        }
      }

      return {
        data: animeWithAiring,
        pagination: {
          currentPage: response.data.Page.pageInfo.currentPage,
          hasNextPage: response.data.Page.pageInfo.hasNextPage,
          lastVisiblePage: response.data.Page.pageInfo.lastPage,
          totalItems: response.data.Page.pageInfo.total,
        },
        airingData,
      };
    } catch (error) {
      console.error("Error fetching seasonal anime from AniList:", error);
      throw error;
    }
  }

  /**
   * Searches for anime by query
   */
  async searchAnime(query: string, page: number = 1): Promise<AniListAnimeResult> {
    if (!query.trim()) {
      return {
        data: [],
        pagination: {
          currentPage: 1,
          hasNextPage: false,
          lastVisiblePage: 1,
          totalItems: 0,
        },
        airingData: new Map(),
      };
    }

    const graphqlQuery = `
      query SearchAnime($search: String!, $page: Int, $perPage: Int = 25) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            hasNextPage
            total
            currentPage
            lastPage
          }
          media(
            search: $search
            type: ANIME
            status: RELEASING
            sort: POPULARITY_DESC
          ) {
            id
            idMal
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              large
              medium
            }
            duration
            episodes
            status
            averageScore
            nextAiringEpisode {
              episode
              airingAt
            }
          }
        }
      }
    `;

    const cacheKey = `search:${query.toLowerCase()}:${page}`;

    try {
      const response = await this.request<AniListPageResponse>(
        graphqlQuery,
        { search: query, page, perPage: 25 },
        cacheKey
      );

      // Extract anime data and airing schedules
      // Filter: only include anime with both MAL ID AND airing schedule
      const airingData = new Map<number, AiringScheduleData>();
      const animeResults: AnimeData[] = [];

      for (const media of response.data.Page.media) {
        // Skip if no MAL ID (can't match with our storage) or no airing schedule
        if (!media.idMal || !media.nextAiringEpisode) {
          continue;
        }

        const anime = transformAniListToAnimeData(media);
        if (anime) {
          animeResults.push(anime);
          airingData.set(media.idMal, {
            nextEpisode: media.nextAiringEpisode.episode,
            airingAt: media.nextAiringEpisode.airingAt,
            lastFetched: Date.now(),
          });
        }
      }

      return {
        data: animeResults,
        pagination: {
          currentPage: response.data.Page.pageInfo.currentPage,
          hasNextPage: response.data.Page.pageInfo.hasNextPage,
          lastVisiblePage: response.data.Page.pageInfo.lastPage,
          totalItems: response.data.Page.pageInfo.total,
        },
        airingData,
      };
    } catch (error) {
      console.error("Error searching anime from AniList:", error);
      throw error;
    }
  }

  /**
   * Gets anime by MAL ID
   */
  async getAnimeById(malId: number): Promise<AnimeData | null> {
    const query = `
      query GetAnimeByMalId($malId: Int!) {
        Media(idMal: $malId, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          description
          coverImage {
            large
            medium
          }
          duration
          episodes
          status
          averageScore
          nextAiringEpisode {
            episode
            airingAt
          }
        }
      }
    `;

    const cacheKey = `anime:${malId}`;

    try {
      const response = await this.request<AniListMediaResponse>(
        query,
        { malId },
        cacheKey
      );

      if (!response.data.Media) {
        return null;
      }

      return transformAniListToAnimeData(response.data.Media);
    } catch (error) {
      console.error(`Failed to fetch anime ${malId} from AniList:`, error);
      return null;
    }
  }

  /**
   * Extracts airing schedule data from media
   */
  extractAiringSchedule(media: {
    nextAiringEpisode: { episode: number; airingAt: number } | null;
  }): AiringScheduleData | null {
    if (!media.nextAiringEpisode) {
      return null;
    }

    return {
      nextEpisode: media.nextAiringEpisode.episode,
      airingAt: media.nextAiringEpisode.airingAt,
      lastFetched: Date.now(),
    };
  }

  /**
   * Clears the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.saveCacheToStorage();
  }

  /**
   * Get current anime season based on month
   */
  private getCurrentSeason(): { season: string; year: number } {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const year = now.getFullYear();

    // Winter: Jan-Mar (0-2), Spring: Apr-Jun (3-5), Summer: Jul-Sep (6-8), Fall: Oct-Dec (9-11)
    if (month <= 2) return { season: "WINTER", year };
    if (month <= 5) return { season: "SPRING", year };
    if (month <= 8) return { season: "SUMMER", year };
    return { season: "FALL", year };
  }
}

// Export a singleton instance
export const anilistClient = new AniListClient();
