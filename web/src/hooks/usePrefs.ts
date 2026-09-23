import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeMode } from "../theme";

interface PrefsState {

  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      themeMode: "light",
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleThemeMode: () =>
        set((s) => ({ themeMode: s.themeMode === "light" ? "dark" : "light" })),
    }),
    {
      name: "cloudcast-prefs",
      version: 3,

      migrate: (persisted): PrefsState => {
        const old = (persisted ?? {}) as Partial<PrefsState>;
        return {
          themeMode: old.themeMode ?? "light",
        } as PrefsState;
      },
    }
  )
);
