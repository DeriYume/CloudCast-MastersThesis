import { create } from "zustand";

interface VaultRevisionState {
  revision: number;
  bump: () => void;
}

export const useVaultRevision = create<VaultRevisionState>((set) => ({
  revision: 0,
  bump: () => set((s) => ({ revision: s.revision + 1 })),
}));

export const bumpVaultRevision = (): void => useVaultRevision.getState().bump();

let lastLocalRefresh = 0;

const ECHO_WINDOW_MS = 1500;

export const markLocalRefresh = (): void => { lastLocalRefresh = Date.now(); };

export const isEchoOfLocalRefresh = (): boolean =>
  Date.now() - lastLocalRefresh < ECHO_WINDOW_MS;
