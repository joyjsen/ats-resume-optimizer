import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Platform, RefreshControl, Dimensions, TouchableOpacity, Alert, useWindowDimensions, Animated as RNAnimated } from "react-native";
import { Text, useTheme, Card, ProgressBar, IconButton, Surface, Avatar, Button, Chip, ActivityIndicator } from 'react-native-paper';
import { useAppTheme } from '../../src/context/ThemeContext';
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfileStore } from "../../src/store/profileStore";
import { useResumeStore } from "../../src/store/resumeStore";
import { historyService } from "../../src/services/firebase/historyService";
import { applicationService } from "../../src/services/firebase/applicationService";
import { SavedAnalysis } from "../../src/types/history.types";
import { Application } from "../../src/types/application.types";
import { getFirebaseAuth } from "../../src/services/firebase/config";
import { DAILY_TIPS } from "../../src/data/dailyTips";
import Svg, { Path, Circle } from 'react-native-svg';
import { useShareIntentHandler } from "../../src/hooks/useShareIntentHandler";
import { useTutorialStore } from "../../src/store/tutorialStore";
import { StyledAlert } from "../../src/components/common/StyledAlert";

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);
const AnimatedCircle = RNAnimated.createAnimatedComponent(Circle);

const SVGArrow = () => {
    const drawAnim = React.useRef(new RNAnimated.Value(200)).current; 
    const drawArrowHead = React.useRef(new RNAnimated.Value(40)).current;
    const fadeCircle = React.useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        RNAnimated.sequence([
            RNAnimated.delay(300),
            RNAnimated.timing(fadeCircle, { toValue: 1, duration: 200, useNativeDriver: true }),
            RNAnimated.timing(drawAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
            RNAnimated.timing(drawArrowHead, { toValue: 0, duration: 300, useNativeDriver: true })
        ]).start();
    }, []);

    return (
        <Svg width="140" height="110" viewBox="0 0 140 110" fill="none" style={{
            shadowColor: "#7C3AED",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 6,
            elevation: 3
        }}>
            <AnimatedPath
                d="M 120 10 C 100 8, 60 5, 30 30 C 10 48, 8 72, 20 88"
                stroke="#A78BFA"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                strokeDasharray="200"
                strokeDashoffset={drawAnim}
            />
            <AnimatedPath
                d="M 20 88 L 8 76 M 20 88 L 34 80"
                stroke="#A78BFA"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                strokeDasharray="40"
                strokeDashoffset={drawArrowHead}
            />
            <AnimatedCircle cx="122" cy="10" r="3" fill="#A78BFA" opacity={fadeCircle} />
        </Svg>
    );
};

const isAndroid = Platform.OS === 'android';

