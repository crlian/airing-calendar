// Unified anime proxy: AniList (primary) with Jikan/MAL fallback
// Vercel serverless function

const ANILIST_URL = "https://graphql.anilist.co";
const JIKAN_URL = "https://api.jikan.moe/v4";
const ANILIST_TIMEOUT = 5000;
const JIKAN_TIMEOUT = 10000;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Types ---

interface CacheEntry {
  data: unknown;
  expiry: number;
}

interface ProxyAnimeData {
  mal_id: number;
  title: string;
  title_english?: string;
  title_japanese?: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  synopsis?: string;
  duration?: string;
  broadcast?: {
    day: string;
    time: string;
    timezone: string;
    string: string;
  };
  url: string;
  score?: number;
  episodes?: number;
  status: string;
}

interface AiringInfo {
  nextEpisode: number;
  airingAt: number;
}

interface ProxyResponse {
  data: ProxyAnimeData[];
  pagination: {
    currentPage: number;
    hasNextPage: boolean;
    lastVisiblePage: number;
    totalItems: number;
  };
  airingData: Record<number, AiringInfo>;
  source: "anilist" | "jikan";
}

interface ProxySingleResponse {
  data: ProxyAnimeData | null;
  source: "anilist" | "jikan";
}

// --- Server-side cache (survives warm invocations) ---

const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
  // Evict old entries if cache grows too large
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiry < now) cache.delete(k);
    }
  }
}

// --- Circuit breaker for AniList ---

let anilistFailures = 0;
let anilistCircuitOpenUntil = 0;

function isAnilistCircuitOpen(): boolean {
  if (Date.now() < anilistCircuitOpenUntil) return true;
  return false;
}

function recordAnilistFailure(): void {
  anilistFailures++;
  if (anilistFailures >= 3) {
    anilistCircuitOpenUntil = Date.now() + 60_000; // skip AniList for 60s
    anilistFailures = 0;
  }
}

function recordAnilistSuccess(): void {
  anilistFailures = 0;
  anilistCircuitOpenUntil = 0;
}

// --- Fetch with timeout ---

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// --- AniList helpers ---

function getCurrentSeason(): { season: string; year: number } {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month <= 2) return { season: "WINTER", year };
  if (month <= 5) return { season: "SPRING", year };
  if (month <= 8) return { season: "SUMMER", year };
  return { season: "FALL", year };
}

function formatDuration(minutes: number | null): string | undefined {
  if (!minutes) return undefined;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

function formatScore(score: number | null): number | undefined {
  if (!score) return undefined;
  return Math.round((score / 10) * 10) / 10;
}

function sanitizeDescription(desc: string | null): string | undefined {
  if (!desc) return undefined;
  const plain = desc.replace(/<[^>]*>/g, "");
  return plain.length > 200 ? `${plain.slice(0, 200)}...` : plain;
}

interface AniListMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  coverImage: { large: string | null; medium: string | null } | null;
  duration: number | null;
  episodes: number | null;
  status: string | null;
  averageScore: number | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
}

function transformAniListMedia(media: AniListMedia): {
  anime: ProxyAnimeData;
  airing: AiringInfo | null;
} | null {
  if (!media.idMal) return null;

  const anime: ProxyAnimeData = {
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
    url: `https://myanimelist.net/anime/${media.idMal}`,
    score: formatScore(media.averageScore),
    episodes: media.episodes || undefined,
    status: media.status || "",
  };

  const airing = media.nextAiringEpisode
    ? { nextEpisode: media.nextAiringEpisode.episode, airingAt: media.nextAiringEpisode.airingAt }
    : null;

  return { anime, airing };
}

// --- AniList fetchers ---

async function anilistSeasonal(page: number): Promise<ProxyResponse> {
  const { season, year } = getCurrentSeason();
  const query = `
    query SeasonalAnime($season: MediaSeason!, $year: Int!, $page: Int, $perPage: Int = 25) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total currentPage lastPage }
        media(season: $season, seasonYear: $year, type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
          id idMal
          title { romaji english native }
          description
          coverImage { large medium }
          duration episodes status averageScore
          nextAiringEpisode { episode airingAt }
        }
      }
    }
  `;

  const res = await fetchWithTimeout(
    ANILIST_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { season, year, page, perPage: 25 } }),
    },
    ANILIST_TIMEOUT
  );

  if (!res.ok) throw new Error(`AniList ${res.status}`);

  const json = await res.json();
  const pageData = json.data?.Page;
  if (!pageData) throw new Error("Invalid AniList response");

  const data: ProxyAnimeData[] = [];
  const airingData: Record<number, AiringInfo> = {};

  for (const media of pageData.media) {
    if (!media.idMal || !media.nextAiringEpisode) continue;
    const result = transformAniListMedia(media);
    if (result) {
      data.push(result.anime);
      if (result.airing) airingData[result.anime.mal_id] = result.airing;
    }
  }

  return {
    data,
    pagination: {
      currentPage: pageData.pageInfo.currentPage,
      hasNextPage: pageData.pageInfo.hasNextPage,
      lastVisiblePage: pageData.pageInfo.lastPage,
      totalItems: pageData.pageInfo.total,
    },
    airingData,
    source: "anilist",
  };
}

