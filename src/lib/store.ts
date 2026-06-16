import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = 'auth-storage';
const TOKEN_KEY = 'token';

export interface User {
  userId: string;
  username: string;
  role: 'admin' | 'teacher' | 'ta' | 'student' | 'credentials_distributor';
  profileId?: string;
  profileName?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  lastViewedNotifications: string | null;
  _hydrated: boolean;
  setAuth: (token: string, user: User, rememberMe?: boolean) => Promise<void>;
  clearAuth: () => Promise<void>;
  rehydrate: () => Promise<void>;
  updateLastViewedNotifications: (isoDate: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  lastViewedNotifications: null,
  _hydrated: false,
  setAuth: async (token, user, rememberMe = true) => {
    set({ token, user });
    if (rememberMe) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify({ 
        token, 
        user,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
      }));
    } else {
      await AsyncStorage.multiRemove([TOKEN_KEY, AUTH_KEY]);
    }
  },
  clearAuth: async () => {
    set({ token: null, user: null, lastViewedNotifications: null });
    await AsyncStorage.multiRemove([TOKEN_KEY, AUTH_KEY, 'lastViewedNotifications']);
  },
  updateLastViewedNotifications: async (isoDate: string) => {
    await AsyncStorage.setItem('lastViewedNotifications', isoDate);
    set({ lastViewedNotifications: isoDate });
  },
  rehydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTH_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { token?: string; user?: User; expiresAt?: number };
        if (data.token && data.user) {
          if (!data.expiresAt || data.expiresAt > Date.now()) {
            await AsyncStorage.setItem(TOKEN_KEY, data.token);
            set({ token: data.token, user: data.user });
          } else {
            // Expired
            await AsyncStorage.multiRemove([TOKEN_KEY, AUTH_KEY]);
          }
        }
      }
      const lastViewed = await AsyncStorage.getItem('lastViewedNotifications');
      if (lastViewed) {
        set({ lastViewedNotifications: lastViewed });
      }
    } catch (_) {}
    set((s) => ({ ...s, _hydrated: true }));
  },
}));

export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}
