import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { useProfileStore } from '../store/profileStore';

export const ThemeContext = createContext({
    isDark: false,
    toggleTheme: () => { },
    theme: MD3LightTheme // Add theme to context for easier access
});

export const useAppTheme = () => useContext(ThemeContext);

const LightTheme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: '#6200ee',
        secondary: '#03dac6',
        tertiary: '#ff4081',
    },
};

const DarkTheme = {
    ...MD3DarkTheme,
    colors: {
        ...MD3DarkTheme.colors,
        primary: '#bb86fc',
        secondary: '#03dac6',
        tertiary: '#cf6679',
        background: '#000000', // Pure black for "Night Mode"
        surface: '#121212',    // Slightly lighter for cards
    },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const { userProfile } = useProfileStore();

    // Derive base setting from profile or system
    const profileTheme = userProfile?.theme || 'auto';
    const isSystemDark = systemScheme === 'dark';

    // Local state to override until profile updates
    const [overrideDark, setOverrideDark] = useState<boolean | null>(null);

    // Final derived isDark value
    const isDark = overrideDark !== null ? overrideDark : (
        profileTheme === 'dark' ? true :
            profileTheme === 'light' ? false : isSystemDark
    );

    // Optional: Synchronize logic - when profile catch up to override, clear override
    useEffect(() => {
        if (overrideDark !== null) {
            const currentProfileIsDark = profileTheme === 'dark' || (profileTheme === 'auto' && isSystemDark);
            if (currentProfileIsDark === overrideDark) {
                console.log("[ThemeContext] Profile caught up to toggle, clearing override.");
                setOverrideDark(null);
            }
        }
    }, [profileTheme, isSystemDark, overrideDark]);

    const theme = useMemo(() => {
        console.log(`[ThemeContext] Applying ${isDark ? 'Dark' : 'Light'} theme. (Profile: ${profileTheme}, SystemDark: ${isSystemDark})`);
        return isDark ? DarkTheme : LightTheme;
    }, [isDark, profileTheme, isSystemDark]);

    const toggleTheme = () => {
        const nextDark = !isDark;
        console.log("[ThemeContext] Toggling local theme to:", nextDark);
        setOverrideDark(nextDark);
    };

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export { LightTheme, DarkTheme };
