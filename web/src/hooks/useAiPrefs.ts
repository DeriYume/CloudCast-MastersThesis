import { create } from "zustand";
import {
  getAiConfig, updateAiPreferences,
  type AiPreferences, type AiStatus,
} from "../api/api";

type AutoFileMode = AiPreferences["auto_file_mode"];

interface AiPrefsState {
  autoFileMode: AutoFileMode;
  analysis: boolean;
  semanticSearch: boolean;
  aiStatus: AiStatus;
  loaded: boolean;

  load: (token: string) => Promise<void>;

  update: (token: string, patch: Partial<AiPreferences>) => Promise<void>;
  reset: () => void;
}

const DEFAULTS = {
  autoFileMode: "off" as AutoFileMode,
  analysis: false,
  semanticSearch: false,
  aiStatus: { ai: false, semantic: false } as AiStatus,
  loaded: false,
};

export const useAiPrefs = create<AiPrefsState>()((set, get) => ({
  ...DEFAULTS,
  load: async (token) => {
    try {

      const { ai, semantic, preferences } = await getAiConfig(token);
      set({
        autoFileMode: preferences.auto_file_mode,
        analysis: preferences.analysis,
        semanticSearch: preferences.semantic_search,
        aiStatus: { ai, semantic },
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },
  update: async (token, patch) => {
    const prev = get();
    const next: AiPreferences = {
      auto_file_mode: patch.auto_file_mode ?? prev.autoFileMode,
      analysis: patch.analysis ?? prev.analysis,
      semantic_search: patch.semantic_search ?? prev.semanticSearch,
    };

    set({ autoFileMode: next.auto_file_mode, analysis: next.analysis, semanticSearch: next.semantic_search });
    try {
      await updateAiPreferences(token, next);
    } catch (e) {

      set({ autoFileMode: prev.autoFileMode, analysis: prev.analysis, semanticSearch: prev.semanticSearch });
      throw e;
    }
  },
  reset: () => set({ ...DEFAULTS }),
}));
