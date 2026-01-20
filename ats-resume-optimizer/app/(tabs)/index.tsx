import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Button, Card, Chip, FAB, useTheme, IconButton, ProgressBar } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { historyService } from '../../src/services/firebase/historyService';
import { SavedAnalysis } from '../../src/types/history.types';
import { useResumeStore } from '../../src/store/resumeStore';
import { useTaskQueue } from '../../src/context/TaskQueueContext';

export default function Dashboard() {
    const router = useRouter();
    const theme = useTheme();
    const { setCurrentAnalysis } = useResumeStore();
    const { activeTasks } = useTaskQueue(); // Get active tasks from context
    const { taskService } = require('../../src/services/firebase/taskService');

    const handleCancelTask = async (taskId: string) => {
        try {
            await taskService.failTask(taskId, "Cancelled by user");
        } catch (error) {
            console.error("Failed to cancel task", error);
        }
    };

    const [history, setHistory] = useState<SavedAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadHistory = useCallback(async () => {
        try {
            const data = await historyService.getUserHistory();
            setHistory(data);
        } catch (error) {
            console.error('Failed to load history', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [loadHistory])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadHistory();
    };

    const handleOpenAnalysis = (item: SavedAnalysis) => {
        // Rehydrate the store with the saved analysis
        setCurrentAnalysis({
            ...item.analysisData,
            id: item.id, // Important: Keep ID so future saves are updates
            job: item.jobData,
            resume: item.resumeData || {} as any, // Should be there for new saves
            optimizedResume: item.optimizedResumeData,
            changes: item.changesData
        });

        // Navigate based on the result type
        if (item.action === 'optimize') {
            router.push('/analysis-result');
        } else {
            router.push('/upskilling-path');
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 85) return theme.colors.primary;
        if (score >= 70) return '#F57C00'; // Orange
        return theme.colors.error;
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
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

            <Text variant="titleMedium" style={styles.sectionTitle}>Recent Analyses</Text>

            <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
                ListEmptyComponent={
                    // ... (unchanged)
                    !loading ? (
                        <View style={styles.emptyState}>
                            <IconButton icon="clipboard-text-search-outline" size={60} />
                            <Text>No analyses found yet.</Text>
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
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text
                                            variant="displaySmall"
                                            style={{ fontSize: 24, color: getScoreColor(item.atsScore), fontWeight: 'bold' }} // Keep original color logic or use new score's color
                                        >
                                            {score}
                                        </Text>
                                        <Text variant="labelSmall">ATS Score</Text>
                                    </View>
                                </View>

                                <View style={styles.metaRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
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
                                        <Text variant="bodySmall" style={styles.date}>{formatDate(item.createdAt)}</Text>
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