async function anilistSearch(q: string, page: number): Promise<ProxyResponse> {
  const query = `
    query SearchAnime($search: String!, $page: Int, $perPage: Int = 25) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total currentPage lastPage }
        media(search: $search, type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
          id idMal
          title { romaji english native }
          description
          coverImage { large medium }
          duration episodes status averageScore
          nextAiringEpisode { episode airingAt }
        }
      }
    }
  `;

  const res = await fetchWithTimeout(
    ANILIST_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { search: q, page, perPage: 25 } }),
    },
    ANILIST_TIMEOUT
  );

  if (!res.ok) throw new Error(`AniList ${res.status}`);

  const json = await res.json();
  const pageData = json.data?.Page;
  if (!pageData) throw new Error("Invalid AniList response");

  const data: ProxyAnimeData[] = [];
  const airingData: Record<number, AiringInfo> = {};

  for (const media of pageData.media) {
    if (!media.idMal || !media.nextAiringEpisode) continue;
    const result = transformAniListMedia(media);
    if (result) {
      data.push(result.anime);
      if (result.airing) airingData[result.anime.mal_id] = result.airing;
    }
  }

  return {
    data,
    pagination: {
      currentPage: pageData.pageInfo.currentPage,
      hasNextPage: pageData.pageInfo.hasNextPage,
      lastVisiblePage: pageData.pageInfo.lastPage,
      totalItems: pageData.pageInfo.total,
    },
    airingData,
    source: "anilist",
  };
}

async function anilistGetById(malId: number): Promise<ProxySingleResponse> {
  const query = `
    query GetAnimeByMalId($malId: Int!) {
      Media(idMal: $malId, type: ANIME) {
        id idMal
        title { romaji english native }
        description
        coverImage { large medium }
        duration episodes status averageScore
        nextAiringEpisode { episode airingAt }
      }
    }
  `;

  const res = await fetchWithTimeout(
    ANILIST_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { malId } }),
    },
    ANILIST_TIMEOUT
  );

  if (!res.ok) throw new Error(`AniList ${res.status}`);

  const json = await res.json();
  const media = json.data?.Media;
  if (!media) return { data: null, source: "anilist" };

  const result = transformAniListMedia(media);
  return { data: result?.anime || null, source: "anilist" };
}

// --- Jikan helpers ---

function sanitizeJikanAnime(anime: any): ProxyAnimeData {
  return {
    mal_id: anime.mal_id,
    title: anime.title || "Unknown",
    title_english: anime.title_english || undefined,
    title_japanese: anime.title_japanese || undefined,
    images: {
      jpg: {
        image_url: anime.images?.jpg?.image_url || "",
        small_image_url: anime.images?.jpg?.small_image_url || "",
        large_image_url: anime.images?.jpg?.large_image_url || "",
      },
    },
    synopsis: anime.synopsis
      ? anime.synopsis.length > 200
        ? `${anime.synopsis.slice(0, 200)}...`
        : anime.synopsis
      : undefined,
    duration: anime.duration || undefined,
    broadcast: anime.broadcast?.day
      ? {
          day: anime.broadcast.day,
          time: anime.broadcast.time || "",
          timezone: anime.broadcast.timezone || "Asia/Tokyo",
          string: anime.broadcast.string || "",
        }
      : undefined,
    url: anime.url || `https://myanimelist.net/anime/${anime.mal_id}`,
    score: anime.score || undefined,
    episodes: anime.episodes || undefined,
    status: anime.status || "",
  };
}

// --- Jikan fetchers ---

