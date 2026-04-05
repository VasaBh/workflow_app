import { create } from 'zustand';
import { User } from '@/types';
import { setAccessToken } from '@/lib/api';

const SESSION_KEY = 'wos_session';
const SESSION_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours

interface StoredSession {
  token: string;
  user: User;
  expiresAt: number;
}

function saveSession(token: string, user: User) {
  const session: StoredSession = {
    token,
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function restoreSession(): { token: string; user: User } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return { token: session.token, user: session.user };
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setToken: (token) => {
    setAccessToken(token);
    set({ isAuthenticated: !!token });
  },

  login: (token, user) => {
    setAccessToken(token);
    saveSession(token, user);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    setAccessToken(null);
    clearSession();
    set({ user: null, isAuthenticated: false });
  },
}));
