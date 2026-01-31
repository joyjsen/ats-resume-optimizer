import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter, useSegments, Stack } from 'expo-router';
import { PaperProvider, Avatar, Text } from 'react-native-paper';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ENV } from '../src/config/env';
import { authService, UserInactiveError } from '../src/services/firebase/authService';
import { useProfileStore } from '../src/store/profileStore';
import { TaskQueueProvider } from '../src/context/TaskQueueContext';
import { UserHeader } from '../src/components/layout/UserHeader';
import { auth } from '../src/services/firebase/config';
import { notificationService } from '../src/services/firebase/notificationService';
import { ThemeProvider, useAppTheme, LightTheme, DarkTheme } from '../src/context/ThemeContext';

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
            router.replace('/(auth)/sign-in' as any);
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
        headerStyle: { backgroundColor: theme.colors.elevation.level2 }, // This sets the header background
        headerTintColor: theme.colors.onSurface, // Back button and text color
        headerTitleStyle: { color: theme.colors.onSurface }, // Ensure title matches
    };

    return (
        <StripeProvider
            publishableKey={ENV.STRIPE_PUBLISHABLE_KEY || 'pk_test_sample'}
            merchantIdentifier="merchant.com.atsresumeoptimizer"
        >
            <PaperProvider theme={theme}>
                <TaskQueueProvider>
                    <Stack screenOptions={headerOptions}>
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
                        <Stack.Screen name="purchase" options={{ title: 'Refill Tokens', presentation: 'modal' }} />
                        <Stack.Screen name="purchase-history" options={{ title: 'Purchase History', presentation: 'modal' }} />
                        <Stack.Screen name="analytics" options={{ title: 'Usage Analytics', headerBackTitle: '' }} />
                        <Stack.Screen name="history-details" options={{ headerBackTitle: '', title: '' }} />
                        <Stack.Screen name="user-activity" options={{ title: 'Activity History' }} />
                        <Stack.Screen name="admin" options={{ headerShown: false }} />
                    </Stack>
                </TaskQueueProvider>
            </PaperProvider>
        </StripeProvider>
    );
}
