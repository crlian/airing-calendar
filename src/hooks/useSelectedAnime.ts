import { useState, useEffect, useCallback } from "react";
import { AnimeStorage } from "@/lib/storage/localStorage";

interface UseSelectedAnimeReturn {
  selectedIds: number[];
  addAnime: (id: number) => void;
  removeAnime: (id: number) => void;
  isSelected: (id: number) => boolean;
}

export function useSelectedAnime(): UseSelectedAnimeReturn {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const ids = AnimeStorage.getSelectedIds();
    setSelectedIds(ids);
  }, []);

  const addAnime = useCallback((id: number) => {
    AnimeStorage.addAnime(id);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const removeAnime = useCallback((id: number) => {
    AnimeStorage.removeAnime(id);
    setSelectedIds((prev) => prev.filter((currentId) => currentId !== id));
  }, []);

  const isSelected = useCallback(
    (id: number) => {
      return selectedIds.includes(id);
    },
    [selectedIds]
  );

  return {
    selectedIds,
    addAnime,
    removeAnime,
    isSelected,
  };
}
