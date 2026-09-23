import { create } from "zustand";
import type { UserProfile } from "../../api/api";
import { clearSession } from "../crypto/session";

interface AuthState {
  token: string | null;
  email: string | null;
  user: UserProfile | null;

  pendingDeletion: string | null;
  setAuth: (token: string, email: string, pendingDeletion?: string | null) => void;
  setUser: (user: UserProfile) => void;
  setPendingDeletion: (v: string | null) => void;
  clear: () => void;
}

const SS_KEY = "cc.auth.session";

interface Persisted {
  token: string | null; email: string | null; user: UserProfile | null;
  pendingDeletion: string | null;
}

function load(): Persisted {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Persisted>;
      return {
        token: p.token ?? null,
        email: p.email ?? null,
        user: p.user ?? null,
        pendingDeletion: p.pendingDeletion ?? null,
      };
    }
  } catch {  }
  return { token: null, email: null, user: null, pendingDeletion: null };
}

function save(s: Persisted): void {
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(s)); } catch {  }
}

const initial = load();

export const useAuth = create<AuthState>()((set, get) => ({
  token: initial.token,
  email: initial.email,
  user: initial.user,
  pendingDeletion: initial.pendingDeletion,
  setAuth: (token, email, pendingDeletion = null) => {
    set({ token, email, pendingDeletion });
    save({ token, email, user: get().user, pendingDeletion });
  },
  setUser: (user) => {
    set({ user, email: user.email });
    save({ token: get().token, email: user.email, user, pendingDeletion: get().pendingDeletion });
  },
  setPendingDeletion: (v) => {
    set({ pendingDeletion: v });
    save({ token: get().token, email: get().email, user: get().user, pendingDeletion: v });
  },
  clear: () => {
    set({ token: null, email: null, user: null, pendingDeletion: null });
    try { sessionStorage.removeItem(SS_KEY); } catch {  }
    clearSession();
  },
}));
