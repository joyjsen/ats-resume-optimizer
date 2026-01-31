
import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, Platform, RefreshControl, Dimensions, TouchableOpacity, Alert } from "react-native";
import { Text, useTheme, Card, ProgressBar, IconButton, Surface, Avatar, Button, Chip } from 'react-native-paper';
import { useAppTheme } from '../../src/context/ThemeContext';
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfileStore } from "../../src/store/profileStore";
import { historyService } from "../../src/services/firebase/historyService";
import { applicationService } from "../../src/services/firebase/applicationService";
import { SavedAnalysis } from "../../src/types/history.types";
import { Application } from "../../src/types/application.types";
import { auth } from "../../src/services/firebase/config";

const ResuMateHome = () => {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { isDark, toggleTheme } = useAppTheme();

    const [time, setTime] = useState(new Date());
    const [animatedTokens, setAnimatedTokens] = useState(0);

    // Data stores
    const { userProfile, refreshProfile, activities } = useProfileStore();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [history, setHistory] = useState<SavedAnalysis[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const tokenBalance = userProfile?.tokenBalance || 0;
    const userName = userProfile?.displayName?.split(" ")[0] || "User";

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Token Animation
    useEffect(() => {
        let start = 0;
        const step = Math.max(1, Math.ceil(tokenBalance / 30));
        const interval = setInterval(() => {
            start += step;
            if (start >= tokenBalance) {
                setAnimatedTokens(tokenBalance);
                clearInterval(interval);
            } else {
                setAnimatedTokens(start);
            }
        }, 25);
        return () => clearInterval(interval);
    }, [tokenBalance]);

    // Data Subscription
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Initial fetch
        refreshProfile();

        const unsubscribeHistory = historyService.subscribeToUserHistory((data) => {
            setHistory(data);
        });

        const unsubscribeApps = applicationService.subscribeToApplications((data) => {
            setApplications(data);
        });

        return () => {
            unsubscribeHistory();
            unsubscribeApps();
        };
    }, []);

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
            cost: "30 tokens",
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
            value: applications.filter(a => toDate(a.createdAt) > sevenDaysAgo).length,
            icon: "clipboard-list-outline",
        },
        {
            label: "Avg ATS Score",
            value: (() => {
                const recentHistory = history.filter(h => toDate(h.createdAt) > sevenDaysAgo);
                if (recentHistory.length === 0) return "0%";
                const avg = recentHistory.reduce((acc, curr) => acc + (curr.draftAtsScore || curr.atsScore || 0), 0) / recentHistory.length;
                return Math.round(avg) + "%";
            })(),
            icon: "chart-bar",
        },
        {
            label: "Trainings",
            value: activities.filter(a => (a.type === 'training_slideshow_generation' || a.type === 'learning_completion') && toDate(a.timestamp) > sevenDaysAgo).length,
            icon: "school",
        },
        {
            label: "Interviews",
            value: applications.filter(a =>
                !a.isArchived &&
                ['submitted', 'phone_screen', 'technical', 'final_round'].includes(a.currentStage) &&
                toDate(a.lastStatusUpdate) > sevenDaysAgo
            ).length,
            icon: "account-voice",
        },
    ];

    // Get 3 recent applications
    const recentApplications = history.slice(0, 3);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar style={theme.dark ? "light" : "dark"} />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 }}>{greeting()}</Text>
                        <Text variant="headlineMedium" style={{ fontWeight: "700" }}>{userName} 👋</Text>
                    </View>
                    <Button mode="contained" onPress={() => router.push('/purchase' as any)} compact style={{ alignSelf: 'center' }}>
                        Buy Tokens
                    </Button>
                </View>

                {/* Token Balance Card */}
                <View style={styles.section}>
                    <Card style={{ backgroundColor: theme.colors.elevation.level2 }}>
                        <Card.Content>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View>
                                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>TOKEN BALANCE</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                                        <Text variant="displaySmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>{animatedTokens}</Text>
                                        <Text variant="bodyMedium" style={{ marginLeft: 4, color: theme.colors.onSurfaceVariant }}>tokens</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={{ marginTop: 16 }}>
                                <ProgressBar progress={0.62} color={theme.colors.primary} style={{ height: 6, borderRadius: 3 }} />
                                <Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                                    ~{Math.floor(tokenBalance / 8)} analyses or ~{Math.floor(tokenBalance / 40)} optimizations remaining
                                </Text>
                            </View>
                        </Card.Content>
                    </Card>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.grid}>
                        {quickActions.map((action) => (
                            <Card
                                key={action.id}
                                style={styles.actionCard}
                                onPress={() => router.push(action.route as any)}
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
                                    <Card.Content style={{ alignItems: 'center', padding: 8, paddingTop: action.infoMessage ? 16 : 8 }}>
                                        <IconButton icon={action.icon} size={24} iconColor={theme.colors.primary} style={{ margin: 0 }} />
                                        <Text variant="labelSmall" style={{ textAlign: 'center', marginTop: 4, fontWeight: 'bold' }}>{action.label}</Text>
                                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}>{action.cost}</Text>
                                    </Card.Content>
                                </View>
                            </Card>
                        ))}
                    </View>
                </View>

                {/* Weekly Stats */}
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>This Week</Text>
                    <View style={styles.statsGrid}>
                        {weeklyStats.map((stat, i) => (
                            <View key={i} style={[styles.statItem, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1 }]}>
                                <IconButton icon={stat.icon} size={20} style={{ margin: 0 }} />
                                <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>{stat.value}</Text>
                                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{stat.label}</Text>
                            </View>
                        ))}
                    </View>
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
                                <Card key={app.id || i} onPress={() => { }} mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
                                    <Card.Content style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                            <Avatar.Icon
                                                size={40}
                                                icon={isOptimized ? "check-decagram" : "file-document-outline"}
                                                style={{ backgroundColor: isOptimized ? theme.colors.primaryContainer : theme.colors.surfaceVariant }}
                                                color={isOptimized ? theme.colors.primary : theme.colors.onSurfaceVariant}
                                            />
                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                <Text variant="titleMedium" numberOfLines={1}>{app.company}</Text>
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{app.jobTitle} · {daysAgo}d ago</Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            {score > 0 ? (
                                                <>
                                                    <Text variant="headlineSmall" style={{ color: score >= 80 ? theme.colors.primary : theme.colors.secondary, fontWeight: 'bold' }}>{score}%</Text>
                                                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>ATS</Text>
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
                                <Text variant="titleSmall" style={{ color: theme.colors.tertiary, fontWeight: 'bold' }}>Daily Tip</Text>
                            </View>
                            <Text variant="bodyMedium" style={{ color: theme.colors.onTertiaryContainer }}>
                                Tailoring your resume for each application can increase your interview rate by up to 3x. Use the Optimize feature to match job-specific keywords.
                            </Text>
                        </Card.Content>
                    </Card>
                </View>
            </ScrollView>
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
        width: (Dimensions.get("window").width - 32 - 16) / 3,
        marginBottom: 8,
        height: 110,
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

export default ResuMateHome;
