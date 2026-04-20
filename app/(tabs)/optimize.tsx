
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert, Platform, Animated as RNAnimated, TouchableOpacity } from 'react-native';
import { Text, Button, Card, Chip, FAB, useTheme, IconButton, ProgressBar, ActivityIndicator } from 'react-native-paper';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { historyService } from '../../src/services/firebase/historyService';
import { SavedAnalysis } from '../../src/types/history.types';
import { useResumeStore } from '../../src/store/resumeStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useTaskQueue } from '../../src/context/TaskQueueContext';
import { DashboardFilters, SortOption, FilterState } from '../../src/components/dashboard/DashboardFilters';

import { getATSScoreRecommendation } from '../../src/utils/scoreColors';
import { UserHeader } from '../../src/components/layout/UserHeader';
import { scaleFont } from '../../src/utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = RNAnimated.createAnimatedComponent(Path);

const SVGArrow = () => {
    const drawAnim = React.useRef(new RNAnimated.Value(200)).current; 
    const drawArrowHead = React.useRef(new RNAnimated.Value(40)).current;

    useEffect(() => {
        RNAnimated.sequence([
            RNAnimated.delay(300),
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
        </Svg>
    );
};

export default function Dashboard() {
    const router = useRouter();
    const theme = useTheme();
    const { setCurrentAnalysis } = useResumeStore();
    const { userProfile } = useProfileStore();
    const { activeTasks } = useTaskQueue();
    // Using require for taskService to avoid circular dependency issues if any
    const { taskService } = require('../../src/services/firebase/taskService');

    const handleCancelTask = async (task: any) => {
        const isFailed = task.status === 'failed';
        Alert.alert(
            isFailed ? "Delete Task?" : "Cancel Analysis?",
            isFailed
                ? "Remove this failed task from your list?"
                : "⚠️ Tokens have already been deducted for this task. Cancelling now will stop the process, but tokens will NOT be refunded. You will need to use new tokens to restart. Are you sure?",
            [
                { text: "No", style: "cancel" },
                {
                    text: isFailed ? "Yes, Remove" : "Yes, Delete",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await taskService.deleteTask(task.id);
                        } catch (error: any) {
                            console.error("Failed to delete/cancel task", error);
                            Alert.alert("Error", `Could not remove task: ${error.message}`);
                        }
                    }
                }
            ]
        );
    };

    const [history, setHistory] = useState<SavedAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isAnalysesExpanded, setIsAnalysesExpanded] = useState(true);

    const pulseAnim = React.useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
                RNAnimated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: false })
            ])
        ).start();
    }, []);

    // Filter & Sort State
    const [sortOption, setSortOption] = useState<SortOption>('recent');
    const [filters, setFilters] = useState<FilterState>({
        companies: [],
        positions: [],
        dateRange: 'all',
        scoreRanges: []
    });

    // Real-time Subscription (replace loadHistory)
    useEffect(() => {
        setLoading(true);
        if (!userProfile?.uid) {
            setLoading(false);
            return;
        }
        console.log("Subscribing to history for user:", userProfile.uid);

        const unsubscribe = historyService.subscribeToUserHistory((data) => {
            setHistory(data);
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsubscribe();
    }, [userProfile?.uid]);

    const navigation = useNavigation();

    // Manual refresh still useful for network retry, but primarily reliant on subscription
    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        setLoading(true);
        // Force re-fetch via subscription simply by acknowledging we are alive
        // Real-time listener usually handles it, but this gives visual feedback
        setTimeout(() => {
            setRefreshing(false);
            setLoading(false);
        }, 1000);
    }, []);

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => <UserHeader />,
        });
    }, [navigation]);

    // Filter Logic
    const filteredHistory = useMemo(() => {
        let result = [...history];

        // 1. Filter by Company
        if (filters.companies.length > 0) {
            result = result.filter(item => filters.companies.includes(item.company));
        }

        // 2. Filter by Position
        if (filters.positions.length > 0) {
            result = result.filter(item => filters.positions.includes(item.jobTitle));
        }

        // 3. Filter by Date
        const now = new Date();
        if (filters.dateRange !== 'all') {
            const daysToSubtract =
                filters.dateRange === '7days' ? 7 :
                    filters.dateRange === '30days' ? 30 : 90;
            const cutoff = new Date();
            cutoff.setDate(now.getDate() - daysToSubtract);

            result = result.filter(item => {
                const date = item.updatedAt || item.createdAt;
                return date >= cutoff;
            });
        }

        // 4. Filter by Score
        if (filters.scoreRanges.length > 0) {
            result = result.filter(item => {
                const score = item.draftAtsScore ?? item.atsScore;
                return filters.scoreRanges.some(range => {
                    const [min, max] = range.split('-').map(Number);
                    return score >= min && score <= max;
                });
            });
        }

        // 5. Sort
        result.sort((a, b) => {
            const dateA = (a.updatedAt || a.createdAt).getTime();
            const dateB = (b.updatedAt || b.createdAt).getTime();
            const scoreA = a.draftAtsScore ?? a.atsScore;
            const scoreB = b.draftAtsScore ?? b.atsScore;

            switch (sortOption) {
                case 'recent': return dateB - dateA;
                case 'oldest': return dateA - dateB;
                case 'score_desc': return scoreB - scoreA;
                case 'score_asc': return scoreA - scoreB;
                case 'company_asc': return a.company.localeCompare(b.company);
                case 'company_desc': return b.company.localeCompare(a.company);
                case 'position_asc': return a.jobTitle.localeCompare(b.jobTitle);
                case 'position_desc': return b.jobTitle.localeCompare(a.jobTitle);
                default: return 0;
            }
        });

        return result;
    }, [history, filters, sortOption]);

    const [showTutorial, setShowTutorial] = useState<'pending' | 'draft' | 'optimized' | 'none'>('none');
    const [targetLayout, setTargetLayout] = useState<{x: number, y: number, width: number, height: number}>({ x: 0, y: 0, width: 0, height: 0 });
    const overlayOpacity = React.useRef(new RNAnimated.Value(0)).current;

    // Evaluate Tutorial priorities
    useFocusEffect(
        React.useCallback(() => {
            let isActive = true;

            const evaluateTutorials = async () => {
                if (filteredHistory.length === 0) return;

                const hasSeenPending = await AsyncStorage.getItem('hasSeenOptimizePending') === 'true';
                const hasSeenDraft = await AsyncStorage.getItem('hasSeenOptimizeDraft') === 'true';
                const hasSeenOptimized = await AsyncStorage.getItem('hasSeenOptimizeOptimized') === 'true';

                let targetState: 'pending' | 'draft' | 'optimized' | 'none' = 'none';

                // Look for targets in precedence array
                const hasPending = filteredHistory.some(h => 
                    !h.optimizedResumeData && !h.draftOptimizedResumeData && !(h.applicationStatus && h.applicationStatus !== 'not_applied')
                    && !activeTasks.find(t => t.payload.currentAnalysis?.id === h.id && t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'failed')
                );
                const hasDraft = filteredHistory.some(h => !!h.draftOptimizedResumeData);
                const hasOptimized = filteredHistory.some(h => !!h.optimizedResumeData);

                if (hasPending && !hasSeenPending) {
                    targetState = 'pending';
                } else if (hasDraft && !hasSeenDraft) {
                    targetState = 'draft';
                } else if (hasOptimized && !hasSeenOptimized) {
                    targetState = 'optimized';
                }

                if (isActive && targetState !== 'none') {
                    // Small delay to let FlatList render and capture onLayout
                    setTimeout(() => {
                        if (isActive) {
                            setShowTutorial(targetState);
                            RNAnimated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
                        }
                    }, 500);
                } else if (isActive) {
                    setShowTutorial('none');
                }
            };

            const timer = setTimeout(evaluateTutorials, 300);

            return () => {
                isActive = false;
                clearTimeout(timer);
                setShowTutorial('none');
            };
        }, [filteredHistory, activeTasks])
    );

    const handleDismissTutorial = async () => {
        if (showTutorial === 'pending') await AsyncStorage.setItem('hasSeenOptimizePending', 'true');
        if (showTutorial === 'draft') await AsyncStorage.setItem('hasSeenOptimizeDraft', 'true');
        if (showTutorial === 'optimized') await AsyncStorage.setItem('hasSeenOptimizeOptimized', 'true');
        
        setShowTutorial('none');
    };

    const handleOpenAnalysis = (item: SavedAnalysis) => {
        // ... (existing implementation)
        setCurrentAnalysis({
            ...item.analysisData,
            id: item.id,
            job: item.jobData,
            resume: item.resumeData || {} as any,
            optimizedResume: item.optimizedResumeData,
            changes: item.changesData
        });

        router.push({ pathname: '/analysis-result', params: { id: item.id } } as any);
    };

    // ... (helper functions getScoreColor, formatDate, handleDelete remain the same)

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const handleDelete = (item: SavedAnalysis) => {
        Alert.alert(
            "Delete Analysis",
            "Are you sure you want to delete this analysis?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            const success = await historyService.deleteAnalysis(item.id);
                            if (success) {
                                setHistory(prev => prev.filter(h => h.id !== item.id));
                            } else {
                                Alert.alert("Error", "Failed to delete analysis.");
                            }
                        } catch (error) {
                            console.error(error);
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, Platform.OS === 'android' && { marginBottom: 8, marginTop: 4 }]}>
                <Text
                    style={{ fontSize: 14, fontWeight: 'normal', marginBottom: 8, color: theme.colors.onSurface }}
                >
                    Your career optimization history
                </Text>
            </View>

            {/* Dashboard Filters & Sort */}
            <DashboardFilters
                fullHistory={history}
                currentSort={sortOption}
                onSortChange={setSortOption}
                onFilterChange={setFilters}
            />

            {/* Active Tasks Section */}
            {activeTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length > 0 && (
                <View style={{ marginBottom: Platform.OS === 'android' ? 12 : 24 }}>
                    <Text
                        variant={Platform.OS === 'android' ? "labelLarge" : "titleMedium"}
                        style={[styles.sectionTitle, Platform.OS === 'android' && { marginTop: 8, marginBottom: 8 }]}
                    >
                        In Progress
                    </Text>
                    {activeTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').map(task => (
                        <Card
                            key={task.id}
                            style={{
                                marginBottom: Platform.OS === 'android' ? 8 : 12,
                                backgroundColor: theme.dark ? theme.colors.elevation.level2 : '#E3F2FD',
                                borderColor: theme.dark ? theme.colors.primary : 'transparent',
                                borderWidth: theme.dark ? 1 : 0
                            }}
                        >
                            <Card.Content style={Platform.OS === 'android' && { paddingVertical: 8, paddingHorizontal: 12 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            variant={Platform.OS === 'android' ? "labelMedium" : "titleSmall"}
                                            style={{ fontWeight: 'bold', color: theme.dark ? theme.colors.primary : 'black' }}
                                        >
                                            {task.type === 'analyze_resume' ? '🔍 Analyzing Resume...' :
                                                task.type === 'add_skill' ? `➕ Adding Skill: ${task.payload?.skill || 'Skill'}` :
                                                task.type === 'optimize_resume' ? '✨ Optimizing Resume...' : 'Processing...'}
                                        </Text>
                                        {task.payload?.currentAnalysis?.job?.title && (
                                            <Text
                                                variant="bodySmall"
                                                style={{
                                                    fontSize: Platform.OS === 'android' ? 10 : 12,
                                                    color: theme.dark ? theme.colors.onSurfaceVariant : '#666',
                                                    marginBottom: 2,
                                                }}
                                                numberOfLines={1}
                                            >
                                                For: {task.payload.currentAnalysis.job.title} at {task.payload.currentAnalysis.job.company}
                                            </Text>
                                        )}
                                        <Text
                                            variant="bodySmall"
                                            style={{
                                                marginBottom: Platform.OS === 'android' ? 4 : 8,
                                                fontSize: Platform.OS === 'android' ? 10 : undefined,
                                                color: theme.dark ? theme.colors.onSurfaceVariant : undefined
                                            }}
                                        >
                                            {task.stage}
                                        </Text>
                                    </View>
                                    <IconButton
                                        icon="close-circle-outline"
                                        iconColor={theme.colors.error}
                                        onPress={() => handleCancelTask(task)}
                                        size={Platform.OS === 'android' ? 18 : 24}
                                        style={Platform.OS === 'android' && { margin: 0 }}
                                    />
                                </View>
                                <ProgressBar
                                    progress={task.progress / 100}
                                    color={theme.colors.primary}
                                    style={Platform.OS === 'android' && { height: 2 }}
                                />
                                {task.status === 'failed' && (
                                    <Text style={{ color: 'red', marginTop: 4, fontSize: Platform.OS === 'android' ? 10 : undefined }}>
                                        Failed: {task.error}
                                    </Text>
                                )}
                            </Card.Content>
                        </Card>
                    ))}
                </View>
            )}

            {/* Recent Analyses Header with Toggle */}
            <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: Platform.OS === 'android' ? 8 : 24,
                marginBottom: Platform.OS === 'android' ? 8 : 12
            }}>
                <Text
                    variant={Platform.OS === 'android' ? "labelLarge" : "titleMedium"}
                    style={{ fontWeight: '600' }}
                >
                    Recent Analyses ({filteredHistory.length})
                </Text>
                <IconButton
                    icon={isAnalysesExpanded ? "chevron-up" : "chevron-down"}
                    size={Platform.OS === 'android' ? 20 : 24}
                    onPress={() => setIsAnalysesExpanded(!isAnalysesExpanded)}
                    style={{ margin: 0 }}
                />
            </View>

            {isAnalysesExpanded && (
                <FlatList
                    data={filteredHistory}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                    ListEmptyComponent={
                        !loading ? (
                            <View style={styles.emptyState}>
                                <IconButton icon="clipboard-text-search-outline" size={60} />
                                <Text>No analyses found {history.length > 0 ? "matching filters" : "yet"}.</Text>
                                <Button
                                    mode="contained"
                                    onPress={() => router.push('/(tabs)/analyze')}
                                    style={{ marginTop: 16 }}
                                >
                                    Start New Analysis
                                </Button>
                            </View>
                        ) : null
                    }
                    renderItem={({ item }) => {
                        // Use draft score if available
                        const score = item.draftAtsScore ?? item.atsScore;
                        const isDraft = !!item.draftOptimizedResumeData;
                        // Only show "Updating..." if there's an active task that's NOT completed/cancelled
                        const isPending = !!activeTasks.find(t =>
                            t.payload.currentAnalysis?.id === item.id &&
                            t.status !== 'completed' &&
                            t.status !== 'cancelled' &&
                            t.status !== 'failed'
                        );

                        const rec = getATSScoreRecommendation(score);

                        const isNeedsUpdate = !isPending && !isDraft && !(item.applicationStatus && item.applicationStatus !== 'not_applied') && !item.optimizedResumeData;

                        return (
                            <RNAnimated.View 
                                onLayout={(e) => {
                                    if (
                                        (showTutorial === 'pending' && isNeedsUpdate) ||
                                        (showTutorial === 'draft' && isDraft) ||
                                        (showTutorial === 'optimized' && !isNeedsUpdate && !isDraft)
                                    ) {
                                        // Update layout track only if it hits the target state
                                        const l = e.nativeEvent.layout;
                                        setTargetLayout({ x: l.x, y: l.y, width: l.width, height: l.height });
                                    }
                                }}
                                style={{
                                marginBottom: 12,
                                ...(isNeedsUpdate ? {
                                    borderRadius: 12,
                                    borderWidth: 2,
                                    borderColor: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', '#7C3AED'] }),
                                    shadowColor: '#7C3AED',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }),
                                    shadowRadius: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
                                } : {})
                            }}>
                                <Card
                                    style={[styles.card, { marginBottom: 0, ...(isNeedsUpdate ? { backgroundColor: theme.dark ? '#1E1830' : '#F3E8FF', borderColor: 'transparent' } : {}) }]}
                                    onPress={() => handleOpenAnalysis(item)}
                                    mode="outlined"
                                >
                                    <Card.Content style={Platform.OS === 'android' && { paddingVertical: 8, paddingHorizontal: 12 }}>
                                        <View style={styles.cardHeader}>
                                            <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text
                                                variant={Platform.OS === 'android' ? "titleSmall" : "titleMedium"}
                                                numberOfLines={1}
                                            >
                                                {item.jobTitle}
                                            </Text>
                                            <Text
                                                variant="bodySmall"
                                                numberOfLines={1}
                                                style={Platform.OS === 'android' && { fontSize: 11 }}
                                            >
                                                {item.company}
                                            </Text>

                                            {/* Simplified Recommendation on Dashboard */}
                                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: Platform.OS === 'android' ? 4 : 8, flex: 1 }}>
                                                <IconButton
                                                    icon={rec.icon}
                                                    size={Platform.OS === 'android' ? 12 : 16}
                                                    iconColor={rec.color}
                                                    style={{ margin: 0, padding: 0, width: Platform.OS === 'android' ? 16 : 20, height: Platform.OS === 'android' ? 16 : 20, marginTop: 1 }}
                                                />
                                                <View style={{ flex: 1, flexShrink: 1 }}>
                                                    <Text
                                                        variant="labelSmall"
                                                        style={{
                                                            color: rec.color,
                                                            fontWeight: 'bold',
                                                            fontSize: Platform.OS === 'web' ? 11 : scaleFont(Platform.OS === 'android' ? 10 : 11),
                                                            flexWrap: 'wrap'
                                                        }}
                                                    >
                                                        {rec.message}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text
                                                variant={Platform.OS === 'android' ? "titleLarge" : "displaySmall"}
                                                style={{
                                                    fontSize: Platform.OS === 'android' ? 20 : 24,
                                                    color: rec.color,
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {score}
                                            </Text>
                                            <Text variant="labelSmall" style={Platform.OS === 'android' && { fontSize: 9 }}>ATS Score</Text>
                                        </View>
                                    </View>

                                    <View style={[styles.metaRow, Platform.OS === 'android' && { marginTop: 4, gap: 8 }]}>
                                        <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: Platform.OS === 'android' ? 2 : 4, flex: 1 }}>
                                            {isPending ? (
                                                <Chip
                                                    icon="progress-clock"
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#1565C0' : '#E3F2FD' }}
                                                    textStyle={{ color: theme.dark ? '#E3F2FD' : 'black', fontSize: Platform.OS === 'android' ? 9 : undefined }}
                                                >
                                                    Updating...
                                                </Chip>
                                            ) : isDraft ? (
                                                <Chip
                                                    icon="file-document-edit-outline"
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#EF6C00' : '#FFF3E0' }}
                                                    textStyle={{ color: theme.dark ? '#FFF3E0' : 'black', fontSize: Platform.OS === 'android' ? 9 : undefined }}
                                                >
                                                    Draft Ready
                                                </Chip>
                                            ) : item.applicationStatus && item.applicationStatus !== 'not_applied' ? (
                                                <Chip
                                                    icon={item.isLocked ? "lock" : "briefcase-check"}
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#0277BD' : '#E3F2FD' }}
                                                    textStyle={{ color: theme.dark ? '#E1F5FE' : '#1565C0', fontWeight: 'bold', fontSize: Platform.OS === 'android' ? 9 : undefined }}
                                                >
                                                    {item.applicationStatus.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                                </Chip>
                                            ) : item.optimizedResumeData ? (
                                                <Chip
                                                    icon="check-all"
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#2E7D32' : '#E8F5E9' }}
                                                    textStyle={{ color: theme.dark ? '#E8F5E9' : '#2E7D32', fontSize: Platform.OS === 'android' ? 9 : undefined }}
                                                >
                                                    Optimized
                                                </Chip>
                                            ) : (
                                                <Chip
                                                    icon="clock-outline"
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#d84315' : '#FFF3E0' }} // Deep Orange for dark
                                                    textStyle={{ color: theme.dark ? '#FFF3E0' : '#EF6C00', fontSize: Platform.OS === 'android' ? 9 : undefined }}
                                                >
                                                    Pending Resume Update
                                                </Chip>
                                            )}
                                            <Text
                                                variant="bodySmall"
                                                style={[styles.date, Platform.OS === 'android' && { fontSize: 10 }]}
                                            >
                                                {formatDate(item.updatedAt || item.createdAt)}
                                            </Text>
                                        </View>
                                        <IconButton
                                            icon="trash-can-outline"
                                            size={Platform.OS === 'android' ? 16 : 20}
                                            onPress={() => handleDelete(item)}
                                            style={{ margin: 0 }}
                                        />
                                    </View>
                                </Card.Content>
                            </Card>
                        </RNAnimated.View>
                        );
                    }}
                />
            )}

            <FAB
                icon="plus"
                label="New Analysis"
                style={styles.fab}
                onPress={() => router.push('/(tabs)/analyze')}
            />

            {isDeleting && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
                    <ActivityIndicator animating={true} size="large" color={"white"} />
                    <Text style={{ marginTop: 16, color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Delete in progress...</Text>
                </View>
            )}

            {/* Dynamic Tutorials Overlay */}
            {showTutorial !== 'none' && targetLayout.y >= 0 && (
                <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? "rgba(8,6,18,0.85)" : "rgba(255,255,255,0.85)", zIndex: 100, opacity: overlayOpacity }]} pointerEvents="auto">
                    {/* SVG Arrow */}
                    <View style={{ position: 'absolute', top: targetLayout.y + 160, left: targetLayout.x + (targetLayout.width / 2) - 10 }}>
                        <SVGArrow />
                    </View>

                    {/* Popover */}
                    <View style={{ position: 'absolute', top: targetLayout.y ? Math.max(40, targetLayout.y - 10) : 100, left: 20, right: 20, backgroundColor: theme.dark ? '#1E1830' : '#fff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.5)", shadowColor: "#7C3AED", shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 }}>
                        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 50, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#A78BFA", marginRight: 8 }} />
                            <Text style={{ color: "#A78BFA", fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>ACTION REQUIRED</Text>
                        </View>
                        <Text style={{ color: theme.dark ? "#F5F3FF" : "#111", fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                            {showTutorial === 'pending' ? 'Pending Update' : showTutorial === 'draft' ? 'Draft Ready' : 'Optimized Resume'}
                        </Text>
                        <Text style={{ color: theme.dark ? "#9CA3AF" : "#555", fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
                            {showTutorial === 'pending' ? "Click on the pending optimization to rewrite and optimize your resume as warranted by the job description." 
                            : showTutorial === 'draft' ? "Click on the draft ready card to finalize the updated resume."
                            : "Click on the optimized resume to add partial or missing skills to further improve your resume and align better with the job description."}
                        </Text>
                        
                        <TouchableOpacity style={{ backgroundColor: "#7C3AED", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50, alignSelf: 'flex-start' }} onPress={handleDismissTutorial}>
                            <Text style={{ color: "white", fontSize: 14, fontWeight: '600' }}>Got it →</Text>
                        </TouchableOpacity>
                    </View>
                </RNAnimated.View>
            )}

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    header: {
        marginBottom: 24,
        marginTop: 8,
    },
    title: {
        fontWeight: 'bold',
    },
    subtitle: {
        marginTop: 4,
        opacity: 0.7,
    },
    sectionTitle: {
        marginTop: 24,
        marginBottom: 12,
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 80,
    },
    card: {
        marginBottom: 12,
        // backgroundColor: 'white', // REMOVED: Let theme handle it
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 12,
    },
    date: {
        opacity: 0.5,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
        opacity: 0.6,
    }
});
