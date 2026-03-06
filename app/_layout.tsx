import React, { useEffect, useRef, useState } from 'react'; // Root reload
import { Alert, Platform, View, Text as RNText } from 'react-native';
import { useRouter, useSegments, Stack } from 'expo-router';
import { PaperProvider, Avatar, Text } from 'react-native-paper';
import { authService, UserInactiveError } from '../src/services/firebase/authService';
import { userService } from '../src/services/firebase/userService';
import { notificationService } from '../src/services/firebase/notificationService';
import { useProfileStore } from '../src/store/profileStore';
import { TaskQueueProvider } from '../src/context/TaskQueueContext';
import { UserHeader } from '../src/components/layout/UserHeader';
import { WebLandingPage } from '../src/components/web/landing/WebLandingPage';
import { WebAppLayout } from '../src/components/web/WebAppLayout';
import { StripeProviderWrapper } from '../src/components/providers/StripeProviderWrapper';
import { ShareIntentProvider } from "expo-share-intent";
import { useResumeStore } from '../src/store/resumeStore';
import { useShareIntentHandler } from '../src/hooks/useShareIntentHandler';
import { auth } from '../src/services/firebase/config';
import { iapService } from '../src/services/iap/iapService';
import { ThemeProvider, useAppTheme } from '../src/context/ThemeContext';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
    return (
        <ShareIntentProvider options={{ scheme: "riresume" }}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <StripeProviderWrapper>
                        <RootLayoutContent />
                    </StripeProviderWrapper>
                </ThemeProvider>
            </SafeAreaProvider>
        </ShareIntentProvider>
    );
}

