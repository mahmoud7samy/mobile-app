import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, type Theme } from './theme';

const THEME_KEY = '@app_theme_dark';

interface ThemeStore {
    isDark: boolean;
    theme: Theme;
    toggle: () => Promise<void>;
    init: () => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
    isDark: false,
    theme: lightTheme,

    init: async () => {
        try {
            const stored = await AsyncStorage.getItem(THEME_KEY);
            const isDark = stored === 'true';
            set({ isDark, theme: isDark ? darkTheme : lightTheme });
        } catch { }
    },

    toggle: async () => {
        const next = !get().isDark;
        set({ isDark: next, theme: next ? darkTheme : lightTheme });
        try {
            await AsyncStorage.setItem(THEME_KEY, String(next));
        } catch { }
    },
}));
