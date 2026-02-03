import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Chip, useTheme, ActivityIndicator, Button, IconButton } from 'react-native-paper';
import { learningService } from '../../src/services/firebase/learningService';
import { auth } from '../../src/services/firebase/config';
import { LearningEntry, LearningPath } from '../../src/types/learning.types';
import { TrainingSlideshow } from '../../src/components/learning/TrainingSlideshow';
import { LearningFilters, LearningFilterState, LearningSortOption } from '../../src/components/learning/LearningFilters';
import { taskService } from '../../src/services/firebase/taskService';
import { activityService } from '../../src/services/firebase/activityService';
import { notificationService } from '../../src/services/firebase/notificationService';
import { useNavigation } from 'expo-router'; // Add useNavigation
import { UserHeader } from '../../src/components/layout/UserHeader'; // Add UserHeader import
import { useTokenCheck } from '../../src/hooks/useTokenCheck';

export default function LearningScreen() {
    const theme = useTheme();
    const { user } = { user: auth.currentUser }; // Simple replacement for useAuth
    const { checkTokens } = useTokenCheck();
    const navigation = useNavigation();
    const [entries, setEntries] = useState<LearningEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'active' | 'completed' | 'archived'>('active');
    const [refreshTrigger, setRefreshTrigger] = useState(0); // For external refresh button

    // Filter & Sort State
    const [sortOption, setSortOption] = useState<LearningSortOption>('recent');
    const [filters, setFilters] = useState<LearningFilterState>({
        paths: [],
        companies: [],
        dateRange: 'all'
    });

    // Training Slideshow State
    const [selectedEntry, setSelectedEntry] = useState<LearningEntry | null>(null);
    const [showSlideshow, setShowSlideshow] = useState(false);
    const [isGenerating, setIsGenerating] = useState<string | null>(null); // Entry ID

    const handleRefresh = React.useCallback(() => {
        setLoading(true);
        setRefreshTrigger(prev => prev + 1);
    }, []);

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <UserHeader />
            ),
        });
    }, [navigation]);

    useEffect(() => {
        const userId = auth.currentUser?.uid || 'anonymous_user';

        const unsubscribe = learningService.subscribeToEntries(userId, (data) => {
            setEntries(data);
            setLoading(false);

            // Sync selected entry if it's currently open to get progress updates
            if (selectedEntry) {
                const updated = data.find(e => e.id === selectedEntry.id);
                if (updated) setSelectedEntry(updated);
            }
        });

        return () => unsubscribe();
    }, [selectedEntry?.id, refreshTrigger]); // Added refreshTrigger dependency

    const filteredEntries = React.useMemo(() => {
        let result = entries.filter(item => {
            const matchesViewMode = item.archived ? viewMode === 'archived' :
                viewMode === 'active' ? item.status !== 'completed' :
                    viewMode === 'completed' ? item.status === 'completed' : false;

            if (!matchesViewMode) return false;

            // Apply Advanced Filters
            if (filters.paths.length > 0 && !filters.paths.includes(item.path)) return false;
            if (filters.companies.length > 0 && !filters.companies.includes(item.companyName)) return false;

            if (filters.dateRange !== 'all') {
                const now = new Date();
                const days = filters.dateRange === '7days' ? 7 : 30;
                const cutoff = new Date(now.setDate(now.getDate() - days));
                if (new Date(item.createdAt) < cutoff) return false;
            }

            return true;
        });

        // Apply Sorting
        result.sort((a, b) => {
            switch (sortOption) {
                case 'recent':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'skill_asc':
                    return a.skillName.localeCompare(b.skillName);
                case 'skill_desc':
                    return b.skillName.localeCompare(a.skillName);
                case 'progress_desc': {
                    const progressA = (a.currentSlide || 0) / (a.totalSlides || 1);
                    const progressB = (b.currentSlide || 0) / (b.totalSlides || 1);
                    return progressB - progressA;
                }
                case 'company_asc':
                    return a.companyName.localeCompare(b.companyName);
                default:
                    return 0;
            }
        });

        return result;
    }, [entries, viewMode, filters, sortOption]);

    const handleArchive = async (id: string) => {
        try {
            await learningService.archiveEntry(id);
        } catch (error) {
            console.error("Failed to archive entry:", error);
        }
    };

    const handleRestore = async (id: string) => {
        try {
            await learningService.restoreEntry(id);
        } catch (error) {
            console.error("Failed to restore entry:", error);
        }
    };

    const handleReviewTraining = (item: LearningEntry) => {
        setSelectedEntry(item);
        setShowSlideshow(true);
    };

    const handleStartTraining = async (item: LearningEntry) => {
        if (item.slides && item.slides.length > 0) {
            setSelectedEntry(item);
            setShowSlideshow(true);
            return;
        }

        if (!checkTokens(30)) return; // Cost: 30 tokens

        setIsGenerating(item.id);
        try {
            const slides = await learningService.generateTrainingContent(
                item.id,
                item.skillName,
                item.jobTitle,
                item.companyName,
                item.userId
            );

            // Re-fetch or rely on subscription to update entries
            // For better UX, we can manually construct the item for the modal
            const updatedItem = { ...item, slides, currentSlide: 0, totalSlides: slides.length };
            setSelectedEntry(updatedItem);
            setShowSlideshow(true);
        } catch (error) {
            console.error("Training generation failed:", error);
            Alert.alert("Error", "Failed to generate training content. Please try again.");
        } finally {
            setIsGenerating(null);
        }
    };

    const handleSlideChange = async (index: number) => {
        if (!selectedEntry || selectedEntry.status === 'completed') return;
        try {
            await learningService.updateProgress(selectedEntry.id, index);
        } catch (error) {
            console.error("Failed to update progress:", error);
        }
    };

    const handleCompleteTraining = async (id: string) => {
        try {
            const entry = entries.find(e => e.id === id);

            await learningService.updateEntry(id, {
                status: 'completed',
                completionDate: new Date()
            });

            // Log activity for course completion
            try {
                if (entry) {
                    await activityService.logActivity({
                        type: 'learning_completion',
                        description: `Completed AI Training for "${entry.skillName}"`,
                        resourceId: entry.id,
                        resourceName: entry.skillName,
                        platform: 'ios'
                    });
                }
            } catch (activityError) {
                console.warn("Failed to log learning completion activity:", activityError);
            }

            setShowSlideshow(false);
            setSelectedEntry(null);
            setViewMode('completed');
        } catch (error) {
            console.error("Failed to complete training:", error);
        }
    };

    const renderEntry = ({ item }: { item: LearningEntry }) => {
        const hasSlides = item.slides && item.slides.length > 0;
        const currentIdx = item.currentSlide || 0;
        const total = item.totalSlides || 0;

        const isStarted = hasSlides && currentIdx > 0;
        const isFinished = hasSlides && currentIdx === total - 1 && total > 0;
        const isGeneratingThis = isGenerating === item.id;

        return (
            <Card style={styles.card}>
                <Card.Content>
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.skillName}</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                For: {item.jobTitle} at {item.companyName}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Chip
                                mode="flat"
                                style={{ backgroundColor: item.status === 'completed' ? theme.colors.primaryContainer : theme.colors.surfaceVariant, marginBottom: 4 }}
                                textStyle={{ color: item.status === 'completed' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant, fontSize: 10 }}
                            >
                                {item.status === 'completed' ? 'ACHIEVED' : 'LEARNING'}
                            </Chip>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                                {item.status === 'completed'
                                    ? `Achieved on ${item.completionDate?.toLocaleDateString()} via ${item.path === 'ai' ? 'AI-Assisted' : 'Self'} Learning`
                                    : `Started ${item.createdAt.toLocaleDateString()} via ${item.path === 'ai' ? 'AI-Assisted' : 'Self'} Learning`
                                }
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {viewMode === 'active' && (
                                <>
                                    {item.path === 'ai' && (
                                        <Button
                                            mode={isFinished ? "contained" : "outlined"}
                                            compact
                                            loading={isGeneratingThis}
                                            disabled={isGeneratingThis}
                                            onPress={() => isFinished ? handleCompleteTraining(item.id) : handleStartTraining(item)}
                                            style={{ marginRight: 8 }}
                                        >
                                            {isFinished ? "Complete" : (isStarted ? "Continue Learning" : "Start Training")}
                                        </Button>
                                    )}
                                    <IconButton
                                        icon="delete-outline"
                                        size={20}
                                        iconColor={theme.colors.error}
                                        onPress={() => handleArchive(item.id)}
                                    />
                                </>
                            )}

                            {viewMode === 'completed' && (
                                <>
                                    {item.path === 'ai' && hasSlides && (
                                        <Button
                                            mode="outlined"
                                            compact
                                            onPress={() => handleReviewTraining(item)}
                                            icon="book-open-variant"
                                            style={{ marginRight: 8 }}
                                        >
                                            Review
                                        </Button>
                                    )}
                                    <IconButton
                                        icon="delete-outline"
                                        size={20}
                                        iconColor={theme.colors.error}
                                        onPress={() => handleArchive(item.id)}
                                    />
                                </>
                            )}

                            {viewMode === 'archived' && (
                                <Button
                                    mode="outlined"
                                    compact
                                    onPress={() => handleRestore(item.id)}
                                    icon="restore"
                                >
                                    Restore
                                </Button>
                            )}
                        </View>
                    </View>
                </Card.Content>
            </Card>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // Helper to calculate counts based on current non-status filters
    const getTabCounts = () => {
        const filteredByCriteria = entries.filter(item => {
            // Apply Advanced Filters
            if (filters.paths.length > 0 && !filters.paths.includes(item.path)) return false;
            if (filters.companies.length > 0 && !filters.companies.includes(item.companyName)) return false;

            if (filters.dateRange !== 'all') {
                const now = new Date();
                const days = filters.dateRange === '7days' ? 7 : 30;
                const cutoff = new Date(now.setDate(now.getDate() - days));
                if (new Date(item.createdAt) < cutoff) return false;
            }
            return true;
        });

        return {
            active: filteredByCriteria.filter(e => !e.archived && e.status !== 'completed').length,
            completed: filteredByCriteria.filter(e => !e.archived && e.status === 'completed').length,
            archived: filteredByCriteria.filter(e => e.archived).length
        };
    };

    const tabCounts = getTabCounts();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.summaryHeader, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.outlineVariant }]}>
                <Text variant="headlineMedium" style={styles.title}>Learning Hub</Text>
                <Text variant="bodySmall">Track your skill acquisition and professional growth.</Text>

                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'active' && { borderBottomColor: theme.colors.primary }]}
                        onPress={() => setViewMode('active')}
                    >
                        <Text style={[styles.tabText, { color: viewMode === 'active' ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
                            Active ({tabCounts.active})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'completed' && { borderBottomColor: theme.colors.primary }]}
                        onPress={() => setViewMode('completed')}
                    >
                        <Text style={[styles.tabText, { color: viewMode === 'completed' ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
                            Completed ({tabCounts.completed})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'archived' && { borderBottomColor: theme.colors.primary }]}
                        onPress={() => setViewMode('archived')}
                    >
                        <Text style={[styles.tabText, { color: viewMode === 'archived' ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
                            Archived ({tabCounts.archived})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <LearningFilters
                entries={entries}
                onFilterChange={setFilters}
                currentSort={sortOption}
                onSortChange={setSortOption}
            />

            <FlatList
                data={filteredEntries}
                renderItem={renderEntry}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.centered}>
                        <Text variant="bodyLarge">
                            {viewMode === 'active' ? "No active skills." :
                                viewMode === 'completed' ? "No completed skills yet." :
                                    "No archived skills."}
                        </Text>
                        <Text variant="bodySmall">
                            {viewMode === 'active' ? "Skills you choose to learn will appear here." :
                                viewMode === 'completed' ? "Skills you master will be listed here for review." :
                                    "Tasks you've deleted will be stored here."}
                        </Text>
                    </View>
                }
            />

            {selectedEntry && (
                <TrainingSlideshow
                    visible={showSlideshow}
                    slides={selectedEntry.slides || []}
                    initialSlide={selectedEntry.currentSlide || 0}
                    onDismiss={() => {
                        setShowSlideshow(false);
                        setSelectedEntry(null);
                    }}
                    onSlideChange={handleSlideChange}
                    onComplete={() => handleCompleteTraining(selectedEntry.id)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor: '#f5f5f5', // Handled inline
    },
    summaryHeader: {
        padding: 24,
        paddingBottom: 12,
        // backgroundColor: '#fff', // Handled inline
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e030', // More subtle
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        marginTop: 20,
    },
    tab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 16,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        // borderBottomColor: '#6200ee', // Handled inline
    },
    tabText: {
        // color: '#757575', // Handled inline
        fontWeight: '500',
    },
    activeTabText: {
        // color: '#6200ee', // Handled inline
    },
    list: {
        padding: 16,
    },
    card: {
        marginBottom: 12,
        // backgroundColor: '#fff', // Handled inline
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f030', // More subtle
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        marginTop: 40,
    },
});
