import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { ThemeProp } from 'react-native-paper/lib/typescript/types';

// Custom theme
const theme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: '#6200ee',
        secondary: '#03dac6',
        tertiary: '#ff4081',
    },
};

import { TaskQueueProvider } from '../src/context/TaskQueueContext';

export default function RootLayout() {
    return (
        <PaperProvider theme={theme}>
            <TaskQueueProvider>
                <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen
                        name="analysis-result"
                        options={{ title: 'Analysis Result', presentation: 'card' }}
                    />
                    <Stack.Screen
                        name="upskilling-path"
                        options={{ title: 'Your Learning Path', presentation: 'card' }}
                    />
                    <Stack.Screen
                        name="optimization-editor"
                        options={{ title: 'Resume Editor', presentation: 'modal' }}
                    />
                    <Stack.Screen
                        name="resume-preview"
                        options={{ title: 'Preview', presentation: 'modal' }}
                    />
                </Stack>
            </TaskQueueProvider>
        </PaperProvider>
    );
}
