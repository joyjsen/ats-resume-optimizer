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
    },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const { userProfile } = useProfileStore();

    // Initialize from profile if available, otherwise fallback to system
    const [isDark, setIsDark] = useState(() => {
        if (userProfile?.theme) {
            return userProfile.theme === 'dark';
        }
        return systemScheme === 'dark';
    });

    // Update isDark if profile theme changes (e.g. from another device)
    useEffect(() => {
        if (userProfile?.theme) {
            setIsDark(userProfile.theme === 'dark');
        }
    }, [userProfile?.theme]);

    const theme = useMemo(() => isDark ? DarkTheme : LightTheme, [isDark]);
    const toggleTheme = () => setIsDark(!isDark);

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, theme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export { LightTheme, DarkTheme };
