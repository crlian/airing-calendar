import { useState, useEffect, useCallback } from "react";
import type { AnimeData, SearchAnimeResult } from "@/types/anime";
import { jikanClient } from "@/lib/api/jikan";

interface UseSeasonalAnimeReturn {
  data: AnimeData[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  currentPage: number;
  totalPages: number;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSeasonalAnime(): UseSeasonalAnimeReturn {
  const [data, setData] = useState<AnimeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchData = async (page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const result: SearchAnimeResult = await jikanClient.getSeasonNow(page);
      if (page === 1) {
        setData(result.data);
      } else {
        setData(prev => [...prev, ...result.data]);
      }
      setCurrentPage(result.pagination.currentPage);
      setHasNextPage(result.pagination.hasNextPage);
      setTotalPages(result.pagination.lastVisiblePage);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch seasonal anime"));
      console.error("Error fetching seasonal anime:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isLoadingMore) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const result: SearchAnimeResult = await jikanClient.getSeasonNow(nextPage);
      setData(prev => [...prev, ...result.data]);
      setCurrentPage(result.pagination.currentPage);
      setHasNextPage(result.pagination.hasNextPage);
    } catch (err) {
      console.error("Error loading more seasonal anime:", err);
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
    currentPage,
    totalPages,
    isLoadingMore,
    loadMore,
    refetch: () => fetchData(1),
  };
}
