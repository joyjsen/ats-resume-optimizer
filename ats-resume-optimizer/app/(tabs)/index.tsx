import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Button, Card, Chip, FAB, useTheme, IconButton, ProgressBar } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { historyService } from '../../src/services/firebase/historyService';
import { SavedAnalysis } from '../../src/types/history.types';
import { useResumeStore } from '../../src/store/resumeStore';
import { useTaskQueue } from '../../src/context/TaskQueueContext';
import { DashboardFilters, SortOption, FilterState } from '../../src/components/dashboard/DashboardFilters';

export default function Dashboard() {
    const router = useRouter();
    const theme = useTheme();
    const { setCurrentAnalysis } = useResumeStore();
    const { activeTasks } = useTaskQueue();
    const { taskService } = require('../../src/services/firebase/taskService');

    const handleCancelTask = async (taskId: string) => {
        Alert.alert(
            "Cancel Analysis?",
            "This ongoing analysis will be deleted and is not recoverable. Are you sure you want to proceed?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes, Delete",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await taskService.failTask(taskId, "Cancelled by user");
                        } catch (error) {
                            console.error("Failed to cancel task", error);
                            Alert.alert("Error", "Could not cancel task.");
                        }
                    }
                }
            ]
        );
    };

    const [history, setHistory] = useState<SavedAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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
        const unsubscribe = historyService.subscribeToUserHistory((data) => {
            setHistory(data);
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsubscribe();
    }, []);

    // Manual refresh still useful for network retry, but primarily reliant on subscription
    const handleRefresh = () => {
        setRefreshing(true);
        // Subscription will push update if connection restores, or we can force fetch
        // For simplicity, just reset loading state after a timeout if relying on sub, 
        // OR re-trigger subscription if implemented that way.
        // Since subscription is persistent, we mainly just show a spinner briefly.
        setTimeout(() => setRefreshing(false), 1000);
    };

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
    const getScoreColor = (score: number) => {
        if (score >= 85) return theme.colors.primary;
        if (score >= 70) return '#F57C00';
        return theme.colors.error;
    };

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
        <View style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>Dashboard</Text>
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
            {activeTasks.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>In Progress</Text>
                    {activeTasks.map(task => (
                        <Card key={task.id} style={{ marginBottom: 12, backgroundColor: '#E3F2FD' }}>
                            <Card.Content>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                                            {task.type === 'analyze_resume' ? 'Analyzing Resume...' :
                                                task.type === 'add_skill' ? 'Adding Skill...' : 'Optimizing...'}
                                        </Text>
                                        <Text variant="bodySmall" style={{ marginBottom: 8 }}>{task.stage}</Text>
                                    </View>
                                    <IconButton icon="close-circle-outline" iconColor={theme.colors.error} onPress={() => handleCancelTask(task.id)} />
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

            <Text variant="titleMedium" style={styles.sectionTitle}>
                Recent Analyses ({filteredHistory.length})
            </Text>

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
                    const isPending = !!activeTasks.find(t => t.payload.currentAnalysis?.id === item.id);

                    const getRec = (s: number) => {
                        if (s > 75) return { c: '#4CAF50', m: "Strongly encouraged", i: "check-circle" };
                        if (s > 50) return { c: '#FF9800', m: "Encouraged (needs upgrade)", i: "alert" };
                        return { c: '#F44336', m: "Brush up skills", i: "book-open-variant" };
                    };
                    const rec = getRec(score);

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
                                            <IconButton icon={rec.i} size={16} iconColor={rec.c} style={{ margin: 0, padding: 0, width: 20, height: 20 }} />
                                            <Text variant="labelSmall" style={{ color: rec.c, fontWeight: 'bold' }}>
                                                {rec.m}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text
                                            variant="displaySmall"
                                            style={{ fontSize: 24, color: rec.c, fontWeight: 'bold' }}
                                        >
                                            {score}
                                        </Text>
                                        <Text variant="labelSmall">ATS Score</Text>
                                    </View>
                                </View>

                                <View style={styles.metaRow}>
                                    <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, flex: 1 }}>
                                        {isPending ? (
                                            <Chip icon="progress-clock" compact mode="flat" style={{ backgroundColor: '#E3F2FD' }}>
                                                Updating...
                                            </Chip>
                                        ) : isDraft ? (
                                            <Chip icon="file-document-edit-outline" compact mode="flat" style={{ backgroundColor: '#FFF3E0' }}>
                                                Draft Ready
                                            </Chip>
                                        ) : item.optimizedResumeData ? (
                                            <Chip
                                                icon="check-all"
                                                compact
                                                mode="flat"
                                                style={{ backgroundColor: '#E8F5E9' }}
                                                textStyle={{ color: '#2E7D32' }}
                                            >
                                                Optimized
                                            </Chip>
                                        ) : (
                                            <Chip
                                                icon="clock-outline"
                                                compact
                                                mode="flat"
                                                style={{ backgroundColor: '#FFF3E0' }}
                                                textStyle={{ color: '#EF6C00' }}
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
        backgroundColor: 'white',
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
