import { Stack } from 'expo-router';
import { ThemeToggle } from '../../src/components/common/ThemeToggle';
import { useAppTheme } from '../../src/context/ThemeContext';

export default function AuthLayout() {
    const { theme } = useAppTheme();

    return (
        <Stack>
            <Stack.Screen name="sign-in" options={{ title: 'Sign In', headerShown: false }} />
            <Stack.Screen name="sign-up" options={{ title: 'Sign Up', headerShown: false }} />
            <Stack.Screen
                name="onboarding"
                options={{
                    title: 'Onboarding',
                    headerStyle: { backgroundColor: theme.colors.background },
                    headerTintColor: theme.colors.onSurface,
                    headerTitleStyle: { color: theme.colors.onSurface },
                    headerBackVisible: false,
                    headerLeft: () => null,
                    headerRight: () => <ThemeToggle size={22} style={{ marginRight: 4 }} />,
                }}
            />
        </Stack>
    );
}
