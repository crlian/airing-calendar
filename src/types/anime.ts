export interface AnimeImages {
  jpg: {
    image_url: string;
    small_image_url: string;
    large_image_url: string;
  };
  webp?: {
    image_url: string;
    small_image_url: string;
    large_image_url: string;
  };
}

export interface AnimeBroadcast {
  day: string;
  time: string;
  timezone: string;
  string: string; // e.g., "Saturdays at 01:00 (JST)"
}

export interface AnimeData {
  mal_id: number;
  title: string;
  title_english?: string;
  title_japanese?: string;
  images: AnimeImages;
  synopsis?: string;
  broadcast?: AnimeBroadcast;
  url: string;
  score?: number;
  episodes?: number;
  status: string;
}

export interface JikanResponse<T> {
  data: T;
  pagination?: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: {
      count: number;
      total: number;
      per_page: number;
    };
  };
}

export interface ParsedBroadcast {
  day: string;
  time: string;
}

export interface SearchAnimeResult {
  data: AnimeData[];
  pagination: {
    currentPage: number;
    hasNextPage: boolean;
    lastVisiblePage: number;
    totalItems: number;
  };
}