async function jikanSeasonal(page: number): Promise<ProxyResponse> {
  const res = await fetchWithTimeout(
    `${JIKAN_URL}/seasons/now?page=${page}`,
    { method: "GET", headers: { Accept: "application/json" } },
    JIKAN_TIMEOUT
  );

  if (!res.ok) throw new Error(`Jikan ${res.status}`);

  const json = await res.json();
  const data: ProxyAnimeData[] = (json.data || []).map(sanitizeJikanAnime);

  return {
    data,
    pagination: {
      currentPage: json.pagination?.current_page || page,
      hasNextPage: json.pagination?.has_next_page || false,
      lastVisiblePage: json.pagination?.last_visible_page || 1,
      totalItems: json.pagination?.items?.total || data.length,
    },
    airingData: {}, // Jikan doesn't provide nextAiringEpisode in seasonal endpoint
    source: "jikan",
  };
}

async function jikanSearch(q: string, page: number): Promise<ProxyResponse> {
  const params = new URLSearchParams({
    q,
    status: "airing",
    order_by: "popularity",
    page: String(page),
  });

  const res = await fetchWithTimeout(
    `${JIKAN_URL}/anime?${params}`,
    { method: "GET", headers: { Accept: "application/json" } },
    JIKAN_TIMEOUT
  );

  if (!res.ok) throw new Error(`Jikan ${res.status}`);

  const json = await res.json();
  const data: ProxyAnimeData[] = (json.data || []).map(sanitizeJikanAnime);

  return {
    data,
    pagination: {
      currentPage: json.pagination?.current_page || page,
      hasNextPage: json.pagination?.has_next_page || false,
      lastVisiblePage: json.pagination?.last_visible_page || 1,
      totalItems: json.pagination?.items?.total || data.length,
    },
    airingData: {},
    source: "jikan",
  };
}

async function jikanGetById(malId: number): Promise<ProxySingleResponse> {
  const res = await fetchWithTimeout(
    `${JIKAN_URL}/anime/${malId}`,
    { method: "GET", headers: { Accept: "application/json" } },
    JIKAN_TIMEOUT
  );

  if (!res.ok) throw new Error(`Jikan ${res.status}`);

  const json = await res.json();
  if (!json.data) return { data: null, source: "jikan" };

  return { data: sanitizeJikanAnime(json.data), source: "jikan" };
}

// --- Main handler with fallback ---

async function withFallback<T extends { source: "anilist" | "jikan" }>(
  anilistFn: () => Promise<T>,
  jikanFn: () => Promise<T>,
  cacheKey: string
): Promise<T> {
  // Check cache first
  const cached = getCached(cacheKey);
  if (cached) return cached as T;

  // Try AniList (unless circuit is open)
  if (!isAnilistCircuitOpen()) {
    try {
      const result = await anilistFn();
      recordAnilistSuccess();
      setCache(cacheKey, result);
      return result;
    } catch (err) {
      console.error("AniList failed, trying Jikan:", err);
      recordAnilistFailure();
    }
  }

  // Fallback to Jikan
  const result = await jikanFn();
  setCache(cacheKey, result);
  return result;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { action, page: pageStr, q, malId: malIdStr } = req.query || {};
  const page = parseInt(pageStr || "1", 10) || 1;

  try {
    switch (action) {
      case "seasonal": {
        const result = await withFallback(
          () => anilistSeasonal(page),
          () => jikanSeasonal(page),
          `seasonal:${page}`
        );
        res.status(200).json(result);
        return;
      }

      case "search": {
        const query = typeof q === "string" ? q.trim() : "";
        if (!query) {
          res.status(200).json({
            data: [],
            pagination: { currentPage: 1, hasNextPage: false, lastVisiblePage: 1, totalItems: 0 },
            airingData: {},
            source: "anilist",
          });
          return;
        }
        const result = await withFallback(
          () => anilistSearch(query, page),
          () => jikanSearch(query, page),
          `search:${query.toLowerCase()}:${page}`
        );
        res.status(200).json(result);
        return;
      }

      case "getById": {
        const malId = parseInt(malIdStr || "0", 10);
        if (!malId) {
          res.status(400).json({ error: "malId required" });
          return;
        }
        const result = await withFallback(
          () => anilistGetById(malId),
          () => jikanGetById(malId),
          `anime:${malId}`
        );
        res.status(200).json(result);
        return;
      }

      default:
        res.status(400).json({ error: "Invalid action. Use: seasonal, search, getById" });
    }
  } catch (err: any) {
    console.error("Proxy error:", err);
    res.status(503).json({ error: "Both data sources unavailable", message: err?.message });
  }
}
