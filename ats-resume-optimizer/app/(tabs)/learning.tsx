import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Chip, useTheme, ActivityIndicator, Button, IconButton } from 'react-native-paper';
import { learningService } from '../../src/services/firebase/learningService';
import { auth } from '../../src/services/firebase/config';
import { LearningEntry } from '../../src/types/learning.types';
import { TrainingSlideshow } from '../../src/components/learning/TrainingSlideshow';

export default function LearningScreen() {
    const theme = useTheme();
    const [entries, setEntries] = useState<LearningEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'active' | 'completed' | 'archived'>('active');

    // Training Slideshow State
    const [selectedEntry, setSelectedEntry] = useState<LearningEntry | null>(null);
    const [showSlideshow, setShowSlideshow] = useState(false);
    const [isGenerating, setIsGenerating] = useState<string | null>(null); // Entry ID

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
    }, [selectedEntry?.id]);

    const filteredEntries = entries.filter(item => {
        if (viewMode === 'archived') return item.archived;
        if (item.archived) return false;
        if (viewMode === 'active') return item.status !== 'completed';
        if (viewMode === 'completed') return item.status === 'completed';
        return false;
    });

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

        setIsGenerating(item.id);
        try {
            const slides = await learningService.generateTrainingContent(
                item.id,
                item.skillName,
                item.jobTitle,
                item.companyName
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
            await learningService.updateEntry(id, {
                status: 'completed',
                completionDate: new Date()
            });
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
                                style={{ backgroundColor: item.status === 'completed' ? '#E8F5E9' : '#FFF3E0', marginBottom: 4 }}
                                textStyle={{ color: item.status === 'completed' ? '#2E7D32' : '#E65100', fontSize: 10 }}
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

    return (
        <View style={styles.container}>
            <View style={styles.summaryHeader}>
                <Text variant="headlineMedium" style={styles.title}>Learning Hub</Text>
                <Text variant="bodySmall">Track your skill acquisition and professional growth.</Text>

                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'active' && styles.activeTab]}
                        onPress={() => setViewMode('active')}
                    >
                        <Text style={[styles.tabText, viewMode === 'active' && styles.activeTabText]}>
                            Active ({entries.filter(e => !e.archived && e.status !== 'completed').length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'completed' && styles.activeTab]}
                        onPress={() => setViewMode('completed')}
                    >
                        <Text style={[styles.tabText, viewMode === 'completed' && styles.activeTabText]}>
                            Completed ({entries.filter(e => !e.archived && e.status === 'completed').length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'archived' && styles.activeTab]}
                        onPress={() => setViewMode('archived')}
                    >
                        <Text style={[styles.tabText, viewMode === 'archived' && styles.activeTabText]}>
                            Archived ({entries.filter(e => e.archived).length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

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
        backgroundColor: '#f5f5f5',
    },
    summaryHeader: {
        padding: 24,
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
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
        borderBottomColor: '#6200ee', // theme primary color
    },
    tabText: {
        color: '#757575',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#6200ee',
    },
    list: {
        padding: 16,
    },
    card: {
        marginBottom: 12,
        backgroundColor: '#fff',
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
        borderTopColor: '#f0f0f0',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        marginTop: 40,
    },
});
