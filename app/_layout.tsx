import React, { useEffect } from 'react';
import { Alert, Platform, View } from 'react-native';
import { useRouter, useSegments, Stack } from 'expo-router';
import { PaperProvider, Avatar, Text } from 'react-native-paper';
import { authService, UserInactiveError } from '../src/services/firebase/authService';
import { useProfileStore } from '../src/store/profileStore';
import { TaskQueueProvider } from '../src/context/TaskQueueContext';
import { UserHeader } from '../src/components/layout/UserHeader';
import { auth } from '../src/services/firebase/config';
import { notificationService } from '../src/services/firebase/notificationService';
import { ThemeProvider, useAppTheme, LightTheme, DarkTheme } from '../src/context/ThemeContext';
import { WebLandingPage } from '../src/components/web/WebLandingPage';
import { WebAppLayout } from '../src/components/web/WebAppLayout';
import { StripeProviderWrapper } from '../src/components/providers/StripeProviderWrapper';

export default function RootLayout() {
    return (
        <ThemeProvider>
            <RootLayoutContent />
        </ThemeProvider>
    );
}

function RootLayoutContent() {
    const { userProfile, setUserProfile, isInitialized, setInitialized } = useProfileStore();
    const segments = useSegments();
    const router = useRouter();
    const { isDark } = useAppTheme();
    const theme = isDark ? DarkTheme : LightTheme;

    useEffect(() => {
        let notificationCleanup: (() => void) | null = null;

        const unsubscribe = authService.subscribeToAuthChanges((profile, error) => {
            if (error instanceof UserInactiveError || (error as any)?.name === 'UserInactiveError') {
                Alert.alert("Account Inactive", "User Inactive: Please contact admin.");
                setUserProfile(null);
            } else {
                setUserProfile(profile);
                if (profile) {
                    notificationService.registerForPushNotificationsAsync();
                    notificationCleanup = notificationService.setupNotificationListeners();
                }
            }
            if (!isInitialized) setInitialized(true);
        });

        return () => {
            unsubscribe();
            if (notificationCleanup) notificationCleanup();
        };
    }, []);

    useEffect(() => {
        if (!isInitialized) return;

        const inAuthGroup = segments[0] === '(auth)';
        const currentRoute = (segments as any)[1];

        if (!userProfile && !inAuthGroup) {
            // On web, we don't redirect - the RootLayoutContent handles showing the landing page
            if (Platform.OS !== 'web') {
                router.replace('/(auth)/sign-in' as any);
            }
        } else if (userProfile) {
            const nativeUser = auth.currentUser;
            const isEmailUser = userProfile.provider === 'email';
            const onVerifyScreen = currentRoute === 'verify-email';

            if (isEmailUser && nativeUser && !nativeUser.emailVerified) {
                if (!onVerifyScreen) {
                    router.replace('/(auth)/verify-email' as any);
                }
                return;
            }

            if (onVerifyScreen && (!isEmailUser || (nativeUser && nativeUser.emailVerified))) {
                if (userProfile.profileCompleted) {
                    router.replace('/(tabs)' as any);
                } else {
                    router.replace('/(auth)/onboarding' as any);
                }
                return;
            }

            if (userProfile.profileCompleted) {
                if (inAuthGroup) {
                    router.replace('/(tabs)' as any);
                }
            } else {
                if (currentRoute !== 'onboarding') {
                    router.replace('/(auth)/onboarding' as any);
                }
            }
        }
    }, [userProfile, segments, isInitialized]);

    const headerOptions = {
        headerRight: () => userProfile ? <UserHeader /> : null,
        headerStyle: { backgroundColor: theme.colors.elevation.level2 },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { color: theme.colors.onSurface },
    };

    // Web: Show landing page if not logged in (except for public routes like terms/privacy)
    const publicRoutes = ['settings/terms', 'settings/privacy'];
    const isPublicRoute = publicRoutes.some(route => segments.join('/').includes(route));

    if (Platform.OS === 'web' && !userProfile && isInitialized && !isPublicRoute) {
        return (
            <PaperProvider theme={theme}>
                <WebLandingPage />
            </PaperProvider>
        );
    }

    const appContent = (
        <Stack screenOptions={headerOptions}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="analysis-result" options={{ title: 'Analysis Result', presentation: 'card' }} />
            <Stack.Screen name="upskilling-path" options={{ title: 'Your Learning Path', presentation: 'card' }} />
            <Stack.Screen name="optimization-editor" options={{ title: 'Resume Editor', presentation: 'modal' }} />
            <Stack.Screen name="resume-preview" options={{ title: 'Preview', presentation: 'modal' }} />
            <Stack.Screen name="purchase" options={{ title: 'Refill Tokens', presentation: 'modal' }} />
            <Stack.Screen name="purchase-history" options={{ title: 'Purchase History', presentation: 'modal' }} />
            <Stack.Screen name="analytics" options={{ title: 'Usage Analytics', headerBackTitle: '' }} />
            <Stack.Screen name="history-details" options={{ headerBackTitle: '', title: '' }} />
            <Stack.Screen name="user-activity" options={{ title: 'Activity History' }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack>
    );

    const mainApp = (
        <PaperProvider theme={theme}>
            <TaskQueueProvider>
                {Platform.OS === 'web' && userProfile ? (
                    <WebAppLayout>{appContent}</WebAppLayout>
                ) : (
                    appContent
                )}
            </TaskQueueProvider>
        </PaperProvider>
    );

    return (
        <StripeProviderWrapper>
            {mainApp}
        </StripeProviderWrapper>
    );
}

