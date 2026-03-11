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
  _hydrated: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  rehydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  _hydrated: false,
  setAuth: async (token, user) => {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
    set({ token, user });
  },
  clearAuth: async () => {
    set({ token: null, user: null });
    await AsyncStorage.multiRemove([TOKEN_KEY, AUTH_KEY]);
  },
  rehydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTH_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { token?: string; user?: User };
        if (data.token && data.user) {
          await AsyncStorage.setItem(TOKEN_KEY, data.token);
          set({ token: data.token, user: data.user });
        }
      }
    } catch (_) {}
    set((s) => ({ ...s, _hydrated: true }));
  },
}));

export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}
