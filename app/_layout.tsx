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
import { WebLandingPage } from '../src/components/web/WebLandingPage';
import { WebAppLayout } from '../src/components/web/WebAppLayout';
import { StripeProviderWrapper } from '../src/components/providers/StripeProviderWrapper';
import { ShareIntentProvider } from "expo-share-intent";
import { useResumeStore } from '../src/store/resumeStore';
import { useShareIntentHandler } from '../src/hooks/useShareIntentHandler';
import { auth } from '../src/services/firebase/config';
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

            return () => {
                cleanupListeners();
            };
        }
    }, [userProfile, isInitialized]);

    // Global Share Intent handling
    useEffect(() => {
        console.log("[Root] Global Share Intent Effect triggered. sharedUrl:", sharedUrl, "isMounted:", isMounted.current);
        if (sharedUrl && isMounted.current) {
            console.log("[Root] VALID Share Intent detected. Dispatching to store:", sharedUrl);
            setPendingSharedUrl(sharedUrl);
            if (sharedContent) {
                console.log("[Root] ALSO Dispatching shared CONTENT to store. Length:", sharedContent.length);
                setPendingSharedText(sharedContent);
            }
            console.log("[Root] Clearing sharedUrl from hook via clearSharedUrl()");
            clearSharedUrl();

            // If logged in and profile complete, immediately redirect to Analyze
            if (userProfile && isInitialized) {
                const hasNameInfo = !!((userProfile.firstName && userProfile.lastName) || userProfile.displayName);
                const isProfileComplete = !!(userProfile.profileCompleted || (hasNameInfo && userProfile.targetJobTitle && (userProfile.targetIndustry || userProfile.industry)));

                if (isProfileComplete) {
                    // Only redirect if NOT already on the analyze screen
                    const isAlreadyOnAnalyze = segments.some(s => s === 'analyze');
                    console.log("[Root] isAlreadyOnAnalyze:", isAlreadyOnAnalyze, "segments:", segments);
                    if (!isAlreadyOnAnalyze) {
                        router.replace('/(tabs)/analyze' as any);
                    } else {
                        console.log("[Root] Already on Analyze screen, skipping navigation to preserve state.");
                    }
                }
            }
        }
    }, [sharedUrl, userProfile, isInitialized]);

    useEffect(() => {
        if (!isInitialized || !isMounted.current) return;

        const inAuthGroup = segments[0] === '(auth)';
        const currentRoute = (segments as any)[1];
        const atRoot = segments.length < 1 || (segments.length === 1 && segments[0] === "");

        if (!userProfile) {
            if (!inAuthGroup && !atRoot) {
                setTimeout(() => router.replace('/' as any), 0);
            }
        } else {
            const hasNameInfo = !!((userProfile.firstName && userProfile.lastName) || userProfile.displayName);
            const isProfileComplete = !!(userProfile.profileCompleted || (hasNameInfo && userProfile.targetJobTitle && (userProfile.targetIndustry || userProfile.industry)));

            if (isProfileComplete) {
                if (inAuthGroup || atRoot) {
                    const pendingUrl = useResumeStore.getState().pendingSharedUrl;
                    const isOnDeepScreen = segments.length > 1 && !segments.includes('(tabs)');

                    setTimeout(() => {
                        if (pendingUrl) {
                            router.replace('/(tabs)/analyze' as any);
                        } else if (!isOnDeepScreen) {
                            router.replace('/(tabs)/home' as any);
                        }
                    }, 0);
                }
            } else if (currentRoute !== 'onboarding') {
                setTimeout(() => router.replace('/(auth)/onboarding' as any), 0);
            }
        }
    }, [userProfile, segments, isInitialized]);

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

    // Override Text default props on native platforms to prevent font scaling issues
    if (Platform.OS !== 'web') {
        const TextComponent = RNText as any;
        if (TextComponent.defaultProps) {
            TextComponent.defaultProps.maxFontSizeMultiplier = 1.3;
        } else {
            TextComponent.defaultProps = { maxFontSizeMultiplier: 1.3 };
        }
    }

    const publicRoutes = ['settings/terms', 'settings/privacy'];
    const isPublicRoute = publicRoutes.some(route => segments.join('/').includes(route));

    if (Platform.OS === 'web' && !userProfile && !isPublicRoute) {
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
            <Stack.Screen name="analytics" options={{ title: 'Usage Analytics', headerBackTitle: '' }} />
            <Stack.Screen name="history-details" options={{ headerBackTitle: '', title: '' }} />
            <Stack.Screen name="user-activity" options={{ title: 'Activity History' }} />
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
                    <View style={{ flex: 1 }}>
                        {isTabRoute ? (
                            appContent
                        ) : (
                            <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
                                {appContent}
                            </SafeAreaView>
                        )}
                    </View>
                )}
            </TaskQueueProvider>
        </PaperProvider>
    );
}
