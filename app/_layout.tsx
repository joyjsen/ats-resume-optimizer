import React, { useEffect, useRef } from 'react';
import { Platform, View, TouchableOpacity } from 'react-native';
import { useRouter, useSegments, Stack } from 'expo-router';
import { PaperProvider, Text as RNText, ActivityIndicator } from 'react-native-paper';
import { useProfileStore } from '../src/store/profileStore';
import { ThemeProvider, useAppTheme } from '../src/context/ThemeContext';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ShareIntentProvider } from "expo-share-intent";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

// Keep native splash screen visible until we've resolved auth + routing
SplashScreen.preventAutoHideAsync().catch(() => {});

// Lazy load heavy components and providers
const WebLandingPage = React.lazy(() => import('../src/components/web/landing/WebLandingPage'));
const WebAppLayout = React.lazy(() => import('../src/components/web/WebAppLayout'));
const AppEngine = React.lazy(() => import('../src/components/layout/AppEngine'));
const AppProvidersWrapper = React.lazy(() => import('../src/components/layout/AppProvidersWrapper'));
const UserHeader = React.lazy(() => import('../src/components/layout/UserHeader').then(m => ({ default: m.UserHeader })));

export default function RootLayout() {
    return (
        <ShareIntentProvider options={{ scheme: "riresume" }}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <RootLayoutContent />
                </ThemeProvider>
            </SafeAreaProvider>
        </ShareIntentProvider>
    );
}

function RootLayoutContent() {
    const segments = useSegments();
    const router = useRouter();
    const { userProfile, isInitialized } = useProfileStore();
    const { theme } = useAppTheme();
    const textPropsSet = useRef(false);
    const hasNavigated = useRef(false);

    // Navigation guard: fires once when isInitialized becomes true, and again on segment changes
    useEffect(() => {
        if (!isInitialized) return;

        const publicRoutes = ['settings/terms', 'settings/privacy', 'settings/about', 'settings/help', 'blog', 'careers', 'reviews', 'llm_info'];
        const isPublicRoute = publicRoutes.some(route => segments.join('/').includes(route));
        const inAuthGroup = segments[0] === '(auth)';
        const atRoot = segments.length < 1 || (segments.length === 1 && segments[0] === "");
        const currentRoute = segments.length > 1 ? (segments as string[])[1] : null;

        if (!userProfile) {
            // Not logged in: only protect against accessing guarded routes
            if (!inAuthGroup && !atRoot && !isPublicRoute) {
                router.replace('/' as any);
            } else {
                // Valid unauthenticated state — reveal app
                SplashScreen.hideAsync().catch(() => {});
            }
        } else {
            const hasNameInfo = !!((userProfile.firstName && userProfile.lastName) || userProfile.displayName);
            const isProfileComplete = !!(userProfile.profileCompleted || (hasNameInfo && userProfile.targetJobTitle && (userProfile.targetIndustry || userProfile.industry)));

            if (isProfileComplete) {
                if (inAuthGroup || atRoot || isPublicRoute) {
                    // Only navigate once per session to avoid loop
                    if (!hasNavigated.current) {
                        hasNavigated.current = true;
                        router.replace('/(tabs)/home' as any);
                    }
                } else {
                    SplashScreen.hideAsync().catch(() => {});
                }
            } else {
                if (currentRoute !== 'onboarding' && currentRoute !== 'sign-up') {
                    if (!hasNavigated.current) {
                        hasNavigated.current = true;
                        router.replace('/(auth)/onboarding' as any);
                    }
                } else {
                    SplashScreen.hideAsync().catch(() => {});
                }
            }
        }
    }, [isInitialized, userProfile, segments]);

    // Reset navigation lock when user profile changes (new login/logout)
    useEffect(() => {
        hasNavigated.current = false;
    }, [userProfile?.uid]);

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

    const isTabRoute = segments[0] === '(tabs)';
    const isAuthRoute = segments[0] === '(auth)';

    const publicRoutes = ['settings/terms', 'settings/privacy', 'settings/about', 'settings/help', 'blog', 'careers', 'reviews', 'llm_info'];
    const isPublicRoute = publicRoutes.some(route => segments.join('/').includes(route));

    const headerOptions = {
        headerRight: () => userProfile ? (
            <React.Suspense fallback={null}>
                <UserHeader />
            </React.Suspense>
        ) : null,
        headerStyle: { backgroundColor: theme.colors.elevation.level2 },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { color: theme.colors.onSurface },
    };

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
            <Stack.Screen
                name="user-activity"
                options={({ navigation }) => ({
                    title: 'Activity History',
                    headerBackTitle: 'Back',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => { if (navigation.canGoBack()) navigation.goBack(); }}
                            style={{ marginLeft: Platform.OS === 'ios' ? 0 : 8, padding: 4 }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
                        </TouchableOpacity>
                    ),
                })}
            />
            <Stack.Screen name="profile/edit" options={{ title: 'Edit Profile', headerBackTitle: 'Back' }} />
            <Stack.Screen name="settings/about" options={{ title: 'About RiResume', headerBackTitle: 'Back', presentation: 'card' }} />
            <Stack.Screen name="settings/help" options={{ title: 'Help & Support', headerBackTitle: 'Back', presentation: 'card' }} />
            <Stack.Screen name="settings/privacy" options={{ title: 'Privacy Policy', headerBackTitle: 'Back', presentation: 'card' }} />
            <Stack.Screen name="settings/terms" options={{ title: 'Terms of Service', headerBackTitle: 'Back', presentation: 'card' }} />
            <Stack.Screen name="careers" options={{ headerShown: false, title: 'Careers' }} />
            <Stack.Screen name="reviews" options={{ headerShown: false, title: 'Reviews' }} />
            <Stack.Screen name="llm_info" options={{ headerShown: false, title: 'AI Tech' }} />
            <Stack.Screen name="blog/index" options={{ headerShown: false, title: 'Blog' }} />
            <Stack.Screen name="blog/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack>
    );

    return (
        <PaperProvider theme={theme}>
            {/* AppEngine handles all heavy root logic lazily.
                CRITICAL: Must be outside the !isInitialized check to allow initialization to start! */}
            <React.Suspense fallback={null}>
                <AppEngine />
            </React.Suspense>

            {Platform.OS === 'web' && !userProfile && !isPublicRoute && !isAuthRoute ? (
                <React.Suspense fallback={null}>
                    <WebLandingPage />
                </React.Suspense>
            ) : Platform.OS === 'web' && userProfile ? (
                <React.Suspense fallback={null}>
                    <AppProvidersWrapper>
                        <WebAppLayout>{appContent}</WebAppLayout>
                    </AppProvidersWrapper>
                </React.Suspense>
            ) : (
                <AppProvidersWrapper>
                    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
                        {isTabRoute ? (
                            appContent
                        ) : (
                            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
                                {appContent}
                            </SafeAreaView>
                        )}
                    </View>
                </AppProvidersWrapper>
            )}
        </PaperProvider>
    );
}
