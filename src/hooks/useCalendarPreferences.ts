import { useCallback, useState } from "react";
import type { CalendarPreferences } from "@/types/preferences";
import { CalendarPreferencesStorage } from "@/lib/storage/calendarPreferences";

interface UseCalendarPreferencesReturn {
  preferences: CalendarPreferences;
  updatePreferences: (patch: Partial<CalendarPreferences>) => void;
}

export function useCalendarPreferences(): UseCalendarPreferencesReturn {
  const [preferences, setPreferences] = useState<CalendarPreferences>(
    CalendarPreferencesStorage.getPreferences()
  );

  const updatePreferences = useCallback(
    (patch: Partial<CalendarPreferences>) => {
      setPreferences((prev) => {
        const next = { ...prev, ...patch };
        CalendarPreferencesStorage.setPreferences(next);
        return next;
      });
    },
    []
  );

  return { preferences, updatePreferences };
}
