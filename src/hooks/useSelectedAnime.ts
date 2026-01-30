import { useState, useEffect, useCallback } from "react";
import { AnimeStorage } from "@/lib/storage/localStorage";
import { AiringStorage } from "@/lib/storage/airingStorage";
import type { AnimeData } from "@/types/anime";

interface UseSelectedAnimeReturn {
  selectedIds: number[];
  selectedAnime: AnimeData[];
  addAnime: (anime: AnimeData) => void;
  removeAnime: (id: number) => void;
  isSelected: (id: number) => boolean;
}

export function useSelectedAnime(): UseSelectedAnimeReturn {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<AnimeData[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const ids = AnimeStorage.getSelectedIds();
    const anime = AnimeStorage.getSelectedAnime();
    setSelectedIds(ids);
    setSelectedAnime(anime);
  }, []);

  const addAnime = useCallback((anime: AnimeData) => {
    AnimeStorage.addAnime(anime);
    setSelectedIds((prev) => {
      if (prev.includes(anime.mal_id)) return prev;
      return [...prev, anime.mal_id];
    });
    setSelectedAnime((prev) => {
      if (prev.some((item) => item.mal_id === anime.mal_id)) return prev;
      return [...prev, anime];
    });
  }, []);

  const removeAnime = useCallback((id: number) => {
    AnimeStorage.removeAnime(id);
    AiringStorage.removeAiring(id);
    setSelectedIds((prev) => prev.filter((currentId) => currentId !== id));
    setSelectedAnime((prev) => prev.filter((anime) => anime.mal_id !== id));
  }, []);

  const isSelected = useCallback(
    (id: number) => {
      return selectedIds.includes(id);
    },
    [selectedIds]
  );

  return {
    selectedIds,
    selectedAnime,
    addAnime,
    removeAnime,
    isSelected,
  };
}
