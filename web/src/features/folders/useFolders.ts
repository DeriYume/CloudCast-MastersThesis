import { create } from "zustand";
import { listFolders, type FolderItem } from "../../api/api";
import { reconcile } from "../../utils/reconcile";

interface FoldersState {
  folders: FolderItem[];
  loading: boolean;
  loaded: boolean;
  refresh: (token: string) => Promise<void>;
  reset: () => void;
}

export const useFolders = create<FoldersState>((set) => ({
  folders: [],
  loading: false,
  loaded: false,
  refresh: async (token) => {
    set({ loading: true });
    try {
      const { folders } = await listFolders(token);

      set((s) => ({ folders: reconcile(s.folders, folders), loaded: true }));
    } finally {
      set({ loading: false });
    }
  },
  reset: () => set({ folders: [], loading: false, loaded: false }),
}));
