import { useState, useEffect } from "react";
import type { AnimeData } from "@/types/anime";
import { jikanClient } from "@/lib/api/jikan";

interface UseSeasonalAnimeReturn {
  data: AnimeData[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSeasonalAnime(): UseSeasonalAnimeReturn {
  const [data, setData] = useState<AnimeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const seasonalAnime = await jikanClient.getSeasonNow();
      setData(seasonalAnime);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch seasonal anime"));
      console.error("Error fetching seasonal anime:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
