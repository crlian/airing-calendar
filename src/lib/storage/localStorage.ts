import type { AnimeData } from "@/types/anime";

const STORAGE_KEY = "anime-calendar:selected";
const STORAGE_ANIME_KEY = "anime-calendar:selected-anime";

export const AnimeStorage = {
  /**
   * Gets the list of selected anime IDs from localStorage
   */
  getSelectedIds(): number[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        console.error("Invalid stored data format");
        return [];
      }

      return parsed.filter((id) => typeof id === "number");
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return [];
    }
  },

  /**
   * Gets the list of selected anime data from localStorage
   */
  getSelectedAnime(): AnimeData[] {
    try {
      const stored = localStorage.getItem(STORAGE_ANIME_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        console.error("Invalid stored anime data format");
        return [];
      }

      return parsed.filter((anime) => anime && typeof anime.mal_id === "number");
    } catch (error) {
      console.error("Error reading selected anime from localStorage:", error);
      return [];
    }
  },

  /**
   * Adds an anime to the selected list and caches its data
   */
  addAnime(anime: AnimeData): void {
    try {
      const currentIds = this.getSelectedIds();

      // Don't add duplicates
      if (!currentIds.includes(anime.mal_id)) {
        const updatedIds = [...currentIds, anime.mal_id];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedIds));
      }

      const currentAnime = this.getSelectedAnime();
      const exists = currentAnime.some((item) => item.mal_id === anime.mal_id);
      if (exists) return;

      const updatedAnime = [...currentAnime, anime];
      localStorage.setItem(STORAGE_ANIME_KEY, JSON.stringify(updatedAnime));
    } catch (error) {
      console.error("Error adding anime to localStorage:", error);
    }
  },

  /**
   * Removes an anime ID from the selected list and cached data
   */
  removeAnime(id: number): void {
    try {
      const currentIds = this.getSelectedIds();
      const updatedIds = currentIds.filter((currentId) => currentId !== id);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedIds));

      const currentAnime = this.getSelectedAnime();
      const updatedAnime = currentAnime.filter((anime) => anime.mal_id !== id);
      localStorage.setItem(STORAGE_ANIME_KEY, JSON.stringify(updatedAnime));
    } catch (error) {
      console.error("Error removing anime from localStorage:", error);
    }
  },

  /**
   * Checks if an anime ID is in the selected list
   */
  isSelected(id: number): boolean {
    const selectedIds = this.getSelectedIds();
    return selectedIds.includes(id);
  },

  /**
   * Clears all selected anime
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_ANIME_KEY);
    } catch (error) {
      console.error("Error clearing localStorage:", error);
    }
  },

  /**
   * Gets the count of selected anime
   */
  getCount(): number {
    return this.getSelectedIds().length;
  },
};
