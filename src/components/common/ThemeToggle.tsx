import React from 'react';
import { IconButton } from 'react-native-paper';
import { useAppTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
    size?: number;
    style?: object;
}

/**
 * A small sun/moon icon button that toggles dark/light mode.
 * Plug it into any screen's header or top bar.
 */
export function ThemeToggle({ size = 24, style }: ThemeToggleProps) {
    const { isDark, toggleTheme, theme } = useAppTheme();

    return (
        <IconButton
            icon={isDark ? 'weather-sunny' : 'weather-night'}
            iconColor={theme.colors.onSurface}
            size={size}
            onPress={toggleTheme}
            style={style}
            accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        />
    );
}