function RootLayoutContent() {
    const segments = useSegments();
    const router = useRouter();
    const { userProfile, setUserProfile, isInitialized, setInitialized } = useProfileStore();
    const { setPendingSharedUrl, setPendingSharedText } = useResumeStore();
    const { sharedUrl, sharedContent, clearSharedUrl } = useShareIntentHandler();
    const { theme } = useAppTheme();
    const isMounted = useRef(false);
    const textPropsSet = useRef(false);

    // Compute public/auth route status early so useEffect can reference them
    const publicRoutes = ['settings/terms', 'settings/privacy', 'settings/about', 'settings/help'];
    const isPublicRoute = publicRoutes.some(route => segments.join('/').includes(route));
    const isAuthRoute = segments[0] === '(auth)';

    useEffect(() => {
        isMounted.current = true;
        const unsubscribe = authService.subscribeToAuthChanges((profile, error) => {
            if (isMounted.current) {
                if (error) {
                    console.error("Auth error in layout:", error);
                    if (error instanceof UserInactiveError) {
                        Alert.alert("Account Inactive", error.message);
                    }
                }
                setUserProfile(profile);
                setInitialized(true);
            }
        });

        return () => {
            isMounted.current = false;
            unsubscribe();
        };
    }, []);

    // Notification initialization
    useEffect(() => {
        notificationService.initHandler();
    }, []);

    // Notification registration and listeners
    useEffect(() => {
        if (userProfile && isInitialized) {
            const cleanupListeners = notificationService.setupNotificationListeners();
            notificationService.registerForPushNotificationsAsync().catch(console.error);

            // 1. Initialize IAP early (iOS only)
            if (Platform.OS === 'ios') {
                iapService.initialize().catch(err => {
                    console.warn('[Root] IAP initialization failed:', err);
                });
            }

            return () => {
                cleanupListeners();
            };
        }
    }, [userProfile, isInitialized]);

    // Global Share Intent handling
    useEffect(() => {
        if (sharedUrl && isMounted.current) {
            console.log("[Root] VALID Share Intent detected. Dispatching to store:", sharedUrl);
            setPendingSharedUrl(sharedUrl);
            if (sharedContent) {
                setPendingSharedText(sharedContent);
            }
            clearSharedUrl();

            // If logged in and profile complete, immediately redirect to Analyze
            if (userProfile && isInitialized) {
                const hasNameInfo = !!((userProfile.firstName && userProfile.lastName) || userProfile.displayName);
                const isProfileComplete = !!(userProfile.profileCompleted || (hasNameInfo && userProfile.targetJobTitle && (userProfile.targetIndustry || userProfile.industry)));

                if (isProfileComplete) {
                    const isAlreadyOnAnalyze = segments.some(s => s === 'analyze');
                    if (!isAlreadyOnAnalyze) {
                        router.replace('/(tabs)/analyze' as any);
                    }
                }
            }
        }
    }, [sharedUrl, userProfile, isInitialized, segments]);

    useEffect(() => {
        if (!isInitialized || !isMounted.current) return;

        const inAuthGroup = segments[0] === '(auth)';
        const currentRoute = (segments as any)[1];
        const atRoot = segments.length < 1 || (segments.length === 1 && segments[0] === "");

        if (!userProfile) {
            if (!inAuthGroup && !atRoot && !isPublicRoute) {
                setTimeout(() => router.replace('/' as any), 0);
            }
        } else {
            const hasNameInfo = !!((userProfile.firstName && userProfile.lastName) || userProfile.displayName);
            const isProfileComplete = !!(userProfile.profileCompleted || (hasNameInfo && userProfile.targetJobTitle && (userProfile.targetIndustry || userProfile.industry)));

            if (isProfileComplete) {
                if (inAuthGroup || atRoot) {
                    const pendingUrl = useResumeStore.getState().pendingSharedUrl;
                    const isOnDeepScreen = segments.length > 1 && !segments.includes('(tabs)') && !segments.includes('(auth)');

                    // Check if we have an incoming share intent either in the store or currently in the hook
                    const isProcessingShare = !!pendingUrl || !!sharedUrl;

                    setTimeout(() => {
                        if (isProcessingShare) {
                            console.log("[Root] Holding off Home redirect - Share Intent processing.");
                            router.replace('/(tabs)/analyze' as any);
                        } else if (!isOnDeepScreen) {
                            router.replace('/(tabs)/home' as any);
                        }
                    }, 0);
                }
            } else if (currentRoute !== 'onboarding' && currentRoute !== 'sign-up') {
                setTimeout(() => router.replace('/(auth)/onboarding' as any), 0);
            }
        }
    }, [userProfile, segments, isInitialized, sharedUrl]);

    if (!isInitialized) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Initializing...</Text>
            </View>
        );
    }

    const headerOptions = {
        headerRight: () => userProfile ? <UserHeader /> : null,
        headerStyle: { backgroundColor: theme.colors.elevation.level2 },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { color: theme.colors.onSurface },
    };

    // Override Text default props on native platforms (one-time)
    if (Platform.OS !== 'web' && !textPropsSet.current) {
        textPropsSet.current = true;
        const TextComponent = RNText as any;
        if (TextComponent.defaultProps) {
            TextComponent.defaultProps.maxFontSizeMultiplier = 1.3;
        } else {
            TextComponent.defaultProps = { maxFontSizeMultiplier: 1.3 };
        }
    }

    if (Platform.OS === 'web' && !userProfile && !isPublicRoute && !isAuthRoute) {
        return (
            <PaperProvider theme={theme}>
                <WebLandingPage />
            </PaperProvider>
        );
    }

    const appContent = (
        <Stack screenOptions={headerOptions}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="analysis-result" options={{ title: 'Analysis Result', presentation: 'card' }} />
            <Stack.Screen name="upskilling-path" options={{ title: 'Your Learning Path', presentation: 'card' }} />
            <Stack.Screen name="optimization-editor" options={{ title: 'Resume Editor', presentation: 'modal' }} />
            <Stack.Screen name="resume-preview" options={{ title: 'Preview', presentation: 'modal' }} />
            <Stack.Screen name="purchase" options={{ title: 'Refill Tokens', presentation: 'modal' }} />
            <Stack.Screen name="purchase-history" options={{ title: 'Purchase History', presentation: 'modal' }} />
            <Stack.Screen name="analytics" options={{ title: 'Usage Analytics', headerBackTitle: 'Back' }} />
            <Stack.Screen name="history-details" options={{ headerBackTitle: 'Back', title: '' }} />
            <Stack.Screen name="user-activity" options={{ title: 'Activity History', headerBackTitle: 'Back' }} />
            <Stack.Screen name="profile/edit" options={{ title: 'Edit Profile', headerBackTitle: 'Back' }} />

            {/* Settings Pages */}
            <Stack.Screen name="settings/about" options={{ title: 'About RiResume', headerBackTitle: 'Back', presentation: 'card' }} />
            <Stack.Screen name="settings/help" options={{ title: 'Help & Support', headerBackTitle: 'Back', presentation: 'card' }} />
            <Stack.Screen name="settings/privacy" options={{ title: 'Privacy Policy', headerBackTitle: 'Back', presentation: 'card' }} />
            <Stack.Screen name="settings/terms" options={{ title: 'Terms of Service', headerBackTitle: 'Back', presentation: 'card' }} />

            <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack>
    );

    const isTabRoute = segments[0] === '(tabs)';

    return (
        <PaperProvider theme={theme}>
            <TaskQueueProvider>
                {Platform.OS === 'web' && userProfile ? (
                    <WebAppLayout>{appContent}</WebAppLayout>
                ) : (
                    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
                        {isTabRoute ? (
                            appContent
                        ) : (
                            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
                                {appContent}
                            </SafeAreaView>
                        )}
                    </View>
                )}
            </TaskQueueProvider>
        </PaperProvider>
    );
}
