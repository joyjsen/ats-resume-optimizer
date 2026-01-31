
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Button, Card, Chip, FAB, useTheme, IconButton, ProgressBar } from 'react-native-paper';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { historyService } from '../../src/services/firebase/historyService';
import { SavedAnalysis } from '../../src/types/history.types';
import { useResumeStore } from '../../src/store/resumeStore';
import { useTaskQueue } from '../../src/context/TaskQueueContext';
import { DashboardFilters, SortOption, FilterState } from '../../src/components/dashboard/DashboardFilters';
import { auth } from '../../src/services/firebase/config';
import { getATSScoreRecommendation } from '../../src/utils/scoreColors';
import { UserHeader } from '../../src/components/layout/UserHeader';

export default function Dashboard() {
    const router = useRouter();
    const theme = useTheme();
    const { setCurrentAnalysis } = useResumeStore();
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
    const [refreshing, setRefreshing] = useState(false);
    const [isAnalysesExpanded, setIsAnalysesExpanded] = useState(true);

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
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }
        console.log("Subscribing to history for user:", user.uid);

        const unsubscribe = historyService.subscribeToUserHistory((data) => {
            setHistory(data);
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsubscribe();
    }, [auth.currentUser?.uid]);

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
            headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconButton
                        icon="reload"
                        onPress={() => {
                            // Trigger refresh to reload data from Firestore
                            handleRefresh();
                        }}
                    />
                    <UserHeader />
                </View>
            ),
        });
    }, [navigation, handleRefresh]);

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

        if (item.action === 'optimize') {
            router.push('/analysis-result');
        } else {
            router.push('/upskilling-path');
        }
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
                        try {
                            const success = await historyService.deleteAnalysis(item.id);
                            if (success) {
                                setHistory(prev => prev.filter(h => h.id !== item.id));
                            } else {
                                Alert.alert("Error", "Failed to delete analysis.");
                            }
                        } catch (error) {
                            console.error(error);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>Optimize</Text>
                <Text variant="bodyLarge" style={styles.subtitle}>Your career optimization history</Text>
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
                <View style={{ marginBottom: 24 }}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>In Progress</Text>
                    {activeTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').map(task => (
                        <Card key={task.id} style={{ marginBottom: 12, backgroundColor: theme.dark ? theme.colors.elevation.level2 : '#E3F2FD', borderColor: theme.dark ? theme.colors.primary : 'transparent', borderWidth: theme.dark ? 1 : 0 }}>
                            <Card.Content>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="titleSmall" style={{ fontWeight: 'bold', color: theme.dark ? theme.colors.primary : 'black' }}>
                                            {task.type === 'analyze_resume' ? 'Analyzing Resume...' :
                                                task.type === 'add_skill' ? 'Adding Skill...' : 'Optimizing...'}
                                        </Text>
                                        <Text variant="bodySmall" style={{ marginBottom: 8, color: theme.dark ? theme.colors.onSurfaceVariant : undefined }}>{task.stage}</Text>
                                    </View>
                                    <IconButton icon="close-circle-outline" iconColor={theme.colors.error} onPress={() => handleCancelTask(task)} />
                                </View>
                                <ProgressBar progress={task.progress / 100} color={theme.colors.primary} />
                                {task.status === 'failed' && (
                                    <Text style={{ color: 'red', marginTop: 4 }}>Failed: {task.error}</Text>
                                )}
                            </Card.Content>
                        </Card>
                    ))}
                </View>
            )}

            {/* Recent Analyses Header with Toggle */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
                <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                    Recent Analyses ({filteredHistory.length})
                </Text>
                <IconButton
                    icon={isAnalysesExpanded ? "chevron-up" : "chevron-down"}
                    size={24}
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

                        return (
                            <Card
                                style={styles.card}
                                onPress={() => handleOpenAnalysis(item)}
                                mode="outlined"
                            >
                                <Card.Content>
                                    <View style={styles.cardHeader}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text variant="titleMedium" numberOfLines={1}>{item.jobTitle}</Text>
                                            <Text variant="bodyMedium" numberOfLines={1}>{item.company}</Text>

                                            {/* Simplified Recommendation on Dashboard */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                                <IconButton icon={rec.icon} size={16} iconColor={rec.color} style={{ margin: 0, padding: 0, width: 20, height: 20 }} />
                                                <Text variant="labelSmall" style={{ color: rec.color, fontWeight: 'bold' }}>
                                                    {rec.message}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text
                                                variant="displaySmall"
                                                style={{ fontSize: 24, color: rec.color, fontWeight: 'bold' }}
                                            >
                                                {score}
                                            </Text>
                                            <Text variant="labelSmall">ATS Score</Text>
                                        </View>
                                    </View>

                                    <View style={styles.metaRow}>
                                        <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, flex: 1 }}>
                                            {isPending ? (
                                                <Chip
                                                    icon="progress-clock"
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#1565C0' : '#E3F2FD' }}
                                                    textStyle={{ color: theme.dark ? '#E3F2FD' : 'black' }}
                                                >
                                                    Updating...
                                                </Chip>
                                            ) : isDraft ? (
                                                <Chip
                                                    icon="file-document-edit-outline"
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#EF6C00' : '#FFF3E0' }}
                                                    textStyle={{ color: theme.dark ? '#FFF3E0' : 'black' }}
                                                >
                                                    Draft Ready
                                                </Chip>
                                            ) : item.applicationStatus && item.applicationStatus !== 'not_applied' ? (
                                                <Chip
                                                    icon={item.isLocked ? "lock" : "briefcase-check"}
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#0277BD' : '#E3F2FD' }}
                                                    textStyle={{ color: theme.dark ? '#E1F5FE' : '#1565C0', fontWeight: 'bold' }}
                                                >
                                                    {item.applicationStatus.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                                </Chip>
                                            ) : item.optimizedResumeData ? (
                                                <Chip
                                                    icon="check-all"
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#2E7D32' : '#E8F5E9' }}
                                                    textStyle={{ color: theme.dark ? '#E8F5E9' : '#2E7D32' }}
                                                >
                                                    Optimized
                                                </Chip>
                                            ) : (
                                                <Chip
                                                    icon="clock-outline"
                                                    compact
                                                    mode="flat"
                                                    style={{ backgroundColor: theme.dark ? '#d84315' : '#FFF3E0' }} // Deep Orange for dark
                                                    textStyle={{ color: theme.dark ? '#FFF3E0' : '#EF6C00' }}
                                                >
                                                    Pending Resume Update
                                                </Chip>
                                            )}
                                            <Text variant="bodySmall" style={styles.date}>
                                                {formatDate(item.updatedAt || item.createdAt)}
                                            </Text>
                                        </View>
                                        <IconButton
                                            icon="trash-can-outline"
                                            size={20}
                                            onPress={() => handleDelete(item)}
                                            style={{ margin: 0 }}
                                        />
                                    </View>
                                </Card.Content>
                            </Card>
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
