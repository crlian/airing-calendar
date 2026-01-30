import { useState, useEffect, useCallback } from "react";
import type { AnimeData, AiringScheduleData } from "@/types/anime";
import {
  anilistClient,
  AniListRateLimitError,
} from "@/lib/api/anilist";

interface UseSeasonalAnimeReturn {
  data: AnimeData[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
  airingData: Map<number, AiringScheduleData>;
}

export function useSeasonalAnime(): UseSeasonalAnimeReturn {
  const [data, setData] = useState<AnimeData[]>([]);
  const [airingData, setAiringData] = useState<Map<number, AiringScheduleData>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof AniListRateLimitError) {
      return err.message;
    }
    return fallback;
  };

  const fetchData = async (page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      setLoadMoreError(null);

      const result = await anilistClient.getSeasonNow(page);
      if (page === 1) {
        setData(result.data);
        setAiringData(result.airingData);
      } else {
        setData((prev) => [...prev, ...result.data]);
        setAiringData((prev) => {
          const newMap = new Map(prev);
          result.airingData.forEach((value, key) => {
            newMap.set(key, value);
          });
          return newMap;
        });
      }
      setCurrentPage(result.pagination.currentPage);
      setHasNextPage(result.pagination.hasNextPage);
    } catch (err) {
      const message = getErrorMessage(err, "Failed to fetch seasonal anime");
      setError(new Error(message));
      console.error("Error fetching seasonal anime:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isLoadingMore) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);
    const nextPage = currentPage + 1;

    try {
      const result = await anilistClient.getSeasonNow(nextPage);
      setData((prev) => [...prev, ...result.data]);
      setAiringData((prev) => {
        const newMap = new Map(prev);
        result.airingData.forEach((value, key) => {
          newMap.set(key, value);
        });
        return newMap;
      });
      setCurrentPage(result.pagination.currentPage);
      setHasNextPage(result.pagination.hasNextPage);
    } catch (err) {
      console.error("Error loading more seasonal anime:", err);
      setLoadMoreError(
        getErrorMessage(err, "Failed to load more seasonal anime.")
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasNextPage, isLoadingMore, currentPage]);

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    isLoading,
    error,
    hasNextPage,
    isLoadingMore,
    loadMoreError,
    loadMore,
    refetch: () => fetchData(1),
    airingData,
  };
}