const RiResumeHome = () => {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { isDark, toggleTheme } = useAppTheme();
    const { width } = useWindowDimensions();

    // Responsive width calculation: (total width - padding - gaps) / 3
    // Subtracting a small buffer (1px) to prevent floating point rounding errors from causing wrap
    const cardWidth = Math.floor((width - 32 - 16) / 3) - 1;

    const [time, setTime] = useState(new Date());
    const [authInstance, setAuthInstance] = useState<any>(null);
    const [animatedProgress] = useState(new RNAnimated.Value(0));

    // Onboarding State
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isGlowing, setIsGlowing] = useState(false);
    const [analyzeCardLayout, setAnalyzeCardLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const pulseAnim = React.useRef(new RNAnimated.Value(0)).current;
    
    // Optimize Tutorial State
    const [showOptimizeTutorial, setShowOptimizeTutorial] = useState(false);
    const [isOptimizeGlowing, setIsOptimizeGlowing] = useState(false);
    const [optimizeCardLayout, setOptimizeCardLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const optimizePulseAnim = React.useRef(new RNAnimated.Value(0)).current;

    const overlayOpacity = React.useRef(new RNAnimated.Value(0)).current;
    
    // Custom Alert State
    const [showResetAlert, setShowResetAlert] = useState(false);
    
    // Check intent
    const { sharedUrl } = useShareIntentHandler();
    const { pendingSharedUrl } = useResumeStore();

    const { isSkipped, hasSeenAnalyzeStart, hasSeenOptimizePending, markSeen, loadState, resetTutorials } = useTutorialStore();

    useFocusEffect(
        React.useCallback(() => {
            loadState();
        }, [loadState])
    );

    // FTUE Evaluation is handled in useFocusEffect below

    useEffect(() => {
        if (isGlowing) {
            RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
                    RNAnimated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: false })
                ])
            ).start();
        } else {
            pulseAnim.setValue(0);
        }
    }, [isGlowing]);

    useEffect(() => {
        if (isOptimizeGlowing) {
            RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(optimizePulseAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
                    RNAnimated.timing(optimizePulseAnim, { toValue: 0, duration: 900, useNativeDriver: false })
                ])
            ).start();
        } else {
            optimizePulseAnim.setValue(0);
        }
    }, [isOptimizeGlowing]);

    // Data stores
    const { userProfile, refreshProfile, activities } = useProfileStore();
    const sevenDaysAgo = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        d.setHours(0, 0, 0, 0);
        return d;
    })();
    const [history, setHistory] = useState<SavedAnalysis[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [subsReady, setSubsReady] = useState({ profile: false, history: false, apps: false });

    const tokenBalance = userProfile?.tokenBalance || 0;
    const userName = userProfile?.displayName?.split(" ")[0] || "User";

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Check for pending optimizations natively
    const hasPendingOptimization = React.useMemo(() => history.some(h => h.analysisStatus === 'pending_resume_update'), [history]);

    useFocusEffect(
        React.useCallback(() => {
            let isActive = true;

            const evaluateInterventions = async () => {
                const tutorialState = useTutorialStore.getState();
                
                if (tutorialState.isSkipped) {
                    setShowOnboarding(false);
                    setShowOptimizeTutorial(false);
                    // Still apply subtle highlights based on context
                    if (hasPendingOptimization) {
                        setIsOptimizeGlowing(true);
                        setIsGlowing(false);
                    } else {
                        setIsOptimizeGlowing(false);
                        setIsGlowing(true);
                    }
                    return;
                }
                
                // Pause interventions if a file is actively being shared in
                if (sharedUrl || pendingSharedUrl) return;

                if (hasPendingOptimization) {
                    // 1. Optimize takes total priority
                    setIsGlowing(false);
                    setShowOnboarding(false);
                    
                    setIsOptimizeGlowing(true);
                    if (!tutorialState.hasSeenOptimizePending) {
                        setTimeout(() => {
                            if (isActive) {
                                setShowOptimizeTutorial(true);
                                RNAnimated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
                            }
                        }, 400);
                    } else {
                        setShowOptimizeTutorial(false);
                    }
                } else {
                    // 2. Default to Analyze (idle state)
                    setIsOptimizeGlowing(false);
                    setShowOptimizeTutorial(false);
                    
                    setIsGlowing(true);
                    if (!tutorialState.hasSeenAnalyzeStart) {
                        if (isActive) {
                            setShowOnboarding(true);
                            RNAnimated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
                        }
                    } else {
                        setShowOnboarding(false);
                    }
                }
            };

            const timer = setTimeout(evaluateInterventions, 300);

            return () => {
                isActive = false;
                clearTimeout(timer);
                setShowOnboarding(false);
                setShowOptimizeTutorial(false);
            };
        }, [sharedUrl, pendingSharedUrl, hasPendingOptimization])
    );

    // Mark data as loaded when all subscriptions have fired
    useEffect(() => {
        if (subsReady.profile && subsReady.history && subsReady.apps) {
            setDataLoaded(true);
        }
    }, [subsReady]);

    // Animate progress bar when token balance changes
    useEffect(() => {
        const WELCOME_BONUS = 110;
        const totalOwned = (userProfile?.totalTokensPurchased || 0) + WELCOME_BONUS;
        const progress = totalOwned > 0 ? tokenBalance / totalOwned : 0;
        RNAnimated.timing(animatedProgress, {
            toValue: progress,
            duration: 800,
            useNativeDriver: false,
        }).start();
    }, [tokenBalance, userProfile?.totalTokensPurchased]);

    // Initialize Auth and Data Subscription
    useEffect(() => {
        let isMounted = true;
        let unsubscribeHistory: (() => void) | undefined;
        let unsubscribeApps: (() => void) | undefined;

        const init = async () => {
            const auth = await getFirebaseAuth();
            if (!isMounted) return;
            setAuthInstance(auth);

            const user = auth?.currentUser;
            if (!user) return;

            // Initial fetch
            refreshProfile().then(() => {
                setSubsReady(prev => ({ ...prev, profile: true }));
            }).catch(() => {
                setSubsReady(prev => ({ ...prev, profile: true }));
            });

            unsubscribeHistory = historyService.subscribeToUserHistory((data) => {
                if (isMounted) {
                    setHistory(data);
                    setSubsReady(prev => ({ ...prev, history: true }));
                }
            });

            unsubscribeApps = applicationService.subscribeToApplications((data) => {
                if (isMounted) {
                    setApplications(data);
                    setSubsReady(prev => ({ ...prev, apps: true }));
                }
            });
        };

        init();

        return () => {
            isMounted = false;
            unsubscribeHistory?.();
            unsubscribeApps?.();
        };
    }, [refreshProfile, authInstance?.currentUser?.uid]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshProfile();
        // The list updates automatically via subscription
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

    const greeting = () => {
        const h = time.getHours();
        if (h < 12) return "Good morning";
        if (h < 17) return "Good afternoon";
        return "Good evening";
    };

    const quickActions = [
        { id: "analyze", icon: "file-search-outline", label: "Analyze Resume", cost: "8 tokens", route: "/(tabs)/analyze" },
        { id: "optimize", icon: "shimmer", label: "Optimize", cost: "15 tokens", route: "/(tabs)/optimize" },
        {
            id: "cover",
            icon: "file-document-edit-outline",
            label: "Cover Letter",
            cost: "15 tokens",
            route: "/(tabs)/applications",
            infoMessage: "Click on an application to find the option for cover letter generation"
        },
        {
            id: "prep",
            icon: "microphone-outline",
            label: "Interview Prep",
            cost: "40 tokens",
            route: "/(tabs)/applications",
            infoMessage: "Click on an application to find the option for prep guide generation or re-generation"
        },
        {
            id: "skill",
            icon: "school-outline",
            label: "Skill Addition",
            cost: "15 tokens",
            route: "/(tabs)/optimize",
            infoMessage: "Open an optimized resume to add skills"
        },
        { id: "learn", icon: "school-outline", label: "Learning Hub", cost: "30 tokens", route: "/(tabs)/learning" },
    ];

    // Helper for robust date conversion
    const toDate = (date: any): Date => {
        if (!date) return new Date(0);
        if (date instanceof Date) return date;
        if (typeof date.toDate === 'function') return date.toDate(); // Firestore Timestamp
        if (date.seconds) return new Date(date.seconds * 1000); // Serialized Timestamp
        return new Date(date); // String or number
    };

    const weeklyStats = [
        {
            label: "Applications",
            value: applications.length, // Show total applications as requested
            icon: "clipboard-list-outline",
        },
        {
            label: "Avg ATS Score",
            value: (() => {
                const optimizedHistory = history.filter(h =>
                    (h.analysisStatus === 'optimized' || !!h.optimizedResumeData) &&
                    (h.atsScore > 0 || (h.draftAtsScore && h.draftAtsScore > 0))
                );
                if (optimizedHistory.length === 0) return "0%";
                const totalScore = optimizedHistory.reduce((acc, curr) => acc + (curr.draftAtsScore || curr.atsScore || 0), 0);
                return Math.round(totalScore / optimizedHistory.length) + "%";
            })(),
            icon: "chart-bar",
        },
        {
            label: "Trainings",
            value: activities.filter(a => a.type === 'learning_completion' && toDate(a.timestamp) >= sevenDaysAgo).length,
            icon: "school",
        },
        {
            label: "Interviews",
            value: applications.filter(a =>
                ['submitted', 'phone_screen', 'technical', 'final_round', 'offer'].includes(a.currentStage) &&
                toDate(a.lastStatusUpdate) >= sevenDaysAgo
            ).length,
            icon: "account-voice",
        },
    ];

    // Daily Tip Logic
    const [dailyTip, setDailyTip] = useState(DAILY_TIPS[0]);

    useEffect(() => {
        const updateDailyTip = () => {
            // Calculate days since epoch to ensure 24-hour rotation
            const now = new Date();
            const daysSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));

            // Use modulo to cycle through tips
            const tipIndex = daysSinceEpoch % DAILY_TIPS.length;
            setDailyTip(DAILY_TIPS[tipIndex]);
        };

        updateDailyTip();

        // Optional: Update when app comes to foreground or date changes
        const interval = setInterval(updateDailyTip, 1000 * 60 * 60); // Check every hour
        return () => clearInterval(interval);
    }, []);

    // Get 3 recent applications
    const recentApplications = history.slice(0, 3);

    if (!dataLoaded) {
        return (
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
                <StatusBar style={theme.dark ? "light" : "dark"} />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: insets.top }}>
                    <ActivityIndicator size="large" />
                    <Text variant="bodyMedium" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>Loading your dashboard...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar style={theme.dark ? "light" : "dark"} />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={[styles.header, isAndroid && { paddingVertical: 12 }]}>
                    <View>
                        <Text variant={isAndroid ? "labelSmall" : "labelLarge"} style={{ color: theme.colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 }}>{greeting()}</Text>
                        <Text variant={isAndroid ? "headlineSmall" : "headlineMedium"} style={{ fontWeight: "700" }}>{userName} 👋</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                        <Button mode="contained" onPress={() => router.push('/purchase' as any)} compact={isAndroid}>
                            Buy Tokens
                        </Button>
                        <Button 
                            icon="lightbulb-on" 
                            mode="text" 
                            compact={isAndroid} 
                            textColor={theme.colors.primary} 
                            onPress={() => {
                                resetTutorials();
                                setShowResetAlert(true);
                            }}
                        >
                            Learn how to use the app
                        </Button>
                    </View>
                </View>

                {/* Token Balance Card */}
                <View style={styles.section}>
                    <Card style={{ backgroundColor: theme.colors.elevation.level2 }}>
                        <Card.Content>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View>
                                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>TOKEN BALANCE</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                                        {!dataLoaded ? (
                                            <ActivityIndicator size="small" style={{ marginVertical: 8 }} />
                                        ) : (
                                            <>
                                                <Text variant="displaySmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>{tokenBalance}</Text>
                                                <Text variant="bodyMedium" style={{ marginLeft: 4, color: theme.colors.onSurfaceVariant }}>tokens</Text>
                                            </>
                                        )}
                                    </View>
                                </View>
                            </View>
                            <View style={{ marginTop: 16 }}>
                                {(() => {
                                    return (
                                        <>
                                            <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceVariant, overflow: 'hidden' }}>
                                                <RNAnimated.View style={{
                                                    height: '100%',
                                                    borderRadius: 3,
                                                    backgroundColor: theme.colors.primary,
                                                    width: animatedProgress.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: ['0%', '100%'],
                                                        extrapolate: 'clamp',
                                                    }),
                                                }} />
                                            </View>
                                            <Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                                                ~{Math.floor(tokenBalance / 8)} analyses or ~{Math.floor(tokenBalance / 15)} optimizations remaining
                                            </Text>
                                        </>
                                    );
                                })()}
                            </View>
                        </Card.Content>
                    </Card>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.grid}>
                        {quickActions.map((action) => {
                            const isThisCardAnalyze = action.id === 'analyze';
                            const isThisCardOptimize = action.id === 'optimize';
                            
                            const animStyle = isThisCardAnalyze ? {
                                borderColor: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', '#7C3AED'] }),
                                borderWidth: isGlowing ? 2 : 0,
                                borderRadius: 14,
                                shadowColor: '#7C3AED',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }),
                                shadowRadius: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
                            } : isThisCardOptimize ? {
                                borderColor: optimizePulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', '#7C3AED'] }),
                                borderWidth: isOptimizeGlowing ? 2 : 0,
                                borderRadius: 14,
                                shadowColor: '#7C3AED',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: optimizePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }),
                                shadowRadius: optimizePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
                            } : {};

                            return (
                            <RNAnimated.View key={action.id} style={{ width: cardWidth, marginBottom: 8, height: isAndroid ? 90 : 110, ...animStyle }}>
                                <View ref={(ref) => {
                                    if (ref && (isThisCardAnalyze || isThisCardOptimize)) {
                                        // Wait a moment for layout to settle then measure
                                        setTimeout(() => {
                                            ref.measureInWindow((x, y, w, h) => {
                                                if (y > 0) {
                                                    if (isThisCardAnalyze) setAnalyzeCardLayout({ x, y, width: w, height: h });
                                                    if (isThisCardOptimize) setOptimizeCardLayout({ x, y, width: w, height: h });
                                                }
                                            });
                                        }, 600);
                                    }
                                }} style={{ width: '100%', height: '100%' }}>
                                    <Card
                                        style={[styles.actionCard, { width: '100%', height: '100%', marginBottom: 0, ...((isGlowing && isThisCardAnalyze) || (isOptimizeGlowing && isThisCardOptimize) ? { backgroundColor: theme.dark ? '#1E1830' : '#F3E8FF', borderColor: 'transparent' } : { backgroundColor: theme.colors.surface }) }]}
                                        onPress={async () => {
                                            if (isThisCardAnalyze && (isGlowing || showOnboarding)) {
                                                await AsyncStorage.setItem('hasSeenAnalyzeTutorial', 'true');
                                                setIsGlowing(false);
                                                setShowOnboarding(false);
                                            }
                                            if (isThisCardOptimize && showOptimizeTutorial) {
                                                setShowOptimizeTutorial(false);
                                            }
                                            router.push(action.route as any);
                                        }}
                                        mode="outlined"
                                    >
                                    <View style={{ position: 'relative' }}>
                                        {/* Info Button */}
                                        {action.infoMessage && (
                                            <View style={{ position: 'absolute', top: -4, right: -4, zIndex: 10 }}>
                                                <IconButton
                                                    icon="information-variant"
                                                    size={16}
                                                    onPress={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        Alert.alert("Info", action.infoMessage);
                                                    }}
                                                />
                                            </View>
                                        )}
                                        <Card.Content style={{ alignItems: 'center', padding: isAndroid ? 4 : 8, paddingTop: action.infoMessage ? (isAndroid ? 12 : 16) : (isAndroid ? 4 : 8) }}>
                                            <IconButton icon={action.icon} size={isAndroid ? 20 : 24} iconColor={theme.colors.primary} style={{ margin: 0 }} />
                                            <Text variant="labelSmall" style={{ textAlign: 'center', marginTop: isAndroid ? 2 : 4, fontWeight: 'bold', fontSize: isAndroid ? 9 : 11 }}>{action.label}</Text>
                                            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: isAndroid ? 8 : 10 }}>{action.cost}</Text>
                                        </Card.Content>
                                    </View>
                                </Card>
                                </View>
                            </RNAnimated.View>
                            );
                        })}
                    </View>
                </View>

                {/* Stats Summary */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Overview - This Week</Text>
                    {!dataLoaded ? (
                        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                            <ActivityIndicator size="small" />
                        </View>
                    ) : (
                        <View style={styles.statsGrid}>
                            {weeklyStats.map((stat, i) => (
                                <View key={i} style={[styles.statItem, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1 }, isAndroid && { padding: 8 }]}>
                                    <IconButton icon={stat.icon} size={isAndroid ? 18 : 20} style={{ margin: 0 }} />
                                    <Text variant={isAndroid ? "titleMedium" : "titleLarge"} style={{ fontWeight: 'bold' }}>{stat.value}</Text>
                                    <Text
                                        variant="labelSmall"
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        style={{ color: theme.colors.onSurfaceVariant, fontSize: isAndroid ? 9 : 10 }}
                                    >
                                        {stat.label}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Recent Applications */}
                <View style={styles.section}>
                    <View style={styles.rowBetween}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Recent Applications</Text>
                        <Button mode="text" onPress={() => router.push("/(tabs)/applications")} compact>View All</Button>
                    </View>
                    <View style={{ gap: 8 }}>
                        {recentApplications.map((app, i) => {
                            const daysAgo = Math.floor((Date.now() - (
                                app.updatedAt instanceof Date ? app.updatedAt.getTime() :
                                    (app.updatedAt as any)?.seconds ? (app.updatedAt as any).seconds * 1000 :
                                        Date.now()
                            )) / (1000 * 60 * 60 * 24));
                            const score = app.draftAtsScore || app.atsScore || 0;
                            const isOptimized = !!app.optimizedResumeData;

                            return (
                                <Card key={app.id || i} onPress={() => router.push({ pathname: '/(tabs)/applications', params: { expandAppId: app.id } } as any)} mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
                                    <Card.Content style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <Avatar.Icon
                                                size={isAndroid ? 32 : 40}
                                                icon={isOptimized ? "check-decagram" : "file-document-outline"}
                                                style={{ backgroundColor: isOptimized ? theme.colors.primaryContainer : theme.colors.surfaceVariant }}
                                                color={isOptimized ? theme.colors.primary : theme.colors.onSurfaceVariant}
                                            />
                                            <View style={{ marginLeft: isAndroid ? 8 : 12, flex: 1 }}>
                                                <Text variant={isAndroid ? "titleSmall" : "titleMedium"} numberOfLines={1}>{app.company}</Text>
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: isAndroid ? 10 : 12 }}>{app.jobTitle} · {daysAgo}d ago</Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            {score > 0 ? (
                                                <>
                                                    <Text variant={isAndroid ? "titleLarge" : "headlineSmall"} style={{ color: score >= 80 ? theme.colors.primary : theme.colors.secondary, fontWeight: 'bold' }}>{score}%</Text>
                                                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: isAndroid ? 9 : 11 }}>ATS</Text>
                                                </>
                                            ) : (
                                                <Chip compact style={{ backgroundColor: theme.colors.surfaceVariant }}>Draft</Chip>
                                            )}
                                        </View>
                                    </Card.Content>
                                </Card>
                            );
                        })}
                        {recentApplications.length === 0 && (
                            <Text style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant, padding: 20 }}>No applications yet.</Text>
                        )}
                    </View>
                </View>

                {/* Daily Tip */}
                <View style={styles.section}>
                    <Card style={{ backgroundColor: theme.colors.tertiaryContainer }}>
                        <Card.Content>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <IconButton icon="lightbulb-on" size={20} iconColor={theme.colors.tertiary} style={{ margin: 0, marginRight: 8 }} />
                                <Text variant="titleSmall" style={{ color: theme.colors.tertiary, fontWeight: 'bold' }}>Daily Tip #{dailyTip.id}</Text>
                            </View>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onTertiaryContainer }}>
                                {dailyTip.tip}
                            </Text>
                        </Card.Content>
                    </Card>
                </View>
            </ScrollView>

            {/* Onboarding Overlay */}
            {showOnboarding && analyzeCardLayout.y > 0 && (
                <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(8,6,18,0.85)" : "rgba(255,255,255,0.85)", zIndex: 100, opacity: overlayOpacity }]} pointerEvents="auto">
                    {/* SVG Arrow */}
                    <View style={{ position: 'absolute', top: analyzeCardLayout.y - 110, left: analyzeCardLayout.x + (analyzeCardLayout.width / 2) - 10 }}>
                        <SVGArrow />
                    </View>

                    {/* Popover */}
                    <View style={{ position: 'absolute', top: analyzeCardLayout.y - 270, left: 20, right: 20, backgroundColor: theme.dark ? '#1E1830' : '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.5)", shadowColor: "#7C3AED", shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 }}>
                        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#A78BFA", marginRight: 8 }} />
                            <Text style={{ color: "#A78BFA", fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>START HERE</Text>
                        </View>
                        <Text style={{ color: theme.dark ? "#F5F3FF" : "#111", fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Analyze your resume first</Text>
                        <Text style={{ color: theme.dark ? "#9CA3AF" : "#555", fontSize: 14, lineHeight: 20, marginBottom: 20 }}>Upload your Resume and paste/share a Job link to get your match score, see which keywords you're missing, and unlock personalized optimizations.</Text>
                        
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity style={{ backgroundColor: "#7C3AED", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50 }} onPress={() => { setShowOnboarding(false); setIsGlowing(true); useTutorialStore.getState().markSeen('hasSeenAnalyzeStart'); }}>
                                <Text style={{ color: "white", fontSize: 14, fontWeight: '600' }}>Got it, let's start →</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 16 }} onPress={() => { useTutorialStore.getState().skipAllTutorials(); setShowOnboarding(false); }}>
                                <Text style={{ color: theme.dark ? "#9CA3AF" : "#555", fontSize: 14, fontWeight: '600' }}>Skip Training</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </RNAnimated.View>
            )}

            {/* Optimize Onboarding Overlay */}
            {showOptimizeTutorial && optimizeCardLayout.y > 0 && !showOnboarding && (
                <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(8,6,18,0.85)" : "rgba(255,255,255,0.85)", zIndex: 100, opacity: overlayOpacity }]} pointerEvents="auto">
                    {/* SVG Arrow */}
                    <View style={{ position: 'absolute', top: optimizeCardLayout.y - 110, left: optimizeCardLayout.x + (optimizeCardLayout.width / 2) - 10 }}>
                        <SVGArrow />
                    </View>

                    {/* Popover */}
                    <View style={{ position: 'absolute', top: optimizeCardLayout.y - 230, left: 20, right: 20, backgroundColor: theme.dark ? '#1E1830' : '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.5)", shadowColor: "#7C3AED", shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 }}>
                        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#A78BFA", marginRight: 8 }} />
                            <Text style={{ color: "#A78BFA", fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>ACTION REQUIRED</Text>
                        </View>
                        <Text style={{ color: theme.dark ? "#F5F3FF" : "#111", fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Complete Optimization</Text>
                        <Text style={{ color: theme.dark ? "#9CA3AF" : "#555", fontSize: 14, lineHeight: 20, marginBottom: 20 }}>You have an incomplete resume optimization waiting for you. Tap "Optimize" to view it and push your new skills onto your resume!</Text>
                        
                        <TouchableOpacity style={{ backgroundColor: "#7C3AED", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50, alignSelf: 'flex-start' }} onPress={() => { setShowOptimizeTutorial(false); useTutorialStore.getState().markSeen('hasSeenOptimizePending'); }}>
                            <Text style={{ color: "white", fontSize: 14, fontWeight: '600' }}>Got it →</Text>
                        </TouchableOpacity>
                    </View>
                </RNAnimated.View>
            )}

            <StyledAlert 
                visible={showResetAlert}
                title="Tutorials Reset"
                description="You will see the learning modals if you logout from the profile tab and relogin to the app"
                buttonText="OK"
                onClose={() => setShowResetAlert(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        padding: 24,
        paddingBottom: 16,
        paddingTop: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    headerActions: {
        flexDirection: "row",
        alignItems: 'center',
    },
    section: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        marginBottom: 12,
        fontWeight: "bold",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    actionCard: {
        marginBottom: 8,
        height: isAndroid ? 90 : 110,
        justifyContent: 'center',
    },
    statsGrid: {
        flexDirection: "row",
        gap: 8,
    },
    statItem: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: 'center',
    },
    rowBetween: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
});

export default RiResumeHome;
