const STORAGE_KEY = "anime-calendar:selected";

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
   * Adds an anime ID to the selected list
   */
  addAnime(id: number): void {
    try {
      const currentIds = this.getSelectedIds();

      // Don't add duplicates
      if (currentIds.includes(id)) {
        return;
      }

      const updatedIds = [...currentIds, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedIds));
    } catch (error) {
      console.error("Error adding anime to localStorage:", error);
    }
  },

  /**
   * Removes an anime ID from the selected list
   */
  removeAnime(id: number): void {
    try {
      const currentIds = this.getSelectedIds();
      const updatedIds = currentIds.filter((currentId) => currentId !== id);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedIds));
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
